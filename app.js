const $ = (sel) => document.querySelector(sel);

const state = {
  query: "",
  deptGroup: "all",
  galleryGroup: "all",
  lightboxList: [],
  lightboxIndex: 0,
};

// 모든 활동을 한 줄로 펼치고 최신순 정렬
const ACTIVITIES = DEPARTMENTS.flatMap((d) => d.activities.map((a) => ({ ...a, dept: d })))
  .sort((a, b) => b.date.localeCompare(a.date));

// ---------- 유틸 ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function highlight(text) {
  const safe = escapeHtml(text);
  if (!state.query) return safe;
  const q = escapeHtml(state.query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(q, "gi"), (m) => `<mark>${m}</mark>`);
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

function groupVars(groupKey) {
  const g = GROUPS[groupKey];
  return `--g:${g.color};--g-soft:${g.soft};`;
}

// 실제 사진이 없을 때 보여줄 부드러운 그림 (하늘 · 해 · 언덕 · 주제 그림)
let sceneSeq = 0;
function sceneSVG(activity) {
  if (activity.photo) {
    return `<img class="scene" src="${escapeHtml(activity.photo)}" alt="${escapeHtml(activity.title)}" loading="lazy" />`;
  }
  const g = GROUPS[activity.dept.group];
  const id = `sky${++sceneSeq}`;
  return `
  <svg class="scene" viewBox="0 0 400 300" role="img" aria-label="${escapeHtml(activity.title)} 그림">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${g.soft}" />
        <stop offset="1" stop-color="#fffaf3" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#${id})" />
    <circle cx="330" cy="62" r="28" fill="#ffd98a" opacity="0.9" />
    <ellipse cx="80" cy="60" rx="34" ry="12" fill="#fff" />
    <ellipse cx="104" cy="52" rx="22" ry="12" fill="#fff" />
    <path d="M0 215 Q100 165 200 205 T400 190 V300 H0Z" fill="${g.color}" opacity="0.22" />
    <path d="M0 245 Q130 205 250 240 T400 235 V300 H0Z" fill="${g.color}" opacity="0.38" />
    <circle cx="200" cy="150" r="70" fill="#ffffff" opacity="0.75" />
    <text x="200" y="152" font-size="78" text-anchor="middle" dominant-baseline="central">${activity.scene}</text>
  </svg>`;
}

function photoCard(activity, index, listName) {
  return `
  <button class="photo" data-photo="${index}" data-list="${listName}">
    <div class="photo-frame">${sceneSVG(activity)}</div>
    <div class="photo-info">
      <strong>${escapeHtml(activity.title)}</strong>
      <small>${escapeHtml(activity.dept.name)} · ${formatDate(activity.date)}</small>
    </div>
  </button>`;
}

function renderTabs(container, current, attr) {
  const all = `<button class="tab" role="tab" data-${attr}="all" aria-selected="${current === "all"}">전체</button>`;
  const rest = Object.entries(GROUPS)
    .map(
      ([key, g]) =>
        `<button class="tab" role="tab" data-${attr}="${key}" style="--tab-color:${g.color}" aria-selected="${current === key}">${g.label}</button>`
    )
    .join("");
  container.innerHTML = all + rest;
}

