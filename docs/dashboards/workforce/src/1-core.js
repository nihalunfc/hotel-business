// Hotel Workforce Suite: app shell, store, routing and shared helpers.
"use strict";
(() => {
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, MON, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const KEY = "hbi.workforce.v1";
const UIKEY = "hbi.workforce.ui.v1";

// ---------- Store ----------
let S;
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1 && s.emps) return s; } } catch (e) { /* storage unavailable */ }
  return WF.seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep working in memory */ } }
function resetDemo() { S = WF.seed(); save(); ui.week = weekStart(today()); ui.period = periodStart(today()); go("#/home"); toast("Demo data reset to a fresh sample"); }
S = load();
save();

const ui = Object.assign({ week: weekStart(today()), period: periodStart(today()), dept: "all", schedMode: null, hideDemo: false, tsQ: "", peopleQ: "", peopleDept: "all", peopleStatus: "active", repRange: "pp", apprTab: "all", toMonth: today().slice(0, 7) }, (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; } })());
ui.week = weekStart(today()); ui.period = periodStart(today()); ui.toMonth = today().slice(0, 7);
const saveUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ hideDemo: ui.hideDemo, schedMode: ui.schedMode })); } catch (e) { /* ignore */ } };

// ---------- Helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const E = (id) => S.emps.find((e) => e.id === id);
const nm = (e) => (e ? `${e.first} ${e.last}` : "Open shift");
const nmId = (id) => nm(E(id));
const posName = (p) => POS[p]?.name || p;
const dept = (id) => S.depts.find((d) => d.id === id) || { name: id, color: "#888" };
const prop = (id) => S.props.find((p) => p.id === id) || { name: "All properties", short: "All properties" };
const initials = (e) => (e ? e.first[0] + e.last[0] : "?");
const AVC = ["#2a78d6", "#1baf7a", "#eb6834", "#8b5cf6", "#c2410c", "#0e7490", "#1f4e79", "#b45309", "#be185d", "#4d7c0f"];
const avColor = (e) => AVC[(e ? e.no : 0) % AVC.length];
const av = (e, cls = "") => `<span class="av ${cls}" style="background:${avColor(e)}">${esc(initials(e))}</span>`;
const h2 = (m) => (m / 60).toFixed(1);
const h1 = (m) => { const h = m / 60; return (Math.round(h * 10) / 10).toLocaleString("en-CA") + " h"; };
const m0 = (v) => money(v, 0);
const pct = (v, d = 0) => (v * 100).toFixed(d) + "%";
const role = () => S.me.role;
const me = () => E(S.me.emp);
const isMgr = () => role() !== "employee";
const scope = () => (role() === "employee" ? me().prop : S.me.prop);
const inScope = (pid) => scope() === "all" || pid === scope();
const rate = (e, pos) => (e ? (e.pay === "salary" ? e.wage / 2080 : e.wage) : POS[pos]?.wage || (POS[pos]?.salary || 50000) / 2080);
const shiftCost = (s) => (shiftMin(s) / 60) * rate(E(s.emp), s.pos);
const onLeave = (empId, d) => S.timeoff.find((t) => t.emp === empId && t.status === "approved" && d >= t.from && d <= t.to);
const isPublished = (pid, ws) => !!S.published[pid + "|" + ws];
const activeEmps = () => S.emps.filter((e) => e.status !== "terminated");
const typeName = { vac: "Vacation", sick: "Sick", per: "Personal" };
const balKey = { vac: "vac", sick: "sick", per: "per" };
function log(what) { S.audit.unshift({ at: new Date().toISOString(), who: `${nm(me())} (${roleName(role())})`, what }); if (S.audit.length > 400) S.audit.length = 400; }
const roleName = (r) => ({ manager: "Manager", hr: "HR & Payroll", employee: "Employee" }[r]);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
function csv(name, rows) {
  const body = rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Time and attendance helpers ----------
const shiftsOn = (empId, d) => S.shifts.filter((s) => s.emp === empId && s.date === d);
const openPunch = (empId) => S.punches.find((c) => c.emp === empId && !c.out && (c.date === today() || (c.date === addDays(today(), -1) && toMin(c.in) > nowMin())));
function exceptionsFor(empId, d) {
  const T = today();
  const out = [];
  const g = S.settings.graceMin;
  const sh = shiftsOn(empId, d);
  const pu = S.punches.filter((c) => c.emp === empId && c.date === d);
  for (const c of pu) {
    const s = S.shifts.find((x) => x.id === c.shift) || sh[0];
    if (!s) out.push({ k: "unsched", t: "Unscheduled", cls: "warn" });
    else {
      const late = span(s.start, c.in); if (late > g && late < 600) out.push({ k: "late", t: `Late ${late} min`, cls: "warn" });
      if (c.out) { const early = span(c.out, s.end); if (early > 15 && early < 600) out.push({ k: "early", t: `Left ${early} min early`, cls: "warn" }); }
    }
    if (!c.out && (d < addDays(T, -1) || (d === addDays(T, -1) && !(toMin(c.in) > nowMin())))) out.push({ k: "missed", t: "Missed punch out", cls: "bad" });
    if (c.out && span(c.in, c.out) > S.settings.breakAfterHrs * 60 && !c.brk) out.push({ k: "nobreak", t: "No meal break", cls: "warn" });
  }
  if (!pu.length && sh.length && d < T && !onLeave(empId, d)) out.push({ k: "noshow", t: "No-show", cls: "bad" });
  return out;
}
function weekMinutes(empId, ws) { // worked (actual) plus remaining scheduled minutes in the week
  const T = today(); let m = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const pu = S.punches.filter((c) => c.emp === empId && c.date === d);
    if (d < T || (d === T && pu.length)) m += pu.reduce((a, c) => a + punchMin(c), 0);
    else m += shiftsOn(empId, d).reduce((a, s) => a + shiftMin(s), 0);
  }
  return m;
}
function pending() {
  const inS = (empId) => { const e = E(empId); return e && inScope(e.prop); };
  if (role() === "employee") {
    const id = S.me.emp;
    return { to: S.timeoff.filter((t) => t.emp === id && t.status === "pending"), sw: S.swaps.filter((w) => w.status === "pending" && (w.from === id || w.to === id)), co: S.corrections.filter((c) => c.emp === id && c.status === "pending"), n: 0 };
  }
  const to = S.timeoff.filter((t) => t.status === "pending" && inS(t.emp));
  const sw = S.swaps.filter((w) => w.status === "pending" && inS(w.from || w.to));
  const co = S.corrections.filter((c) => c.status === "pending" && inS(c.emp));
  return { to, sw, co, n: to.length + sw.length + co.length };
}

