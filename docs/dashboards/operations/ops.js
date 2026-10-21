// Hotel Operations Hub: state, helpers, app shell, dashboard, search and alerts.
// Module views live in ops-views-*.js. All files share these top-level names.
"use strict";
const D = window.OPSDATA;
const { HOUR, DAY, MIN } = D;
const STORE_KEY = "hbi.ops.v1";
const LABOUR_RATE = 38; // $ per technician hour, used for repair cost roll-ups

const MODS = {
  dashboard: { ic: "🏠", name: "Dashboard", group: "Overview" },
  myrooms: { ic: "🧹", name: "My rooms", group: "Overview" },
  reports: { ic: "📊", name: "Reports", group: "Overview" },
  housekeeping: { ic: "🛏️", name: "Housekeeping", group: "Rooms" },
  inspections: { ic: "✅", name: "Inspections", group: "Rooms" },
  workorders: { ic: "🔧", name: "Work orders", group: "Maintenance" },
  pm: { ic: "🗓️", name: "Preventive maintenance", short: "PM", group: "Maintenance" },
  assets: { ic: "⚙️", name: "Assets", group: "Maintenance" },
  requests: { ic: "🛎️", name: "Guest requests", short: "Requests", group: "Guests" },
  lostfound: { ic: "🧳", name: "Lost & found", group: "Guests" },
  logbook: { ic: "📓", name: "Logbook", group: "Team" },
  inventory: { ic: "📦", name: "Inventory", group: "Team" },
  team: { ic: "👥", name: "Team & roles", short: "Team", group: "Team" },
};
const GROUPS = ["Overview", "Rooms", "Maintenance", "Guests", "Team"];

let S = null;            // persisted state
const U = { f: {}, limit: {}, sel: new Set(), selecting: false, q: "" }; // UI-only state
const VIEWS = {};        // module renderers, registered by the view files

/* ---------- state ---------- */
function freshState() {
  const now = Date.now();
  const data = {};
  D.HOTELS.forEach((h, i) => { data[h.id] = D.seedHotel(h, i, now); });
  return { v: 1, seededAt: now, touched: false, hotel: "GTR", role: "gm", users: {}, sim: false, welcome: true, templates: JSON.parse(JSON.stringify(D.INSPECTION_TEMPLATES)), data };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const sameDay = new Date(s.seededAt).toDateString() === new Date().toDateString();
      // Untouched demo data is refreshed each day so "today" always looks like today.
      if (s && s.v === 1 && s.data && (s.touched || sameDay)) { S = s; return; }
    }
  } catch (e) { /* fall through to fresh data */ }
  S = freshState();
  save(true);
}
let saveTimer = null, warnedStorage = false;
function save(now) {
  clearTimeout(saveTimer);
  const go = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
    catch (e) { if (!warnedStorage) { warnedStorage = true; toast("This browser would not save the demo data (private mode or storage full). Changes last until you close the tab."); } }
  };
  if (now) go(); else saveTimer = setTimeout(go, 250);
}
function touch() { S.touched = true; save(); }
const H = () => S.data[S.hotel];
const hotelInfo = (id = S.hotel) => D.HOTELS.find(h => h.id === id);
const role = () => D.ROLES[S.role];
function me() {
  const h = H();
  const key = S.hotel + ":" + S.role;
  let id = S.users[key];
  let s = h.staff.find(x => x.id === id && x.role === S.role);
  if (!s) { s = h.staff.find(x => x.role === S.role) || h.staff[0]; S.users[key] = s.id; }
  return s;
}
const staff = id => H().staff.find(s => s.id === id);
const sname = id => (staff(id) || {}).name || (id ? "Former staff" : "Unassigned");
const can = what => ({
  hkEdit: ["gm", "eh", "ra"], woManage: ["gm", "ce", "mt"], woAssign: ["gm", "ce"], pmEdit: ["gm", "ce", "mt"], invEdit: ["gm", "eh", "ce", "mt"],
  inspect: ["gm", "eh", "ce"], teamEdit: ["gm", "eh", "ce"], pin: ["gm", "eh", "ce"], reqManage: ["gm", "fd", "eh", "ce"], tplEdit: ["gm", "eh"],
}[what] || []).includes(S.role);

function nextId(prefix) { const h = H(); h.seq[prefix] = (h.seq[prefix] || 0) + 1; return prefix + "-" + h.seq[prefix]; }
function logActivity(text, link) { const h = H(); h.activity.unshift({ t: Date.now(), by: me().id, text, link }); if (h.activity.length > 120) h.activity.length = 120; }

