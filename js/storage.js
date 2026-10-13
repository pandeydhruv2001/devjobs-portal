const KEYS = Object.freeze({
  bookmarks: "devjobs.bookmarks",
  recentlyViewed: "devjobs.recentlyViewed",
  applications: "devjobs.applications",
  theme: "devjobs.theme",
  pagination: "devjobs.pagination",
});

export function readStoredValue(key, fallback, storage = localStorage) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStoredValue(key, value, storage = localStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const readBookmarks = () => readStoredValue(KEYS.bookmarks, []);
export const saveBookmarks = (ids) => writeStoredValue(KEYS.bookmarks, ids);
export const readRecentlyViewed = () => readStoredValue(KEYS.recentlyViewed, []);
export const saveRecentlyViewed = (ids) => writeStoredValue(KEYS.recentlyViewed, ids);
export const readApplications = (storage = localStorage) => readStoredValue(KEYS.applications, [], storage);
export const saveApplication = (application, storage = localStorage) => {
  const stored = readApplications(storage);
  const applications = Array.isArray(stored) ? stored : [];
  applications.push(application);
  return writeStoredValue(KEYS.applications, applications, storage);
};
export const readTheme = () => readStoredValue(KEYS.theme, "light");
export const saveTheme = (theme) => writeStoredValue(KEYS.theme, theme);
export const readPage = () => readStoredValue(KEYS.pagination, 1);
export const savePage = (page) => writeStoredValue(KEYS.pagination, page);