// ---------- Navigation ----------
const NAV = {
  manager: [["Overview", [["home", "🏠", "Home"], ["approvals", "✅", "Approvals"]]], ["Time", [["schedule", "📅", "Schedule"], ["clock", "⏱️", "Time clock"], ["timesheets", "🧾", "Timesheets"], ["timeoff", "🌴", "Time off"]]], ["People", [["people", "👥", "People"], ["onboarding", "🚀", "Onboarding"]]], ["Insights", [["reports", "📊", "Reports"], ["settings", "⚙️", "Settings"]]]],
  hr: [["Overview", [["home", "🏠", "Home"], ["approvals", "✅", "Approvals"]]], ["Time", [["schedule", "📅", "Schedule"], ["clock", "⏱️", "Time clock"], ["timesheets", "🧾", "Timesheets"], ["timeoff", "🌴", "Time off"]]], ["Pay", [["payroll", "💵", "Payroll"]]], ["People", [["people", "👥", "People"], ["onboarding", "🚀", "Onboarding"]]], ["Insights", [["reports", "📊", "Reports"], ["settings", "⚙️", "Settings"]]]],
  employee: [["Me", [["home", "🏠", "Home"], ["schedule", "📅", "My schedule"], ["clock", "⏱️", "Clock in/out"], ["timesheets", "🧾", "My timesheet"], ["timeoff", "🌴", "Time off"], ["pay", "💵", "Pay"], ["profile", "👤", "My profile"]]]],
};
const TABS = { manager: ["home", "schedule", "clock", "approvals", "people"], hr: ["home", "schedule", "timesheets", "payroll", "approvals"], employee: ["home", "schedule", "clock", "timeoff", "pay"] };
const TABLBL = { home: "Home", schedule: "Schedule", clock: "Clock", approvals: "Approvals", people: "People", timesheets: "Time", payroll: "Payroll", timeoff: "Time off", pay: "Pay" };
const TITLES = { home: "Home", schedule: "Schedule", clock: "Time clock", timesheets: "Timesheets", timeoff: "Time off", payroll: "Payroll", approvals: "Approvals", people: "People", person: "Employee profile", onboarding: "Onboarding", reports: "Reports", settings: "Settings", pay: "Pay", profile: "My profile" };

