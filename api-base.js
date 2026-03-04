const API_BASE_LS_KEY = "arclearn_api_base_v1";
const DEFAULT_CLOUDFLARE_API_BASE = "https://report.anmol-prash.workers.dev";

function normBase(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/\/+$/, "");
}

function isLocalHost() {
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

function readQueryApiBase() {
  try {
    const u = new URL(window.location.href);
    const q = normBase(u.searchParams.get("apiBase"));
    if (q) {
      localStorage.setItem(API_BASE_LS_KEY, q);
      return q;
    }
  } catch {
    // ignore
  }
  return "";
}

export function getApiBase() {
  const fromQuery = readQueryApiBase();
  if (fromQuery) return fromQuery;

  const fromWindow = normBase(window.ARCLEARN_API_BASE);
  if (fromWindow) return fromWindow;

  try {
    const fromLS = normBase(localStorage.getItem(API_BASE_LS_KEY));
    if (fromLS) return fromLS;
  } catch {
    // ignore
  }

  const fromDefault = normBase(DEFAULT_CLOUDFLARE_API_BASE);
  if (fromDefault.includes("REPLACE_WITH_YOUR_WORKER")) return "";
  return fromDefault;
}

export function setApiBase(nextBase) {
  const v = normBase(nextBase);
  try {
    if (v) localStorage.setItem(API_BASE_LS_KEY, v);
    else localStorage.removeItem(API_BASE_LS_KEY);
  } catch {
    // ignore
  }
  window.ARCLEARN_API_BASE = v;
  return v;
}

export function apiCandidates(path) {
  const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
  const base = getApiBase();

  if (base) return [`${base}${cleanPath}`];
  if (isLocalHost()) return [cleanPath, `http://localhost:5502${cleanPath}`];
  return [];
}
