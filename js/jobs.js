const JOBS_URL = new URL("../data/jobs.json", import.meta.url);
const REQUIRED_STRINGS = [
  "id",
  "companyName",
  "title",
  "location",
  "jobType",
  "category",
  "postedDate",
  "description",
];
const REQUIRED_LISTS = ["skills", "responsibilities", "requirements", "benefits"];

export function isValidJob(job) {
  if (!job || typeof job !== "object" || Array.isArray(job)) return false;
  if (!REQUIRED_STRINGS.every((field) => typeof job[field] === "string" && job[field].trim())) return false;
  if (!Number.isFinite(job.salary) || job.salary <= 0) return false;
  if (!job.experience || !Number.isFinite(job.experience.min) || !Number.isFinite(job.experience.max)) return false;
  if (job.experience.min < 0 || job.experience.max < job.experience.min) return false;
  if (!job.companyLogo || typeof job.companyLogo.initials !== "string" || typeof job.companyLogo.backgroundColor !== "string") return false;
  if (!REQUIRED_LISTS.every((field) => Array.isArray(job[field]) && job[field].length > 0 && job[field].every((value) => typeof value === "string" && value.trim()))) return false;
  return typeof job.featured === "boolean" && /^\d{4}-\d{2}-\d{2}$/.test(job.postedDate);
}

export function validateJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length < 30) {
    throw new TypeError("Job data must be an array containing at least 30 jobs.");
  }
  const ids = new Set();
  for (const job of jobs) {
    if (!isValidJob(job)) throw new TypeError("A job record is missing a required field or has an invalid value.");
    if (ids.has(job.id)) throw new TypeError(`Duplicate job ID: ${job.id}`);
    ids.add(job.id);
  }
  return jobs;
}

export async function loadJobs(fetchImpl = fetch) {
  const response = await fetchImpl(JOBS_URL);
  if (!response.ok) throw new Error(`Could not load jobs (HTTP ${response.status}).`);
  return validateJobs(await response.json());
}