/* ---------- formatting ---------- */
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (v, d = 0) => "$" + Number(v || 0).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (v, d = 0) => Number(v || 0).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 0) => (v == null || isNaN(v) ? "–" : (v * 100).toFixed(d) + "%");
function when(t) {
  if (!t) return "–";
  const d = new Date(t), now = new Date();
  const time = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return "Today " + time;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday " + time;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) + ", " + time;
}
const dateOnly = t => new Date(t).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
function dur(ms) {
  if (ms == null || isNaN(ms)) return "–";
  const m = Math.round(Math.abs(ms) / MIN);
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "h " + (m % 60 ? (m % 60) + "m" : "");
  return Math.round(h / 24) + " days";
}
function ago(t) { const ms = Date.now() - t; return ms < MIN ? "just now" : dur(ms) + " ago"; }
function initials(name) { return String(name || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase(); }
function avatar(id) {
  const n = sname(id);
  let hsh = 0; for (const c of String(id || n)) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  const hues = [210, 160, 20, 280, 340, 40, 190, 120];
  return `<span class="av" style="background:hsl(${hues[hsh % hues.length]} 55% 42%)" title="${esc(n)}">${esc(initials(n))}</span>`;
}
const PRI_CHIP = { Low: "", Normal: "blue", High: "amber", Urgent: "red" };
const priChip = p => `<span class="chip ${PRI_CHIP[p] || ""}">${esc(p)}</span>`;
const WO_CHIP = { "Open": "blue", "In progress": "amber", "On hold": "purple", "Completed": "green" };
const REQ_CHIP = { "New": "red", "Acknowledged": "amber", "In progress": "amber", "Resolved": "green", "Closed": "" };
const TYPE_CHIP = { Request: "blue", Complaint: "amber", Compliment: "green", Incident: "red" };
const chip = (text, cls) => `<span class="chip ${cls || ""}">${esc(text)}</span>`;
const hkChip = s => `<span class="st-chip ${s}">${esc(D.HK_LABEL[s])}</span>`;
const isOverdue = w => w.status !== "Completed" && w.dueAt < Date.now();

function opt(list, sel, labels) {
  return list.map(v => { const [val, lab] = Array.isArray(v) ? v : [v, labels ? labels[v] : v]; return `<option value="${esc(val)}"${String(val) === String(sel) ? " selected" : ""}>${esc(lab)}</option>`; }).join("");
}
function staffOpts(sel, filter, blank = "Unassigned") {
  const list = H().staff.filter(s => s.active && (!filter || filter(s)));
  return (blank ? `<option value="">${esc(blank)}</option>` : "") + list.map(s => `<option value="${s.id}"${s.id === sel ? " selected" : ""}>${esc(s.name)} · ${esc(D.ROLES[s.role].name)}</option>`).join("");
}
function readForm(root) {
  const o = {};
  root.querySelectorAll("[name]").forEach(el => { o[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
  return o;
}
function csvDownload(name, rows) {
  const text = rows.map(r => r.map(v => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast("Downloaded " + name);
}
function printDoc(title, html) {
  const w = window.open("", "_blank");
  if (!w) { toast("Allow pop-ups to print."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:14px/1.5 Inter,system-ui,sans-serif;color:#18212b;margin:28px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}
    table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cfd6de;padding:5px 7px;text-align:left}th{background:#f3f5f8}
    .muted{color:#6b7682}.pb{page-break-after:always}</style></head><body>${html}<p class="muted" style="margin-top:24px">${esc(hotelInfo().name)} · printed ${esc(when(Date.now()))} · Hotel Operations Hub demo</p></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

/* ---------- toasts and modals ---------- */
function toast(msg, undo) {
  const box = document.getElementById("toasts");
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  if (undo) { const b = document.createElement("button"); b.textContent = "Undo"; b.onclick = () => { undo(); t.remove(); }; t.appendChild(b); }
  box.appendChild(t);
  setTimeout(() => t.remove(), undo ? 6000 : 3200);
}
let modalStack = null;
function modal({ title, body, foot = "", wide = false, onClose }) {
  closeModal(true);
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mh"><h2>${title}</h2><button class="x" data-act="close-modal" aria-label="Close">×</button></div>
    <div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ""}</div>`;
  ovl.addEventListener("mousedown", e => { if (e.target === ovl) closeModal(); });
  document.body.appendChild(ovl);
  document.body.style.overflow = "hidden";
  modalStack = { el: ovl, onClose };
  const first = ovl.querySelector(".mb input:not([type=checkbox]), .mb select, .mb textarea");
  if (first && window.innerWidth > 640) first.focus();
  return ovl.querySelector(".modal");
}
function recordModal(mod, opts) {
  return modal(Object.assign({}, opts, { onClose: () => { if (route().id) history.replaceState(null, "", "#/" + mod); } }));
}
function closeModal(silent) {
  if (!modalStack) return;
  const m = modalStack; modalStack = null;
  m.el.remove(); document.body.style.overflow = "";
  if (silent) return;
  if (m.onClose) m.onClose();
  if (pendingRender) { pendingRender = false; render(); }
}
const modalEl = () => modalStack && modalStack.el.querySelector(".modal");
function confirmBox(text, yes, label = "Confirm") {
  modal({ title: "Please confirm", body: `<p>${esc(text)}</p>`, foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="cf-yes">${esc(label)}</button>` });
  modalEl().querySelector("#cf-yes").onclick = () => { closeModal(true); yes(); };
}

/* ---------- small charts (SVG) ---------- */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#8a63d2"];
function barChart(labels, series, { h = 200, stacked = false } = {}) {
  const W = 640, pad = { l: 34, r: 8, t: 10, b: 26 };
  const n = labels.length, iw = W - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(1, ...labels.map((_, i) => stacked ? series.reduce((s, x) => s + x.values[i], 0) : Math.max(...series.map(x => x.values[i]))));
  const nice = niceMax(max), gw = iw / n, bw = stacked ? gw * 0.62 : (gw * 0.72) / series.length;
  let g = "";
  for (let k = 0; k <= 4; k++) { const y = pad.t + ih - ih * k / 4; g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${num(nice * k / 4)}</text>`; }
  labels.forEach((lab, i) => {
    let acc = 0;
    series.forEach((s, j) => {
      const v = s.values[i], bh = ih * v / nice;
      const x = stacked ? pad.l + gw * i + (gw - bw) / 2 : pad.l + gw * i + gw * 0.14 + bw * j;
      const y = pad.t + ih - bh - (stacked ? ih * acc / nice : 0);
      if (stacked) acc += v;
      g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 1.5).toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="2" fill="${s.color || COLORS[j]}"><title>${esc(lab)} · ${esc(s.name)}: ${num(v, v % 1 ? 1 : 0)}</title></rect>`;
    });
    const every = Math.ceil(n / 10);
    if (i % every === 0) g += `<text x="${pad.l + gw * i + gw / 2}" y="${h - 8}" text-anchor="middle">${esc(lab)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img">${g}</svg>` + legend(series);
}
function lineChart(labels, series, { h = 200, min0 = true, suffix = "" } = {}) {
  const W = 640, pad = { l: 38, r: 10, t: 10, b: 26 };
  const n = labels.length, iw = W - pad.l - pad.r, ih = h - pad.t - pad.b;
  const vals = series.flatMap(s => s.values.filter(v => v != null));
  const hi = niceMax(Math.max(1, ...vals)), lo = min0 ? 0 : Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  const X = i => pad.l + (n === 1 ? iw / 2 : iw * i / (n - 1)), Y = v => pad.t + ih - ih * (v - lo) / (hi - lo || 1);
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v); g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${num(v)}${suffix}</text>`; }
  series.forEach((s, j) => {
    const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(v)]);
    let d = "", pen = false;
    pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color || COLORS[j]}" stroke-width="2.2" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => { if (p) g += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${s.color || COLORS[j]}"><title>${esc(labels[i])} · ${esc(s.name)}: ${num(s.values[i], 1)}${suffix}</title></circle>`; });
  });
  const every = Math.ceil(n / 10);
  labels.forEach((lab, i) => { if (i % every === 0) g += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle">${esc(lab)}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img">${g}</svg>` + legend(series);
}
function legend(series) { return series.length > 1 ? `<div class="chart-legend">${series.map((s, j) => `<span><i style="background:${s.color || COLORS[j]}"></i>${esc(s.name)}</span>`).join("")}</div>` : ""; }
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function hbars(items, { fmt = v => num(v), cls = "blue", max } = {}) {
  if (!items.length) return `<div class="empty">No data in this range.</div>`;
  const mx = max || Math.max(1, ...items.map(i => i[1]));
  return `<div class="hbars">${items.map(([lab, v, c]) => `<div class="hb"><span title="${esc(lab)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(lab)}</span><div class="bar ${c || cls}"><i style="width:${Math.min(100, v / mx * 100).toFixed(1)}%"></i></div><span class="v">${fmt(v)}</span></div>`).join("")}</div>`;
}
const dayKey = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
function dayBuckets(days) { const out = []; const t0 = dayKey(Date.now()); for (let i = days - 1; i >= 0; i--) out.push(t0 - i * DAY); return out; }
const shortDay = t => new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

/* ---------- shared counts ---------- */
function counts() {
  const h = H(), now = Date.now(), m = me();
  return {
    woOverdue: h.workOrders.filter(isOverdue).length,
    woOpen: h.workOrders.filter(w => w.status !== "Completed").length,
    woMine: h.workOrders.filter(w => w.status !== "Completed" && w.assignee === m.id).length,
    reqOpen: h.requests.filter(r => ["New", "Acknowledged", "In progress"].includes(r.status)).length,
    reqNew: h.requests.filter(r => r.status === "New").length,
    pmOverdue: h.pm.filter(p => p.nextDue < now).length,
    lowStock: h.inventory.filter(i => i.onHand <= i.reorder).length,
    logUnread: h.log.filter(e => !e.readBy.includes(m.id) && e.at > now - 3 * DAY).length,
    lfStored: h.lostFound.filter(x => x.status === "Stored").length,
    toClean: h.rooms.filter(r => r.hk === "Dirty" || r.hk === "Cleaning").length,
    myRooms: h.rooms.filter(r => r.att === m.id && (r.hk === "Dirty" || r.hk === "Cleaning")).length,
    arrNotReady: h.rooms.filter(r => r.due === "ARR" && r.hk !== "Inspected" && r.hk !== "Clean" && r.hk !== "OOO" && r.hk !== "OOS").length,
  };
}
function sideCount(mod, c) {
  return { workorders: [c.woOverdue, "red", "overdue"], requests: [c.reqOpen, c.reqNew ? "red" : "n", "open"], pm: [c.pmOverdue, "red", "overdue"], inventory: [c.lowStock, "red", "low"],
    logbook: [c.logUnread, "n", "unread"], myrooms: [c.myRooms, "n", "left"], housekeeping: [c.toClean, "n", "to clean"], lostfound: [c.lfStored, "n", "stored"] }[mod];
}

/* ---------- shell ---------- */
function route() {
  const [mod, id] = (location.hash.replace(/^#\/?/, "") || "").split("/");
  return { mod: mod || "", id: id ? decodeURIComponent(id) : "" };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
let pendingRender = false;
function render() {
  if (modalStack) { pendingRender = true; renderSide(); return; }
  pendingRender = false;
  const r = route();
  const mods = role().mods;
  if (!mods.includes(r.mod)) { if (r.mod !== mods[0]) { history.replaceState(null, "", "#/" + mods[0]); } r.mod = mods[0]; r.id = ""; }
  renderSide(r.mod);
  renderBottom(r.mod);
  const main = document.getElementById("main");
  const m = MODS[r.mod];
  const c = counts();
  const alertsN = alerts().length;
  const newMenu = quickCreate().length ? `<button class="btn primary" data-act="quick-new">＋ <span class="hide-sm">New</span></button>` : "";
  document.title = m.name + " · Hotel Operations Hub";
  main.innerHTML = `
    <div class="ops-top">
      <div class="ttl"><h1>${m.ic} ${esc(m.name)}</h1><div class="ops-sub" data-act="side-open" title="Switch property or role">${esc(hotelInfo().name)} · ${esc(dateOnly(Date.now()))} · ${esc(me().name)}, ${esc(role().name)}</div></div>
      <div class="grow"></div>
      <div class="search"><input type="search" id="gsearch" placeholder="Search rooms, work orders, guests…" value="${esc(U.q)}" aria-label="Search"></div>
      <button class="btn bell" data-act="alerts" aria-label="Alerts">🔔${alertsN ? `<b>${alertsN}</b>` : ""}</button>
      ${newMenu}
    </div>
    <div id="view"></div>`;
  const view = main.querySelector("#view");
  if (U.q.trim()) view.innerHTML = renderSearch(U.q.trim());
  else view.innerHTML = (VIEWS[r.mod] || (() => "<div class='panel'>Coming soon.</div>"))(r.id, c);
  if (VIEWS[r.mod + "_after"]) VIEWS[r.mod + "_after"](view, r.id);
  // Deep link to a record opens its detail dialog.
  if (r.id && OPENERS[r.mod] && !U.q) { const id = r.id; setTimeout(() => OPENERS[r.mod](id, true), 0); }
}
function renderSide(cur) {
  cur = cur || route().mod;
  const side = document.getElementById("side");
  const c = counts();
  const mods = role().mods;
  const h = H();
  const roleStaff = h.staff.filter(s => s.role === S.role && s.active);
  let html = `<div class="ctx">
      <label for="sel-hotel">Property</label><select id="sel-hotel">${opt(D.HOTELS.map(x => [x.id, x.name]), S.hotel)}</select>
      <label for="sel-role">View as role</label><select id="sel-role">${opt(Object.entries(D.ROLES).map(([k, v]) => [k, v.name]), S.role)}</select>
      ${roleStaff.length > 1 ? `<label for="sel-user">Signed in as</label><select id="sel-user">${opt(roleStaff.map(s => [s.id, s.name]), me().id)}</select>` : `<div style="font-size:13px;color:var(--ink-3);margin-top:8px">Signed in as <b style="color:var(--ink)">${esc(me().name)}</b></div>`}
    </div>`;
  GROUPS.forEach(g => {
    const items = mods.filter(k => MODS[k].group === g);
    if (!items.length) return;
    html += `<div class="side-group">${g}</div>`;
    items.forEach(k => {
      const sc = sideCount(k, c);
      html += `<a class="side-link${k === cur ? " active" : ""}" href="#/${k}"><span class="ic">${MODS[k].ic}</span>${esc(MODS[k].name)}${sc && sc[0] ? `<span class="cnt ${sc[1] === "n" ? "n" : ""}" title="${sc[0]} ${sc[2]}">${sc[0]}</span>` : ""}</a>`;
    });
  });
  html += `<div class="side-foot">
      <label style="display:flex;gap:8px;align-items:center;cursor:pointer;color:var(--ink-2)"><input type="checkbox" id="sim-toggle"${S.sim ? " checked" : ""}> Live activity simulation</label>
      <p style="margin:8px 0 0">Demo data lives only in this browser. Nothing is sent anywhere.</p>
      <button class="btn sm" data-act="reset-demo">Reset demo data</button>
    </div>`;
  side.innerHTML = html;
}
function renderBottom(cur) {
  const mods = role().mods.slice(0, 4);
  document.getElementById("bnav").innerHTML = mods.map(k => `<a href="#/${k}" class="${k === cur ? "active" : ""}"><span class="ic">${MODS[k].ic}</span>${esc(MODS[k].short || MODS[k].name)}</a>`).join("") +
    `<button data-act="side-open"><span class="ic">☰</span>More</button>`;
}

/* ---------- dashboard ---------- */
VIEWS.dashboard = function (_, c) {
  const h = H(), now = Date.now(), t0 = dayKey(now);
  const rooms = h.rooms;
  const sellable = rooms.filter(r => r.hk !== "OOO" && r.hk !== "OOS");
  const ready = sellable.filter(r => r.hk === "Clean" || r.hk === "Inspected").length;
  const reqToday = h.requests.filter(r => r.createdAt >= t0 && r.ackAt);
  const avgAck = reqToday.length ? reqToday.reduce((s, r) => s + (r.ackAt - r.createdAt), 0) / reqToday.length : null;
  const insp7 = h.inspections.filter(x => x.at > now - 7 * DAY);
  const inspAvg = insp7.length ? insp7.reduce((s, x) => s + x.score, 0) / insp7.length : null;
  const occ = rooms.filter(r => r.occ === "OCC").length;
  const k = (label, value, sub, href, cls = "") => `<a class="kpi ${cls}" href="${href}"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></a>`;
  const mods = role().mods;
  const tiles = [];
  if (mods.includes("housekeeping") || mods.includes("myrooms")) {
    tiles.push(k("Rooms ready", pct(ready / sellable.length), `${ready} of ${sellable.length} sellable rooms`, "#/housekeeping"));
    tiles.push(k("Rooms to clean", c.toClean, `${rooms.filter(r => r.hk === "Cleaning").length} in progress now`, "#/housekeeping"));
    tiles.push(k("Arrivals not ready", c.arrNotReady, `${rooms.filter(r => r.due === "ARR").length} arrivals today`, "#/housekeeping", c.arrNotReady ? "alert" : "ok"));
  }
  tiles.push(k("Occupancy tonight", pct(occ / rooms.length), `${occ} of ${rooms.length} rooms · ${rooms.filter(r => r.hk === "OOO").length} out of order`, mods.includes("housekeeping") ? "#/housekeeping" : "#/dashboard"));
  if (mods.includes("workorders")) {
    tiles.push(k("Open work orders", c.woOpen, `${h.workOrders.filter(w => w.status === "Completed" && w.completedAt >= t0).length} completed today`, "#/workorders"));
    tiles.push(k("Overdue work orders", c.woOverdue, "past their due time", "#/workorders", c.woOverdue ? "alert" : "ok"));
  }
  if (mods.includes("requests")) {
    tiles.push(k("Open guest requests", c.reqOpen, `${c.reqNew} not yet acknowledged`, "#/requests", c.reqNew ? "alert" : ""));
    tiles.push(k("Avg response today", avgAck == null ? "–" : dur(avgAck), "time to acknowledge", "#/requests"));
  }
  if (mods.includes("pm")) tiles.push(k("PM overdue", c.pmOverdue, `${h.pm.filter(p => p.nextDue >= now && p.nextDue < now + 7 * DAY).length} due in the next 7 days`, "#/pm", c.pmOverdue ? "alert" : "ok"));
  if (mods.includes("inspections")) tiles.push(k("Inspection score", inspAvg == null ? "–" : Math.round(inspAvg) + "%", `average of ${insp7.length} in 7 days`, "#/inspections"));
  if (mods.includes("inventory")) tiles.push(k("Low stock items", c.lowStock, "at or below reorder point", "#/inventory", c.lowStock ? "alert" : "ok"));

  // Housekeeping progress per attendant
  const ras = h.staff.filter(s => s.role === "ra" && s.active);
  const hkRows = ras.map(s => {
    const mine = rooms.filter(r => r.att === s.id);
    const done = mine.filter(r => r.hk === "Clean" || r.hk === "Inspected").length;
    return { s, total: mine.length, done };
  }).filter(x => x.total);
  const allAssigned = hkRows.reduce((a, x) => a + x.total, 0), allDone = hkRows.reduce((a, x) => a + x.done, 0);

  const att = alerts().slice(0, 8);
  const mine = myTasks();
  const feed = h.activity.slice(0, 10);

  const welcome = S.welcome ? `<div class="welcome"><p><b>Welcome to the Hotel Operations Hub demo.</b> Pick a property and a role on the left (on a phone, tap More at the bottom, or the hotel name under the page title) to see what a general manager, front desk agent, housekeeper or engineer would see. Every button works, and your changes are saved in this browser.</p><button class="btn sm" data-act="dismiss-welcome">Got it</button></div>` : "";
  const portfolio = S.role === "gm" ? `<div class="panel"><div class="ph"><h2>All properties</h2><span class="grow"></span><span class="muted" style="font-size:13px">Tap a hotel to switch</span></div><div class="tblw"><table><thead><tr><th>Property</th><th class="num">Rooms ready</th><th class="num">Open WOs</th><th class="num">Overdue</th><th class="num">Open requests</th><th class="num">Insp. score (7d)</th></tr></thead><tbody>${D.HOTELS.map(x => {
    const d = S.data[x.id]; const sell = d.rooms.filter(r => r.hk !== "OOO" && r.hk !== "OOS");
    const rd = sell.filter(r => r.hk === "Clean" || r.hk === "Inspected").length;
    const i7 = d.inspections.filter(q => q.at > now - 7 * DAY);
    const od = d.workOrders.filter(isOverdue).length;
    return `<tr style="cursor:pointer" data-act="switch-hotel" data-id="${x.id}"><td><b>${esc(x.name)}</b>${x.id === S.hotel ? " " + chip("Viewing", "blue") : ""}</td><td class="num">${pct(rd / sell.length)}</td><td class="num">${d.workOrders.filter(w => w.status !== "Completed").length}</td><td class="num" style="color:${od ? "var(--bad)" : "inherit"}">${od}</td><td class="num">${d.requests.filter(r => ["New", "Acknowledged", "In progress"].includes(r.status)).length}</td><td class="num">${i7.length ? Math.round(i7.reduce((s, q) => s + q.score, 0) / i7.length) + "%" : "–"}</td></tr>`;
  }).join("")}</tbody></table></div></div>` : "";

  return `${welcome}<div class="kpis">${tiles.join("")}</div>
  <div class="cols c21">
    <div class="stack">
      <div class="panel"><div class="ph"><h2>Needs attention</h2><span class="grow"></span><button class="btn sm" data-act="alerts">See all ${alerts().length}</button></div>
        ${att.length ? `<div class="rows">${att.map(a => `<div class="row" data-act="nav" data-href="${a.link}"><div><div class="t">${a.icon} ${esc(a.title)}</div><div class="m">${esc(a.sub)}</div></div><div class="r">${chip(a.tag, a.cls)}</div></div>`).join("")}</div>` : `<div class="empty">Nothing needs attention right now. 🎉</div>`}
      </div>
      ${mine.length ? `<div class="panel"><div class="ph"><h2>Assigned to me</h2></div><div class="rows">${mine.slice(0, 8).map(a => `<div class="row" data-act="nav" data-href="${a.link}"><div><div class="t"><span class="id">${esc(a.id)}</span>${esc(a.title)}</div><div class="m">${esc(a.sub)}</div></div><div class="r">${a.chip}</div></div>`).join("")}</div></div>` : ""}
      ${portfolio}
    </div>
    <div class="stack">
      ${hkRows.length && (role().mods.includes("housekeeping")) ? `<div class="panel"><div class="ph"><h2>Housekeeping progress</h2><span class="grow"></span><b>${allAssigned ? Math.round(allDone / allAssigned * 100) : 0}%</b></div>
        <div class="bar" style="height:12px;margin-bottom:10px"><i style="width:${allAssigned ? allDone / allAssigned * 100 : 0}%"></i></div>
        ${hkRows.map(x => `<div class="prog"><span>${esc(x.s.name)}</span><div class="bar"><i style="width:${x.done / x.total * 100}%"></i></div><span class="r">${x.done}/${x.total}</span></div>`).join("")}</div>` : ""}
      <div class="panel"><div class="ph"><h2>Recent activity</h2></div>
        ${feed.length ? `<ul class="feed">${feed.map(a => `<li>${avatar(a.by)}<div><div><b>${esc(sname(a.by))}</b> ${a.link ? `<a href="${a.link}">${esc(a.text)}</a>` : esc(a.text)}</div><div class="w">${esc(ago(a.t))}</div></div></li>`).join("")}</ul>` : `<div class="empty">No activity yet today.</div>`}
      </div>
    </div>
  </div>`;
};
function myTasks() {
  const h = H(), m = me(), out = [];
  h.workOrders.filter(w => w.assignee === m.id && w.status !== "Completed").forEach(w => out.push({ id: w.id, title: w.title, sub: `${w.location} · due ${when(w.dueAt)}`, chip: isOverdue(w) ? chip("Overdue", "red") : chip(w.status, WO_CHIP[w.status]), link: "#/workorders/" + w.id, t: w.dueAt }));
  h.requests.filter(r => r.assignee === m.id && ["New", "Acknowledged", "In progress"].includes(r.status)).forEach(r => out.push({ id: r.id, title: r.title, sub: `Room ${r.room} · ${r.guest} · ${ago(r.createdAt)}`, chip: chip(r.status, REQ_CHIP[r.status]), link: "#/requests/" + r.id, t: r.createdAt }));
  h.pm.filter(p => p.assignee === m.id && p.nextDue < Date.now() + 3 * DAY).forEach(p => out.push({ id: p.id, title: p.title, sub: "Due " + dateOnly(p.nextDue), chip: p.nextDue < Date.now() ? chip("Overdue", "red") : chip("Due soon", "amber"), link: "#/pm/" + p.id, t: p.nextDue }));
  return out.sort((a, b) => a.t - b.t);
}
function alerts() {
  const h = H(), now = Date.now(), out = [], mods = role().mods;
  if (mods.includes("workorders")) h.workOrders.filter(isOverdue).sort((a, b) => a.dueAt - b.dueAt).forEach(w => out.push({ icon: "🔧", title: `${w.id} ${w.title}`, sub: `${w.location} · ${sname(w.assignee)} · overdue by ${dur(now - w.dueAt)}`, tag: w.priority === "Urgent" ? "Urgent" : "Overdue", cls: "red", link: "#/workorders/" + w.id, rank: w.priority === "Urgent" ? 0 : 2 }));
  if (mods.includes("requests")) h.requests.filter(r => ["New", "Acknowledged", "In progress"].includes(r.status)).forEach(r => {
    const age = now - r.createdAt;
    if (r.status === "New" || r.type === "Incident" || r.type === "Complaint" || age > 30 * MIN)
      out.push({ icon: r.type === "Incident" ? "🚨" : "🛎️", title: `${r.title}`, sub: `Room ${r.room} · ${r.guest} · ${r.status.toLowerCase()} for ${dur(age)}`, tag: r.type, cls: r.type === "Incident" || r.status === "New" ? "red" : "amber", link: "#/requests/" + r.id, rank: r.status === "New" ? 0 : 1 });
  });
  if (mods.includes("housekeeping")) h.rooms.filter(r => r.due === "ARR" && (r.vip || r.rush) && r.hk !== "Inspected" && r.hk !== "OOO" && r.hk !== "OOS").forEach(r => out.push({ icon: "🛏️", title: `Room ${r.no} ${r.vip ? "VIP" : "rush"} arrival not ready`, sub: `${D.HK_LABEL[r.hk]} · ${sname(r.att)}`, tag: r.vip ? "VIP" : "Rush", cls: "amber", link: "#/housekeeping/" + r.no, rank: 1 }));
  if (mods.includes("pm")) h.pm.filter(p => p.nextDue < now).forEach(p => out.push({ icon: "🗓️", title: p.title, sub: `PM overdue by ${dur(now - p.nextDue)} · ${sname(p.assignee)}`, tag: "PM", cls: "red", link: "#/pm/" + p.id, rank: 3 }));
  if (mods.includes("inventory")) h.inventory.filter(i => i.onHand <= i.reorder).forEach(i => out.push({ icon: "📦", title: `${i.name} low`, sub: `${i.onHand} on hand, reorder at ${i.reorder} (${i.unit})`, tag: i.onHand === 0 ? "Out" : "Low", cls: i.onHand === 0 ? "red" : "amber", link: "#/inventory", rank: 4 }));
  if (mods.includes("logbook")) h.log.filter(e => e.priority === "Important" && !e.readBy.includes(me().id) && e.at > now - 2 * DAY).forEach(e => out.push({ icon: "📓", title: "Unread important log entry", sub: `${sname(e.author)}: ${e.text.slice(0, 70)}…`, tag: e.dept, cls: "blue", link: "#/logbook", rank: 2 }));
  return out.sort((a, b) => a.rank - b.rank);
}
function openAlerts() {
  const a = alerts();
  modal({ title: `🔔 Alerts (${a.length})`, wide: true, body: a.length ? `<div class="rows">${a.map(x => `<div class="row" data-act="nav" data-href="${x.link}"><div><div class="t">${x.icon} ${esc(x.title)}</div><div class="m">${esc(x.sub)}</div></div><div class="r">${chip(x.tag, x.cls)}</div></div>`).join("")}</div>` : `<div class="empty">No alerts for your role at ${esc(hotelInfo().name)}.</div>` });
}

/* ---------- search ---------- */
function renderSearch(q) {
  const h = H(), ql = q.toLowerCase(), m = role().mods;
  const hit = (...v) => v.some(x => String(x || "").toLowerCase().includes(ql));
  const sec = (title, rows) => rows.length ? `<div class="panel"><div class="ph"><h2>${title} (${rows.length})</h2></div><div class="rows">${rows.slice(0, 15).join("")}</div></div>` : "";
  const out = [];
  if (m.includes("housekeeping") || m.includes("myrooms")) out.push(sec("Rooms", h.rooms.filter(r => hit(r.no, r.type, r.note)).map(r => `<div class="row" data-act="nav" data-href="#/housekeeping/${r.no}"><div><div class="t">Room ${r.no}</div><div class="m">${esc(r.type)} · ${esc(D.OCC_LABEL[r.occ])} ${esc(D.DUE_LABEL[r.due])} · ${esc(sname(r.att))}</div></div><div class="r">${hkChip(r.hk)}</div></div>`)));
  if (m.includes("workorders")) out.push(sec("Work orders", h.workOrders.filter(w => hit(w.id, w.title, w.location, w.category, sname(w.assignee))).map(w => `<div class="row" data-act="nav" data-href="#/workorders/${w.id}"><div><div class="t"><span class="id">${w.id}</span>${esc(w.title)}</div><div class="m">${esc(w.location)} · ${esc(sname(w.assignee))} · ${esc(when(w.createdAt))}</div></div><div class="r">${chip(w.status, WO_CHIP[w.status])}</div></div>`)));
  if (m.includes("requests")) out.push(sec("Guest requests", h.requests.filter(r => hit(r.id, r.title, r.guest, r.room, r.category)).map(r => `<div class="row" data-act="nav" data-href="#/requests/${r.id}"><div><div class="t"><span class="id">${r.id}</span>${esc(r.title)}</div><div class="m">Room ${esc(r.room)} · ${esc(r.guest)} · ${esc(when(r.createdAt))}</div></div><div class="r">${chip(r.status, REQ_CHIP[r.status])}</div></div>`)));
  if (m.includes("lostfound")) out.push(sec("Lost & found", h.lostFound.filter(x => hit(x.id, x.item, x.location, x.guest)).map(x => `<div class="row" data-act="nav" data-href="#/lostfound/${x.id}"><div><div class="t"><span class="id">${x.id}</span>${esc(x.item)}</div><div class="m">${esc(x.location)} · ${esc(when(x.foundAt))}</div></div><div class="r">${chip(x.status)}</div></div>`)));
  if (m.includes("logbook")) out.push(sec("Logbook", h.log.filter(e => hit(e.text, sname(e.author))).map(e => `<div class="row" data-act="nav" data-href="#/logbook"><div><div class="t">${esc(e.text.slice(0, 90))}</div><div class="m">${esc(sname(e.author))} · ${esc(when(e.at))}</div></div><div class="r">${chip(e.dept)}</div></div>`)));
  if (m.includes("assets")) out.push(sec("Assets", h.assets.filter(a => hit(a.name, a.location, a.serial)).map(a => `<div class="row" data-act="nav" data-href="#/assets/${a.id}"><div><div class="t">${esc(a.name)}</div><div class="m">${esc(a.location)} · ${esc(a.serial)}</div></div><div class="r">${chip(a.condition)}</div></div>`)));
  const body = out.join("");
  return `<div class="filters"><span>Results for <b>“${esc(q)}”</b></span><button class="btn sm" data-act="clear-search">Clear search</button></div>${body || `<div class="panel empty">Nothing matches “${esc(q)}” at ${esc(hotelInfo().name)}.</div>`}`;
}

/* ---------- quick create ---------- */
function quickCreate() {
  const m = role().mods, out = [];
  if (m.includes("workorders")) out.push(["🔧", "Work order", () => openWOForm()]);
  if (m.includes("requests")) out.push(["🛎️", "Guest request or incident", () => openReqForm()]);
  if (m.includes("inspections") && can("inspect")) out.push(["✅", "Inspection", () => go("#/inspections") || setTimeout(() => startInspectionPicker(), 0)]);
  if (m.includes("logbook")) out.push(["📓", "Log entry", () => openLogForm()]);
  if (m.includes("lostfound")) out.push(["🧳", "Found item", () => openLFForm()]);
  return out;
}

/* ---------- events ---------- */
const ACT = {};   // click handlers: ACT[name](el, event)
const OPENERS = {}; // deep-link openers per module
ACT["close-modal"] = () => closeModal();
ACT["side-open"] = () => {
  if (window.innerWidth > 900) { const s = document.getElementById("sel-hotel"); if (s) s.focus(); return; }
  document.body.classList.add("side-open");
};
ACT["nav"] = el => { closeModal(true); U.q = ""; go(el.dataset.href); };
ACT["alerts"] = () => openAlerts();
ACT["dismiss-welcome"] = () => { S.welcome = false; save(); render(); };
ACT["clear-search"] = () => { U.q = ""; render(); };
ACT["switch-hotel"] = el => { S.hotel = el.dataset.id; U.sel.clear(); save(); render(); toast("Switched to " + hotelInfo().name); };
ACT["more"] = el => { U.limit[el.dataset.k] = (U.limit[el.dataset.k] || 50) + 100; render(); };
ACT["reset-demo"] = () => confirmBox("Reset all demo data for every property? Your changes in this browser will be replaced with fresh sample data.", () => {
  const keep = { hotel: S.hotel, role: S.role, sim: S.sim };
  S = freshState(); Object.assign(S, keep, { welcome: false }); save(true); render(); toast("Demo data reset.");
}, "Reset");
ACT["quick-new"] = () => {
  const list = quickCreate();
  modal({ title: "Create new", body: `<div class="rows">${list.map((x, i) => `<div class="row" data-act="qc" data-i="${i}"><div class="t">${x[0]} ${esc(x[1])}</div></div>`).join("")}</div>` });
};
ACT["qc"] = el => { const f = quickCreate()[+el.dataset.i]; closeModal(true); f[2](); };
ACT["seg"] = el => { U.f[el.dataset.k] = el.dataset.v; U.limit = {}; render(); };

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (el && ACT[el.dataset.act]) { e.preventDefault(); ACT[el.dataset.act](el, e); return; }
  if (e.target.closest(".side-link")) document.body.classList.remove("side-open");
});
document.getElementById("scrim").addEventListener("click", () => document.body.classList.remove("side-open"));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if (modalStack) closeModal(); else document.body.classList.remove("side-open"); }
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !modalStack) { e.preventDefault(); const s = document.getElementById("gsearch"); if (s) s.focus(); }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-act][tabindex]")) { e.preventDefault(); e.target.click(); }
});
// Filters: any element with data-f="key" writes its value to U.f[key] and re-renders.
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "sel-hotel" || t.id === "sel-role" || t.id === "sel-user") document.body.classList.remove("side-open");
  if (t.id === "sel-hotel") { S.hotel = t.value; U.sel.clear(); U.f = {}; save(); render(); toast("Switched to " + hotelInfo().name); return; }
  if (t.id === "sel-role") { S.role = t.value; U.f = {}; U.sel.clear(); U.selecting = false; save(); location.hash = "#/" + role().mods[0]; render(); toast("Now viewing as " + role().name); return; }
  if (t.id === "sel-user") { S.users[S.hotel + ":" + S.role] = t.value; save(); render(); return; }
  if (t.id === "sim-toggle") { S.sim = t.checked; save(); toast(S.sim ? "Live simulation on: new activity arrives every 20 seconds." : "Live simulation off."); return; }
  if (t.dataset.f) { U.f[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; U.limit = {}; render(); }
});
let searchTimer = null;
document.addEventListener("input", e => {
  if (e.target.id !== "gsearch") return;
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => {
    U.q = v; render();
    const s = document.getElementById("gsearch"); if (s) { s.focus(); s.setSelectionRange(v.length, v.length); }
  }, 220);
});
window.addEventListener("hashchange", () => { U.q = ""; U.selecting = false; U.sel.clear(); render(); const m = document.getElementById("main"); if (m && window.innerWidth <= 900) window.scrollTo(0, 0); });
window.addEventListener("storage", e => { if (e.key === STORE_KEY && e.newValue) { try { S = JSON.parse(e.newValue); render(); } catch (err) { /* ignore */ } } });

/* ---------- live simulation ---------- */
function simulate() {
  if (!S.sim || document.hidden) return;
  const h = H(), now = Date.now();
  const roll = Math.random();
  if (roll < 0.35) {
    const r = h.rooms.filter(x => x.hk === "Dirty" || x.hk === "Cleaning")[0];
    if (r) { r.hk = r.hk === "Dirty" ? "Cleaning" : "Clean"; r.updatedAt = now; h.activity.unshift({ t: now, by: r.att, text: `marked room ${r.no} ${D.HK_LABEL[r.hk].toLowerCase()}`, link: "#/housekeeping/" + r.no }); toast(`Live: room ${r.no} is now ${D.HK_LABEL[r.hk].toLowerCase()}`); }
  } else if (roll < 0.65) {
    const [category, title] = D.REQ_TYPES.Request.items[Math.floor(Math.random() * D.REQ_TYPES.Request.items.length)];
    const room = h.rooms.filter(x => x.occ === "OCC")[Math.floor(Math.random() * h.rooms.length / 2)] || h.rooms[0];
    const fd = h.staff.find(s => s.role === "fd");
    const req = { id: nextId("GR"), type: "Request", category, title, guest: "Guest, " + "ABCDEFGHJKLMNPRST"[Math.floor(Math.random() * 17)] + ".", room: room.no, dept: category === "Front Office" ? "Front Office" : "Housekeeping", priority: "Normal", status: "New",
      assignee: null, createdBy: fd.id, createdAt: now, ackAt: null, resolvedAt: null, recovery: "None", recoveryCost: 0, satisfaction: null, desc: "", notes: [{ t: now, by: fd.id, text: "Logged by phone" }], woId: null };
    h.requests.unshift(req);
    h.activity.unshift({ t: now, by: fd.id, text: `logged request ${req.id} for room ${req.room}: ${req.title}`, link: "#/requests/" + req.id });
    toast(`Live: new guest request from room ${req.room}: ${req.title}`);
  } else {
    const w = h.workOrders.find(x => x.status === "In progress" && !x.oooRoom);
    if (w) { w.status = "Completed"; w.completedAt = now; w.minutes = 25; w.notes.push({ t: now, by: w.assignee, text: "Completed. Tested and working." }); h.activity.unshift({ t: now, by: w.assignee, text: `completed ${w.id}: ${w.title}`, link: "#/workorders/" + w.id }); toast(`Live: ${sname(w.assignee)} completed ${w.id}`); }
  }
  save(); render();
}
setInterval(simulate, 20000);
// Keep timers ("5 min ago") fresh without disturbing typing.
setInterval(() => { if (!modalStack && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) render(); }, 60000);

function boot() { load(); render(); }
