// UI helper: shows streak at the top and course weaknesses inside a sidebar mount.
// Data source is localStorage (synced from RTDB by pages that already subscribe to profile).
// Keys:
// - arclearn_streak_v1: { current:number, best?:number, lastDate?: "YYYY-MM-DD" }
// - arclearn_weaknesses_v1: { byCourse: { [courseId]: { items: { [id]: { label, count, lastWrongAt } } } } }

const STREAK_KEY = "arclearn_streak_v1";
const WEAK_KEY = "arclearn_weaknesses_v1";

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function guessCourseId() {
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("courseId");
    if (q) return q;
  } catch {}

  const file = (window.location.pathname || "").split("/").pop() || "";
  const base = file.replace(/\.html$/i, "").toLowerCase();

  // Common mappings.
  if (base === "english-one") return "english";
  if (base === "courses") return "";
  if (base === "index" || base === "") return "";
  return base;
}

function courseLabel(courseId) {
  const map = {
    calculus: "Calculus",
    biology: "Biology",
    finance: "Finance",
    economics: "Economics",
    fitness: "Fitness",
    english: "English",
  };
  return map[courseId] || (courseId ? courseId[0].toUpperCase() + courseId.slice(1) : "All Courses");
}

function inject() {
  if (document.getElementById("arclearn-streak-weak-style")) return;

  const style = document.createElement("style");
  style.id = "arclearn-streak-weak-style";
  style.textContent = `
    .arclearn-streak-pill{
      position:fixed; top:14px; right:14px; z-index:9996;
      display:inline-flex; align-items:center; gap:8px;
      padding:9px 12px; border-radius:999px;
      background:rgba(255,255,255,.92);
      border:2px solid rgba(226,236,244,.95);
      box-shadow:0 10px 26px rgba(20,48,64,.12);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Nunito", sans-serif;
      font-weight:900; color:#215d7b;
      backdrop-filter: blur(10px);
    }
    .arclearn-streak-dot{
      width:10px; height:10px; border-radius:50%;
      background:linear-gradient(140deg,#4cc96f,#1992ff);
      box-shadow:0 0 0 4px rgba(76,201,111,.15);
    }
    .arclearn-weak-panel{
      width:100%;
      background:rgba(255,255,255,.78);
      border:2px solid rgba(233,242,249,.95);
      border-radius:16px;
      box-shadow:0 10px 24px rgba(20,48,64,.10);
      padding:12px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Nunito", sans-serif;
    }
    .arclearn-weak-top{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
    .arclearn-weak-title{ font-weight:1000; color:#143040; }
    .arclearn-weak-sub{ font-weight:900; color:#0f5d97; background:#edf7ff; border:2px solid #d8ebfb; border-radius:999px; padding:5px 9px; font-size:12px; white-space:nowrap; }
    .arclearn-weak-list{ display:grid; gap:6px; }
    .arclearn-weak-item{ display:flex; justify-content:space-between; gap:10px; align-items:center; padding:8px 10px; border-radius:12px; border:1px solid #e7eff6; background:#ffffff; }
    .arclearn-weak-label{ font-weight:900; color:#183a44; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .arclearn-weak-count{ font-weight:1000; color:#2a5974; background:#f4fbff; border:1px solid #ddeffc; border-radius:999px; padding:4px 9px; font-size:12px; flex:0 0 auto; }
    .arclearn-weak-empty{ color:#3c5c67; font-weight:800; font-size:13px; padding:6px 2px; }
  `;
  document.head.appendChild(style);

  const streak = document.createElement("div");
  streak.className = "arclearn-streak-pill";
  streak.id = "arclearn-streak-pill";
  streak.innerHTML = `<span class="arclearn-streak-dot" aria-hidden="true"></span><span id="arclearn-streak-text">Streak: 0 days</span>`;
  document.body.appendChild(streak);
}

function getWeaknessMount() {
  return (
    document.querySelector("[data-arclearn-weakness-mount]") ||
    document.getElementById("arclearn-weakness-mount")
  );
}

function render() {
  inject();
  const courseId = guessCourseId();
  const label = courseLabel(courseId);

  const streakRaw = localStorage.getItem(STREAK_KEY);
  const streak = safeJsonParse(streakRaw, { current: 0 });
  const current = Number.isFinite(streak?.current) ? streak.current : 0;
  const streakText = document.getElementById("arclearn-streak-text");
  if (streakText) streakText.textContent = `Streak: ${current} day${current === 1 ? "" : "s"}`;

  const mount = getWeaknessMount();
  if (!mount) return;

  mount.innerHTML = `
    <div class="arclearn-weak-panel">
      <div class="arclearn-weak-top">
        <div class="arclearn-weak-title">Weak Spots</div>
        <div class="arclearn-weak-sub">${escapeHtml(label)}</div>
      </div>
      <div class="arclearn-weak-list" id="arclearn-weak-list"></div>
    </div>
  `;
  const list = mount.querySelector("#arclearn-weak-list");
  if (!list) return;

  const weakRaw = localStorage.getItem(WEAK_KEY);
  const store = safeJsonParse(weakRaw, { byCourse: {} });
  const byCourse = store?.byCourse && typeof store.byCourse === "object" ? store.byCourse : {};

  let items = [];
  if (!courseId) {
    // Index: show top across all courses.
    for (const [cid, cobj] of Object.entries(byCourse)) {
      const objItems = cobj?.items && typeof cobj.items === "object" ? cobj.items : {};
      for (const v of Object.values(objItems)) {
        const count = Number(v?.count || 0);
        if (!count) continue;
        items.push({ label: `${courseLabel(cid)}: ${String(v?.label || "")}`.trim(), count });
      }
    }
  } else {
    const objItems = byCourse?.[courseId]?.items && typeof byCourse[courseId].items === "object" ? byCourse[courseId].items : {};
    for (const v of Object.values(objItems)) {
      const count = Number(v?.count || 0);
      if (!count) continue;
      items.push({ label: String(v?.label || "").trim(), count });
    }
  }

  items.sort((a, b) => b.count - a.count);
  items = items.slice(0, 5);

  if (items.length === 0) {
    list.innerHTML = `<div class="arclearn-weak-empty">No weak spots yet. Miss a few questions and this will start adapting.</div>`;
    return;
  }

  list.innerHTML = items
    .map(
      (it) =>
        `<div class="arclearn-weak-item"><div class="arclearn-weak-label" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</div><div class="arclearn-weak-count">x${it.count}</div></div>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.addEventListener("storage", (e) => {
  if (e.key === STREAK_KEY || e.key === WEAK_KEY) render();
});

// Initial + periodic refresh (covers same-tab localStorage writes).
render();
setInterval(render, 1500);