// ---------- 부서 안내 ----------
function deptMatches(d) {
  if (state.deptGroup !== "all" && d.group !== state.deptGroup) return false;
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return [d.name, d.intro, GROUPS[d.group].label, ...d.missions, ...d.teams, ...d.activities.map((a) => a.title)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function renderDepartments() {
  renderTabs($("#dept-tabs"), state.deptGroup, "dept-group");
  const list = DEPARTMENTS.filter(deptMatches);

  $("#dept-grid").innerHTML = list
    .map((d) => {
      // 검색어가 들어간 업무를 먼저 보여주기
      const q = state.query.toLowerCase();
      const missions = q
        ? [...d.missions].sort((a, b) => b.toLowerCase().includes(q) - a.toLowerCase().includes(q))
        : d.missions;
      return `
      <button class="dept-card" data-dept="${d.id}" style="${groupVars(d.group)}">
        <div class="dept-top">
          <span class="dept-icon" aria-hidden="true">${d.icon}</span>
          <div>
            <span class="badge">${GROUPS[d.group].label}</span>
            <h3>${highlight(d.name)}</h3>
          </div>
        </div>
        <p class="intro">${highlight(d.intro)}</p>
        <ul>${missions.slice(0, 3).map((m) => `<li>${highlight(m)}</li>`).join("")}</ul>
        <span class="more">하는 일 · 활동 사진 보기 →</span>
      </button>`;
    })
    .join("");

  $("#dept-empty").hidden = list.length > 0;
  $("#dept-result").textContent = state.query
    ? `'${state.query}' 검색 결과: ${list.length}개 부서`
    : `${list.length}개 부서`;
}

function openDepartment(id) {
  const d = DEPARTMENTS.find((x) => x.id === id);
  if (!d) return;
  const acts = ACTIVITIES.filter((a) => a.dept.id === id);
  state.deptPhotos = acts;

  $("#dept-body").innerHTML = `
    <div style="${groupVars(d.group)}">
      <header class="sheet-head">
        <span class="dept-icon" aria-hidden="true">${d.icon}</span>
        <div>
          <span class="badge">${GROUPS[d.group].label}</span>
          <h2 id="dept-title">${escapeHtml(d.name)}</h2>
          <p>${escapeHtml(d.intro)}</p>
        </div>
      </header>
      <div class="sheet-body">
        <section>
          <h3>📌 이런 일을 해요 (주요 임무)</h3>
          <ol class="mission-list">${d.missions.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ol>
        </section>
        <section>
          <h3>👥 함께 일하는 팀</h3>
          <div class="team-list">${d.teams.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
        </section>
        <section>
          <h3>📷 활동 사진</h3>
          <div class="gallery">${acts.map((a, i) => photoCard(a, i, "dept")).join("")}</div>
        </section>
      </div>
    </div>`;
  showModal("#dept-modal");
}

// ---------- 활동 사진 ----------
function galleryList() {
  return state.galleryGroup === "all" ? ACTIVITIES : ACTIVITIES.filter((a) => a.dept.group === state.galleryGroup);
}

function renderGallery() {
  renderTabs($("#gallery-tabs"), state.galleryGroup, "gallery-group");
  $("#gallery-grid").innerHTML = galleryList().map((a, i) => photoCard(a, i, "gallery")).join("");
}

function openLightbox(list, index) {
  state.lightboxList = list;
  state.lightboxIndex = index;
  renderLightbox();
  showModal("#lightbox");
}

function renderLightbox() {
  const list = state.lightboxList;
  const a = list[state.lightboxIndex];
  $("#lb-image").innerHTML = sceneSVG(a);
  $("#lb-caption").innerHTML = `
    <h3 id="lb-title">${escapeHtml(a.title)}</h3>
    <small>${escapeHtml(a.dept.name)} · ${formatDate(a.date)}</small>
    <p>${escapeHtml(a.desc)}</p>`;
  $("#lb-count").textContent = `${state.lightboxIndex + 1} / ${list.length}`;
  $("#lb-prev").disabled = list.length < 2;
  $("#lb-next").disabled = list.length < 2;
}

function moveLightbox(step) {
  const n = state.lightboxList.length;
  state.lightboxIndex = (state.lightboxIndex + step + n) % n;
  renderLightbox();
}

// ---------- 모달 공통 ----------
let lastFocus = null;
function showModal(sel) {
  if ($(sel).hidden) lastFocus = document.activeElement;
  $(sel).hidden = false;
  document.body.style.overflow = "hidden";
  $(sel).querySelector(".close").focus();
}

function closeModal(modal) {
  modal.hidden = true;
  const anyOpen = [...document.querySelectorAll(".modal")].some((m) => !m.hidden);
  if (!anyOpen) {
    document.body.style.overflow = "";
    lastFocus?.focus();
  } else {
    // 부서 창 위에 사진 창이 떠 있었다면 부서 창으로 포커스를 돌려줌
    document.querySelector(".modal:not([hidden]) .close")?.focus();
  }
}

function topModal() {
  if (!$("#lightbox").hidden) return $("#lightbox");
  if (!$("#dept-modal").hidden) return $("#dept-modal");
  return null;
}

// ---------- 보기 설정 ----------
const PREF_KEY = "osan-cityhall-view";
const view = { font: 0, contrast: false };

function applyView() {
  document.documentElement.style.setProperty("--font-scale", 1 + view.font * 0.12);
  document.body.classList.toggle("contrast", view.contrast);
  $("#contrast-btn").setAttribute("aria-pressed", view.contrast);
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(view));
  } catch {
    // 저장이 안 되는 환경이면 이번 방문 동안만 적용
  }
}

try {
  Object.assign(view, JSON.parse(localStorage.getItem(PREF_KEY)) || {});
} catch {
  // 저장된 설정이 없거나 읽을 수 없음
}

// ---------- 이벤트 ----------
function runSearch(q) {
  state.query = q.trim();
  renderDepartments();
}

$("#search").addEventListener("input", (e) => runSearch(e.target.value));
$("#search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#departments").scrollIntoView();
});
$("#search-btn").addEventListener("click", () => {
  runSearch($("#search").value);
  $("#departments").scrollIntoView();
});

$("#lb-prev").addEventListener("click", () => moveLightbox(-1));
$("#lb-next").addEventListener("click", () => moveLightbox(1));

$("#contrast-btn").addEventListener("click", () => {
  view.contrast = !view.contrast;
  applyView();
});

document.addEventListener("click", (e) => {
  const t = e.target;

  const font = t.closest("[data-font]");
  if (font) {
    const step = Number(font.dataset.font);
    view.font = step === 0 ? 0 : Math.max(-1, Math.min(3, view.font + step));
    return applyView();
  }

  const quick = t.closest("[data-q]");
  if (quick) {
    $("#search").value = quick.dataset.q;
    runSearch(quick.dataset.q);
    return $("#departments").scrollIntoView();
  }

  const deptTab = t.closest("[data-dept-group]");
  if (deptTab) {
    state.deptGroup = deptTab.dataset.deptGroup;
    return renderDepartments();
  }

  const galTab = t.closest("[data-gallery-group]");
  if (galTab) {
    state.galleryGroup = galTab.dataset.galleryGroup;
    return renderGallery();
  }

  const photo = t.closest("[data-photo]");
  if (photo) {
    const list = photo.dataset.list === "dept" ? state.deptPhotos : galleryList();
    return openLightbox(list, Number(photo.dataset.photo));
  }

  const dept = t.closest("[data-dept]");
  if (dept) return openDepartment(dept.dataset.dept);

  if (t.closest("[data-close]")) closeModal(t.closest(".modal"));
});

document.addEventListener("keydown", (e) => {
  const modal = topModal();
  if (!modal) return;
  if (e.key === "Escape") closeModal(modal);
  if (modal.id === "lightbox" && e.key === "ArrowLeft") moveLightbox(-1);
  if (modal.id === "lightbox" && e.key === "ArrowRight") moveLightbox(1);
});

applyView();
renderDepartments();
renderGallery();
