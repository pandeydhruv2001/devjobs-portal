import { loadJobs } from "./jobs.js";
import { readBookmarks, saveBookmarks, readTheme, saveTheme, readPage, savePage } from "./storage.js";

const $ = (selector) => document.querySelector(selector);
const ui = {
  search: $("#job-search"), location: $("#location-filter"), experience: $("#experience-filter"),
  min: $("#salary-min"), max: $("#salary-max"), category: $("#category-filter"),
  sort: $("#sort-select"), list: $("#job-list"), featured: $("#featured-jobs"),
  chips: $("#category-chips"), pagination: $("#pagination"), loading: $("#loading-state"),
  error: $("#error-state"), empty: $("#empty-state"), results: $("#results-count"),
  savedToggle: $("#saved-toggle"), savedCount: $("#saved-count"),
};
const PAGE_SIZE = 10;
const state = { jobs: [], bookmarks: new Set(Array.isArray(readBookmarks()) ? readBookmarks() : []), savedOnly: false, page: readPage(), categories: [], categoryCounts: {}, locations: [] };
const cash = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const experienceLabel = ({ min, max }) => max >= 10 ? `${min}+ years` : `${min}–${max} years`;
const jobUrl = (job) => `job-details.html?id=${encodeURIComponent(job.id)}`;

function populateSelect(select, values, label) {
  const selected = select.value;
  select.replaceChildren(new Option(label, ""));
  values.forEach((value) => select.add(new Option(value, value)));
  if (values.includes(selected)) select.value = selected;
}

function createSaveButton(job) {
  const button = el("button", "save-button", state.bookmarks.has(job.id) ? "♥" : "♡");
  button.type = "button";
  button.dataset.save = job.id;
  button.setAttribute("aria-label", `${state.bookmarks.has(job.id) ? "Remove" : "Save"} ${job.title} at ${job.companyName}`);
  button.setAttribute("aria-pressed", String(state.bookmarks.has(job.id)));
  return button;
}

