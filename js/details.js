import { loadJobs } from "./jobs.js";
import { readBookmarks, saveBookmarks, readRecentlyViewed, saveRecentlyViewed, readTheme, saveTheme, saveApplication, readStoredValue, writeStoredValue } from "./storage.js";

const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const id = params.get("id");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dialog = $("#application-dialog");
const form = $("#application-form");
const errorBox = $("#application-error");
let job;
let step = 1;

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const putText = (selector, value) => { $(selector).textContent = value; };
const addList = (selector, items) => {
  const list = $(selector);
  list.replaceChildren(...items.map((text) => node("li", "", text)));
};

function renderRecent(jobs) {
  const recentIds = readRecentlyViewed();
  const cards = (Array.isArray(recentIds) ? recentIds : []).map((recentId) => jobs.find((item) => item.id === recentId)).filter(Boolean).filter((item) => item.id !== job.id).slice(0, 5);
  const target = $("#recent-jobs");
  if (!cards.length) {
    target.append(node("p", "muted", "Jobs you view next will appear here."));
    return;
  }
  cards.forEach((item) => {
    const card = node("article", "featured-card");
    const row = node("div", "company-row");
    const logo = node("span", "company-logo", item.companyLogo.initials);
    logo.style.backgroundColor = item.companyLogo.backgroundColor;
    const info = node("div", "company-info");
    info.append(node("h3", "", item.companyName), node("p", "", item.location));
    row.append(logo, info);
    const link = node("a", "recent-job-link", item.title);
    link.href = `job-details.html?id=${encodeURIComponent(item.id)}`;
    const meta = node("p", "muted", `${money.format(item.salary)} / year · ${item.jobType}`);
    card.append(row, link, meta);
    target.append(card);
  });
}

function saveCurrentDraft() {
  const values = Object.fromEntries(["name", "email", "phone", "experience", "skills", "portfolio", "linkedin"].map((name) => [name, form.elements[name].value]));
  writeStoredValue("devjobs.applicationDraft", { jobId: job.id, step, values });
}

function restoreDraft() {
  const draft = readStoredValue("devjobs.applicationDraft", null);
  if (!draft || draft.jobId !== job.id || !draft.values) return;
  Object.entries(draft.values).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value;
  });
}