function renderShell(route) {
  const p = pending();
  const items = NAV[role()];
  const icon = {}; items.forEach(([, l]) => l.forEach(([k, i, t]) => (icon[k] = [i, t])));
  const sect = route === "person" ? (role() === "employee" ? "profile" : "people") : route;
  $("#side-nav").innerHTML = items.map(([g, list]) => `<div class="grp">${g}</div>` + list.map(([k, i, t]) =>
    `<a href="#/${k}" class="${sect === k ? "on" : ""}"><span class="ic">${i}</span>${t}${k === "approvals" && p.n ? `<span class="cnt">${p.n}</span>` : ""}</a>`).join("")).join("");
  $("#tabbar").innerHTML = TABS[role()].map((k) => `<a href="#/${k}" class="${sect === k ? "on" : ""}"><span class="ic">${icon[k][0]}</span>${TABLBL[k]}${k === "approvals" && p.n ? `<span class="cnt">${p.n}</span>` : ""}</a>`).join("");
  $("#top-title").textContent = route === "home" ? (role() === "employee" ? "My home" : S.company) : (role() === "employee" && icon[route] ? icon[route][1] : TITLES[route] || "");
  const m = me();
  $("#who-av").outerHTML = `<span class="av" id="who-av" style="background:${avColor(m)}">${esc(initials(m))}</span>`;
  $("#who-name").textContent = nm(m);
  $("#who-role").textContent = role() === "employee" ? posName(m.pos) : roleName(role());
  const pw = $("#prop-pick-wrap");
  if (role() === "employee") pw.style.display = "none";
  else {
    pw.style.display = "";
    $("#prop-pick").innerHTML = (role() === "hr" ? `<option value="all">All properties</option>` : "") + S.props.map((x) => `<option value="${x.id}">${esc(x.short)}</option>`).join("");
    $("#prop-pick").value = S.me.prop;
  }
  $("#bell-n").textContent = isMgr() && p.n ? p.n : "";
  $("#bell").style.display = isMgr() ? "" : "none";
  $("#demo-bar").style.display = ui.hideDemo ? "none" : "";
}