function createJobCard(job, featured = false) {
  const card = el("article", featured ? "featured-card" : "job-card");
  const row = el("div", "company-row");
  const logo = el("span", "company-logo", job.companyLogo.initials);
  logo.style.backgroundColor = job.companyLogo.backgroundColor;
  logo.setAttribute("aria-hidden", "true");
  row.append(logo);
  const company = el("div", "company-info");
  company.append(el("h3", "", job.companyName), el("p", "", job.location));
  row.append(company, createSaveButton(job));
  card.append(row);
  if (featured) {
    const title = el("h4");
    const titleLink = el("a", "", job.title);
    titleLink.href = jobUrl(job);
    title.append(titleLink);
    card.append(title);
    const tags = el("div", "tag-row");
    job.skills.slice(0, 3).forEach((skill) => tags.append(el("span", "tag", skill)));
    const meta = el("div", "featured-meta");
    meta.append(el("strong", "", `${cash.format(job.salary)} / year`), el("span", "muted", `${job.jobType} · ${experienceLabel(job.experience)}`));
    const applyLink = el("a", "apply-link", "Apply →");
    applyLink.href = jobUrl(job) + "#apply";
    meta.append(applyLink);
    card.append(tags, meta);
    return card;
  }
  const heading = el("h3");
  const link = el("a", "", job.title);
  link.href = jobUrl(job);
  heading.append(link);
  const facts = el("div", "job-facts");
  facts.append(el("span", "", `◷ ${experienceLabel(job.experience)}`), el("span", "", `⌖ ${job.location}`), el("span", "", job.jobType));
  const main = el("div");
  main.append(row, heading, facts);
  const tags = el("div", "job-tags");
  job.skills.slice(0, 4).forEach((skill) => tags.append(el("span", "tag", skill)));
  const bottom = el("div", "job-card-bottom");
  bottom.append(el("span", "muted", new Date(`${job.postedDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })), Object.assign(el("a", "apply-link", "View job →"), { href: jobUrl(job) + "#apply" }));
  main.append(tags, bottom);
  const side = el("div", "job-card-side");
  side.append(el("span", "salary", `${cash.format(job.salary)} / year`), Object.assign(el("a", "apply-link", "Apply →"), { href: jobUrl(job) + "#apply" }));
  card.append(main, side);
  return card;
}

function getVisibleJobs() {
  const query = ui.search.value.trim().toLocaleLowerCase();
  const selectedTypes = [...document.querySelectorAll('input[name="job-type"]:checked')].map((input) => input.value);
  const minSalary = ui.min.value === "" ? null : Number(ui.min.value);
  const maxSalary = ui.max.value === "" ? null : Number(ui.max.value);
  const experience = ui.experience.value ? ui.experience.value.split("-").map(Number) : null;
  return state.jobs.filter((job) => {
    const matchesQuery = !query || [job.title, job.companyName, ...job.skills].some((value) => value.toLocaleLowerCase().includes(query));
    const matchesLocation = !ui.location.value || job.location === ui.location.value;
    const matchesCategory = !ui.category.value || job.category === ui.category.value;
    const matchesType = selectedTypes.length === 0 || selectedTypes.some((type) => job.jobType === type);
    const matchesSalary = (minSalary === null || job.salary >= minSalary) && (maxSalary === null || job.salary <= maxSalary);
    const matchesExperience = !experience || (job.experience.max >= experience[0] && job.experience.min <= experience[1]);
    const matchesSaved = !state.savedOnly || state.bookmarks.has(job.id);
    return matchesQuery && matchesLocation && matchesCategory && matchesType && matchesSalary && matchesExperience && matchesSaved;
  });
}

function getSortedJobs(jobs) {
  const copy = [...jobs];
  switch (ui.sort.value) {
    case "salary-high": return copy.sort((a, b) => b.salary - a.salary);
    case "salary-low": return copy.sort((a, b) => a.salary - b.salary);
    case "alphabetical": return copy.sort((a, b) => a.title.localeCompare(b.title));
    default: return copy.sort((a, b) => b.postedDate.localeCompare(a.postedDate));
  }
}

function renderCategories() {
  const previous = ui.category.value;
  populateSelect(ui.category, state.categories, "All categories");
  if (state.categories.includes(previous)) ui.category.value = previous;
  ui.chips.replaceChildren();
  const all = el("button", "category-chip", "All categories · " + state.jobs.length);
  all.type = "button";
  all.dataset.category = "";
  all.setAttribute("aria-pressed", String(!ui.category.value));
  ui.chips.append(all);
  state.categories.forEach((category) => {
    const button = el("button", "category-chip", category + " · " + state.categoryCounts[category]);
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(ui.category.value === category));
    ui.chips.append(button);
  });
}

function renderFeatured() {
  ui.featured.replaceChildren(...state.jobs.filter((job) => job.featured).slice(0, 3).map((job) => createJobCard(job, true)));
}

function renderPagination(totalPages) {
  ui.pagination.replaceChildren();
  if (totalPages <= 1) return;
  const addButton = (label, page, disabled = false, current = false) => {
    const button = el("button", "page-button", label);
    button.type = "button";
    button.disabled = disabled;
    button.dataset.page = String(page);
    if (current) button.setAttribute("aria-current", "page");
    ui.pagination.append(button);
  };
  addButton("Previous", state.page - 1, state.page === 1);
  for (let page = 1; page <= totalPages; page += 1) addButton(String(page), page, false, page === state.page);
  addButton("Next", state.page + 1, state.page === totalPages);
}

function render() {
  renderCategories();
  populateSelect(ui.location, state.locations, "All locations");
  const filtered = getVisibleJobs();
  const sorted = getSortedJobs(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const pageJobs = sorted.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  ui.list.replaceChildren(...pageJobs.map((job) => createJobCard(job)));
  ui.results.textContent = state.savedOnly ? `${sorted.length} saved ${sorted.length === 1 ? "job" : "jobs"}` : `${sorted.length} opportunities`;
  ui.empty.hidden = sorted.length > 0;
  ui.list.hidden = sorted.length === 0;
  ui.pagination.hidden = sorted.length === 0;
  if (sorted.length === 0) {
    $("#empty-title").textContent = state.savedOnly ? "No saved jobs yet" : "No jobs found";
    $("#empty-message").textContent = state.savedOnly ? "Save an opportunity and it will be waiting here." : "Try changing your search or filters.";
  }
  ui.savedCount.textContent = String(state.bookmarks.size);
  ui.savedToggle.setAttribute("aria-pressed", String(state.savedOnly));
  ui.savedToggle.classList.toggle("button-secondary", state.savedOnly);
  renderPagination(totalPages);
  savePage(state.page);
}

function setLoading(loading) {
  ui.loading.hidden = !loading;
  if (loading) ui.loading.replaceChildren(...Array.from({ length: 3 }, () => el("div", "skeleton")));
}

async function initialize() {
  document.documentElement.dataset.theme = readTheme() === "dark" ? "dark" : "light";
  $("#year").textContent = String(new Date().getFullYear());
  ui.savedToggle.addEventListener("click", () => {
    state.savedOnly = !state.savedOnly;
    state.page = 1;
    ui.savedToggle.textContent = state.savedOnly ? "All jobs " : "Saved jobs ";
    ui.savedToggle.append(ui.savedCount);
    render();
  });
  $("#theme-toggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
  });
  $("#search-form").addEventListener("submit", (event) => { event.preventDefault(); state.page = 1; render(); $("#jobs").scrollIntoView({ behavior: "smooth" }); });
  [ui.search, ui.location, ui.experience, ui.min, ui.max, ui.category].forEach((control) => control.addEventListener(control === ui.search ? "input" : "change", () => { state.page = 1; render(); }));
  ui.sort.addEventListener("change", render);
  document.querySelectorAll('input[name="job-type"]').forEach((input) => input.addEventListener("change", () => { state.page = 1; render(); }));
  ui.chips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    ui.category.value = button.dataset.category;
    state.page = 1;
    render();
    $("#jobs").scrollIntoView({ behavior: "smooth" });
  });
  const clearFilters = () => {
    ui.search.value = "";
    ui.location.value = "";
    ui.experience.value = "";
    ui.min.value = "";
    ui.max.value = "";
    ui.category.value = "";
    document.querySelectorAll('input[name="job-type"]').forEach((input) => { input.checked = false; });
    state.savedOnly = false;
    state.page = 1;
    ui.savedToggle.textContent = "Saved jobs ";
    ui.savedToggle.append(ui.savedCount);
    render();
  };
  $("#clear-filters").addEventListener("click", clearFilters);
  $("#empty-reset").addEventListener("click", clearFilters);
  $("#retry-load").addEventListener("click", start);
  ui.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    render();
    $("#jobs-heading").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-save]");
    if (!button) return;
    const id = button.dataset.save;
    if (state.bookmarks.has(id)) state.bookmarks.delete(id);
    else state.bookmarks.add(id);
    saveBookmarks([...state.bookmarks]);
    render();
  });
  await start();
}

async function start() {
  ui.error.hidden = true;
  ui.empty.hidden = true;
  ui.list.hidden = true;
  ui.pagination.hidden = true;
  setLoading(true);
  try {
    state.jobs = await loadJobs();
    state.categoryCounts = state.jobs.reduce((counts, job) => { counts[job.category] = (counts[job.category] || 0) + 1; return counts; }, {});
    state.categories = Object.keys(state.categoryCounts).sort();
    state.locations = [...new Set(state.jobs.map((job) => job.location))].sort();
    state.bookmarks = new Set([...state.bookmarks].filter((id) => state.jobs.some((job) => job.id === id)));
    saveBookmarks([...state.bookmarks]);
    renderFeatured();
    state.page = Number.isInteger(state.page) && state.page > 0 ? state.page : 1;
    render();
  } catch (error) {
    console.error(error);
    ui.error.hidden = false;
  } finally {
    setLoading(false);
  }
}

initialize();