function setStep(nextStep) {
  step = nextStep;
  document.querySelectorAll(".application-step").forEach((section) => {
    section.hidden = Number(section.dataset.step) !== step;
  });
  [...$("#step-indicator").children].forEach((item, index) => {
    if (index + 1 === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  $("#step-back").hidden = step === 1;
  $("#step-next").hidden = step === 4;
  $("#application-submit").hidden = step !== 4;
  errorBox.hidden = true;
  if (step === 4) renderReview();
}

function validateFile(input, required) {
  const file = input.files[0];
  const label = input.name === "resume" ? "Resume" : "Cover letter";
  if (!file) return required ? `${label} is required.` : "";
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "doc", "docx"].includes(extension)) return `${label} must be PDF, DOC, or DOCX.`;
  if (file.size > 5 * 1024 * 1024) return `${label} must be 5 MB or smaller.`;
  return "";
}

function validateStep() {
  const current = document.querySelector(`.application-step[data-step="${step}"]`);
  for (const field of current.querySelectorAll("input:not([type=file]), textarea")) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  if (step === 1 && !/^(?:\+91[ -]?)?[0-9]{10}$/.test(form.elements.phone.value.trim())) {
    return showError("Enter a valid 10-digit phone number, optionally prefixed with +91.");
  }
  if (step === 2) {
    for (const name of ["portfolio", "linkedin"]) {
      const value = form.elements[name].value.trim();
      if (value && !isHttpUrl(value)) return showError(`Enter a valid ${name === "linkedin" ? "LinkedIn" : "portfolio"} URL starting with http:// or https://.`);
    }
  }
  if (step === 3) {
    const message = validateFile(form.elements.resume, true) || validateFile(form.elements.coverLetter, false);
    if (message) return showError(message);
  }
  errorBox.hidden = true;
  return true;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  errorBox.focus();
  return false;
}

function renderReview() {
  const review = $("#application-review");
  review.replaceChildren();
  const values = [
    ["Name", form.elements.name.value.trim()],
    ["Email", form.elements.email.value.trim()],
    ["Phone", form.elements.phone.value.trim()],
    ["Experience", `${form.elements.experience.value} years`],
    ["Skills", form.elements.skills.value.trim()],
    ["Portfolio", form.elements.portfolio.value.trim() || "Not provided"],
    ["LinkedIn", form.elements.linkedin.value.trim() || "Not provided"],
    ["Resume", form.elements.resume.files[0]?.name || "Select resume again before submitting"],
    ["Cover letter", form.elements.coverLetter.files[0]?.name || "Not provided"],
  ];
  values.forEach(([label, value]) => {
    const row = node("div", "review-row");
    row.append(node("span", "muted", label), node("strong", "", value));
    review.append(row);
  });
}

function openApplication() {
  $("#application-success").hidden = true;
  form.hidden = false;
  form.reset();
  restoreDraft();
  setStep(1);
  dialog.showModal();
  form.elements.name.focus();
}

function toggleBookmark() {
  const bookmarks = new Set(Array.isArray(readBookmarks()) ? readBookmarks() : []);
  if (bookmarks.has(job.id)) bookmarks.delete(job.id);
  else bookmarks.add(job.id);
  saveBookmarks([...bookmarks]);
  const saved = bookmarks.has(job.id);
  const button = $("#detail-save");
  button.textContent = saved ? "♥ Saved" : "♡ Save job";
  button.setAttribute("aria-pressed", String(saved));
}

function renderDetail(current) {
  document.title = `${current.title} at ${current.companyName} — DevJobs`;
  const company = $("#detail-company");
  const logo = node("span", "company-logo detail-logo", current.companyLogo.initials);
  logo.style.backgroundColor = current.companyLogo.backgroundColor;
  const copy = node("div", "company-info");
  copy.append(node("p", "eyebrow", current.category), node("h1", "", current.title), node("p", "muted", `${current.companyName} · ${current.location}`));
  company.append(logo, copy);
  putText("#detail-title", current.title);
  putText("#detail-description", current.description);
  addList("#detail-responsibilities", current.responsibilities);
  addList("#detail-requirements", current.requirements);
  $("#detail-skills").replaceChildren(...current.skills.map((skill) => node("span", "tag", skill)));
  addList("#detail-benefits", current.benefits);
  putText("#detail-salary", `${money.format(current.salary)} / year`);
  putText("#detail-experience", current.experience.max >= 10 ? `${current.experience.min}+ years` : `${current.experience.min}–${current.experience.max} years`);
  putText("#detail-location", current.location);
  putText("#detail-type", current.jobType);
  const saved = new Set(Array.isArray(readBookmarks()) ? readBookmarks() : []).has(current.id);
  $("#detail-save").textContent = saved ? "♥ Saved" : "♡ Save job";
  $("#detail-save").setAttribute("aria-pressed", String(saved));
  $("#detail-content").hidden = false;
}

async function initialize() {
  document.documentElement.dataset.theme = readTheme() === "dark" ? "dark" : "light";
  $("#year").textContent = String(new Date().getFullYear());
  $("#theme-toggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  });
  try {
    const jobs = await loadJobs();
    job = jobs.find((item) => item.id === id);
    if (!job) throw new Error("Requested job was not found.");
    const currentRecent = readRecentlyViewed();
    const recent = [job.id, ...(Array.isArray(currentRecent) ? currentRecent : []).filter((recentId) => recentId !== job.id)].slice(0, 6);
    saveRecentlyViewed(recent);
    renderDetail(job);
    renderRecent(jobs);
    $("#detail-loading").hidden = true;
  } catch (error) {
    console.error(error);
    $("#detail-loading").hidden = true;
    $("#detail-error").hidden = false;
  }
  $("#detail-save").addEventListener("click", toggleBookmark);
  $("#apply-open").addEventListener("click", openApplication);
  $("#apply-open-side").addEventListener("click", openApplication);
  $("#application-close").addEventListener("click", () => dialog.close());
  $("#success-close").addEventListener("click", () => dialog.close());
  $("#step-next").addEventListener("click", () => {
    if (!validateStep()) return;
    saveCurrentDraft();
    setStep(Math.min(step + 1, 4));
  });
  $("#step-back").addEventListener("click", () => setStep(Math.max(step - 1, 1)));
  form.addEventListener("input", saveCurrentDraft);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (step !== 4 || !validateStep()) return;
    const message = validateFile(form.elements.resume, true) || validateFile(form.elements.coverLetter, false);
    if (message) {
      setStep(3);
      showError(message);
      return;
    }
    const applicationId = `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const appliedAt = new Date().toISOString();
    const application = {
      applicationId, appliedAt, jobId: job.id, jobTitle: job.title, companyName: job.companyName,
      applicant: {
        name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), phone: form.elements.phone.value.trim(),
        experience: Number(form.elements.experience.value),
        skills: form.elements.skills.value.split(",").map((skill) => skill.trim()).filter(Boolean),
        portfolio: form.elements.portfolio.value.trim(), linkedin: form.elements.linkedin.value.trim(),
      },
      files: {
        resume: { name: form.elements.resume.files[0].name, size: form.elements.resume.files[0].size },
        coverLetter: form.elements.coverLetter.files[0] ? { name: form.elements.coverLetter.files[0].name, size: form.elements.coverLetter.files[0].size } : null,
      },
    };
    saveApplication(application);
    writeStoredValue("devjobs.applicationDraft", null);
    putText("#application-id", applicationId);
    putText("#application-date", new Date(appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }));
    form.hidden = true;
    $("#application-success").hidden = false;
  });
}

initialize().then(() => { if (job && location.hash === "#apply") openApplication(); });