// ---------- Modal and toast ----------
let modalClose = null;
function modal({ title, body, foot = "", wide = false, onMount }) {
  const mc = $("#modal-card");
  mc.className = "modal-card" + (wide ? " wide" : "");
  mc.innerHTML = `<div class="mh"><h2>${title}</h2><button class="icon-btn" data-x aria-label="Close">✕</button></div><div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ""}`;
  $("#modal").hidden = false; $("#scrim").hidden = false;
  document.body.style.overflow = "hidden";
  $("[data-x]", mc).onclick = closeModal;
  modalClose = null;
  if (onMount) onMount(mc);
  const f = mc.querySelector("input, select, textarea, .mf .btn.primary"); if (f && innerWidth > 640) f.focus();
}
function closeModal() { $("#modal").hidden = true; $("#scrim").hidden = true; document.body.style.overflow = ""; if (modalClose) modalClose(); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
let tt;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2600); }
function confirmBox(title, text, okLabel, ok, danger = false) {
  modal({ title, body: `<p>${text}</p>`, foot: `<button class="btn" data-x2>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" id="cf-ok">${okLabel}</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#cf-ok", m).onclick = () => { closeModal(); ok(); }; } });
}

// ---------- Charts ----------
let charts = [];
function chart(canvas, cfg) {
  if (!window.Chart || !canvas) return;
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  const dark = document.documentElement.dataset.theme === "dark";
  Chart.defaults.color = dark ? "#b4c0cd" : "#4a5561";
  Chart.defaults.borderColor = dark ? "#263443" : "#e2e6eb";
  const g = dark ? "#263443" : "#eef1f4";
  const sc = cfg.options && cfg.options.scales;
  if (sc) Object.values(sc).forEach((a) => { if (a.grid && a.grid.color) a.grid.color = g; });
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } } } }, cfg.options || {});
  charts.push(new Chart(canvas, cfg));
}

// ---------- Router ----------
const VIEWS = {};
const ACT = {};
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render() {
  charts.forEach((c) => c.destroy()); charts = [];
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  let r = parts[0] || "home";
  if (r === "profile") { r = "person"; parts[1] = S.me.emp; }
  const allowed = new Set(NAV[role()].flatMap(([, l]) => l.map(([k]) => k)).concat(["person"]));
  if (!allowed.has(r) && !(r === "person")) r = "home";
  if (r === "person" && role() === "employee") parts[1] = S.me.emp;
  renderShell(r === "person" && role() === "employee" ? "profile" : r);
  const v = $("#view");
  v.innerHTML = "";
  (VIEWS[r] || VIEWS.home)(v, parts.slice(1));
  $("#side").classList.remove("open");
  if (!$("#scrim").hidden && $("#modal").hidden) $("#scrim").hidden = true;
}
function refresh() { save(); const y = scrollY; render(); scrollTo(0, y); }
window.addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const fn = ACT[a.dataset.act];
  if (fn) { e.preventDefault(); fn(a, e); }
});

// ---------- Top bar controls ----------
$("#menu-btn").onclick = () => { $("#side").classList.add("open"); $("#scrim").hidden = false; };
$("#scrim").onclick = () => { if (!$("#modal").hidden) return closeModal(); $("#side").classList.remove("open"); $("#scrim").hidden = true; };
$("#prop-pick").onchange = (e) => { S.me.prop = e.target.value; save(); render(); };
$("#bell").onclick = () => go("#/approvals");
$("#theme-btn").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("nihal.theme", t); } catch (e) { /* ignore */ }
  window.dispatchEvent(new Event("themechange"));
};
window.addEventListener("themechange", () => { if (charts.length) render(); });
$("#demo-x").onclick = () => { ui.hideDemo = true; saveUI(); $("#demo-bar").style.display = "none"; };
$("#who-btn").onclick = () => {
  const P = S.personas;
  const opt = (r, id, t, s) => { const e = E(id); return `<button class="role-opt ${role() === r && S.me.emp === id ? "on" : ""}" data-r="${r}" data-id="${id}">${av(e)}<span><b>${t}</b><small>${esc(nm(e))} · ${esc(s)}</small></span></button>`; };
  const emps = activeEmps().filter((e) => e.status === "active").sort((a, b) => a.prop.localeCompare(b.prop) || a.last.localeCompare(b.last));
  modal({
    title: "View as",
    body: `<p class="muted">Switch between the three ways people use the system. Everything stays in sync, so an approval made as a manager shows up for the employee.</p>
      ${opt("manager", P.manager, "Hotel manager", "General Manager, " + prop(E(P.manager).prop).short)}
      ${opt("hr", P.hr, "HR and payroll", "Company-wide HR and payroll")}
      ${opt("employee", P.employee, "Employee", posName(E(P.employee).pos) + ", " + prop(E(P.employee).prop).short)}
      <div class="field mt"><label for="any-emp">Or view as any employee</label><select id="any-emp"><option value="">Choose a person…</option>${S.props.map((p) => `<optgroup label="${esc(p.short)}">${emps.filter((e) => e.prop === p.id).map((e) => `<option value="${e.id}">${esc(nm(e))} · ${esc(posName(e.pos))}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <div class="banner info mt"><span>Demo PINs for the time-clock kiosk: <b>${esc(nm(E(P.employee)))}</b> is <b>${E(P.employee).pin}</b>. Every PIN is on the person's profile.</span></div>`,
    foot: `<button class="btn danger left" id="rs">Reset demo data</button><button class="btn" data-x2>Close</button>`,
    onMount: (m) => {
      $$(".role-opt", m).forEach((b) => (b.onclick = () => setRole(b.dataset.r, b.dataset.id)));
      $("#any-emp", m).onchange = (e) => e.target.value && setRole("employee", e.target.value);
      $("[data-x2]", m).onclick = closeModal;
      $("#rs", m).onclick = () => confirmBox("Reset demo data?", "This replaces everything in this browser with a fresh sample company. Your changes will be lost.", "Reset", resetDemo, true);
    },
  });
};
function setRole(r, id) {
  S.me.role = r; S.me.emp = id;
  S.me.prop = r === "hr" ? "all" : E(id).prop;
  save(); closeModal(); go("#/home"); toast(`Now viewing as ${nmId(id)} (${roleName(r)})`);
}
// Keep the live clocks ticking
setInterval(() => { $$("[data-clock]").forEach((el) => (el.textContent = new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }))); }, 15000);

// Expose to the view files
Object.assign(window, { WFAPP: { get S() { return S; }, ui, save, refresh, render, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, avColor, initials, h1, h2, m0, pct, role, me, isMgr, scope, inScope, rate, shiftCost, onLeave, isPublished, activeEmps, typeName, balKey, roleName, greeting, shiftsOn, openPunch, exceptionsFor, weekMinutes, pending, resetDemo, setModalClose: (f) => (modalClose = f) } });
})();
