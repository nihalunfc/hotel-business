// Hotel Report Builder: upload CSV/Excel exports, match columns and names, then an automatic
// manager's report, data checks and benchmarks. Everything runs in the browser.
(() => {
  "use strict";
  const KEY = "hbi.tool.report-dashboard.v1";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 864e5;
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#7a5af8", "#d6409f", "#0ea5b7", "#8a6d3b", "#1f4e79", "#9aa4ae"];

  // ---------------- dates, numbers, text ----------------
  const isoOf = (d) => new Date(d * DAY).toISOString().slice(0, 10);
  const dayOf = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);
  const mdow = (d) => (((d + 3) % 7) + 7) % 7; // 0 = Monday
  const weekOf = (d) => d - mdow(d);
  const monthOf = (d) => { const t = new Date(d * DAY); return t.getUTCFullYear() * 12 + t.getUTCMonth(); };
  const lblDay = (d) => { const t = new Date(d * DAY); return `${DOW[mdow(d)]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]}`; };
  const lblShort = (d) => { const t = new Date(d * DAY); return `${t.getUTCDate()} ${MON[t.getUTCMonth()]}`; };
  const lblMonth = (k) => `${MON[k % 12]} ${Math.floor(k / 12)}`;
  const lblHour = (h) => (h === 0 ? "12am" : h < 12 ? h + "am" : h === 12 ? "12pm" : h - 12 + "pm");
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

  function mkDay(y, m, d) {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
    const t = Date.UTC(y, m - 1, d);
    return new Date(t).getUTCDate() === d ? Math.round(t / DAY) : null;
  }
  function parseHour(s, allowInt) {
    s = String(s ?? "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*([AaPp])?\.?[Mm]?\.?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?$/);
    if (!m) m = s.match(/^(\d{1,2})()\s*([AaPp])\.?[Mm]\.?$/);
    if (m) {
      let h = +m[1];
      if (m[3]) { const pm = /p/i.test(m[3]); if (h > 12) return null; h = h === 12 ? (pm ? 12 : 0) : pm ? h + 12 : h; }
      return h <= 23 ? h : null;
    }
    if (allowInt) {
      if (/^\d{1,2}$/.test(s) && +s <= 23) return +s;
      if (/^\d{3,4}$/.test(s)) { const h = Math.floor(+s / 100), mi = +s % 100; if (h <= 23 && mi < 60) return h; }
    }
    return null;
  }
  function parseDate(s, order, serial) {
    s = String(s ?? "").trim();
    if (!s) return null;
    s = s.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "");
    let m, d = null, rest = "";
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(.*))?$/))) { d = mkDay(+m[1], +m[2], +m[3]); rest = m[4]; }
    else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[\s,T]+(.*))?$/))) {
      d = order === "dmy" ? mkDay(+m[3], +m[2], +m[1]) : mkDay(+m[3], +m[1], +m[2]); rest = m[4];
    }
    else if ((m = s.match(/^(\d{1,2})[-\s/.]([A-Za-z]{3,9})\.?[-\s/.,]+(\d{2,4})(?:[\s,T]+(.*))?$/))) { const mo = MONTHS[m[2].toLowerCase()]; d = mo ? mkDay(+m[3], mo, +m[1]) : null; rest = m[4]; }
    else if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:[\s,T]+(.*))?$/))) { const mo = MONTHS[m[1].toLowerCase()]; d = mo ? mkDay(+m[3], mo, +m[2]) : null; rest = m[4]; }
    else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) d = mkDay(+m[1], +m[2], +m[3]);
    else if (serial && /^\d{5}(\.\d+)?$/.test(s)) {
      const v = +s;
      if (v > 20000 && v < 80000) { const fr = v - Math.floor(v); return { d: Math.floor(v) - 25569, h: fr > 0 ? Math.floor(fr * 24 + 1e-6) : null }; }
    }
    if (d == null) return null;
    return { d, h: rest ? parseHour(rest) : null };
  }
  function num(s) {
    if (s == null) return null;
    if (typeof s === "number") return isFinite(s) ? s : null;
    s = String(s).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[$€£¥₹\s]|CAD|USD|EUR|GBP|INR|AUD/gi, "").replace(/,/g, "");
    if (s.endsWith("-")) { neg = true; s = s.slice(0, -1); }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
    const v = parseFloat(s);
    return neg ? -v : v;
  }
  const norm = (s) => String(s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const NOISE = new Set(["cad", "usd", "eur", "gbp", "inr", "aud", "in", "of", "the", "s"]);
  const colKey = (h) => norm(h).split(" ").filter((t) => t && !NOISE.has(t)).join(" ");
  function dice(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const m = new Map();
    for (let i = 0; i < a.length - 1; i++) { const g = a.substr(i, 2); m.set(g, (m.get(g) || 0) + 1); }
    let hit = 0;
    for (let i = 0; i < b.length - 1; i++) { const g = b.substr(i, 2), c = m.get(g); if (c) { hit++; m.set(g, c - 1); } }
    return (2 * hit) / (a.length + b.length - 2);
  }
  const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and");

  // ---------------- formatting ----------------
  const money = (v) => (v == null || !isFinite(v) ? "–" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-CA", { maximumFractionDigits: 0 }));
  const compact = (v) => {
    if (v == null || !isFinite(v)) return "–";
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
    if (a >= 1e3) return s + "$" + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "K";
    return s + "$" + a.toFixed(0);
  };
  const pct = (v, d = 1) => (v == null || !isFinite(v) ? "–" : (v * 100).toFixed(d) + "%");
  const nf = (v, d = 0) => (v == null || !isFinite(v) ? "–" : Number(v).toLocaleString("en-CA", { maximumFractionDigits: d, minimumFractionDigits: d }));
  const fmtU = (v, u, short) => (u === "money" ? (short ? compact(v) : money(v)) : u === "pct" ? pct(v) : u === "hours" ? nf(v, v < 100 ? 1 : 0) + (short ? "" : " h") : nf(v));
  const chg = (a, b) => (a == null || b == null || !isFinite(a) || !isFinite(b) || b === 0 ? null : (a - b) / Math.abs(b));
  const chgHtml = (c, goodUp = true) => (c == null ? '<span class="muted">–</span>' : Math.abs(c) < 0.0005 ? '<span class="muted">no change</span>' : `<span class="${(c >= 0) === goodUp ? "pos" : "neg"}">${c >= 0 ? "+" : "−"}${Math.abs(c * 100).toFixed(1)}%</span>`);

  // ---------------- fields ----------------
  const FIELDS = [
    { k: "date", label: "Date", kind: "date", syn: ["date", "business date", "bus date", "trans date", "transaction date", "trans dt", "txn date", "work date", "shift date", "invoice date", "posting date", "post date", "report date", "stay date", "audit date", "check date", "entry date", "incident date", "service date", "gl date", "dt", "date time", "datetime", "timestamp", "created at", "day", "punch date", "sales date", "order date", "date of service"] },
    { k: "time", label: "Time / hour", kind: "time", syn: ["time", "hour", "hr", "shift start", "start time", "clock in", "punch in", "time of day", "trans time", "txn time", "check time", "incident time", "order time", "time in", "start", "hour of day"] },
    { k: "hotel", label: "Hotel", kind: "dim", syn: ["hotel", "hotel name", "property", "property code", "property name", "prop", "location", "site", "hotel code", "resort", "business unit", "property id", "hotel id", "branch", "entity", "unit", "venue", "store", "location name"] },
    { k: "dept", label: "Department", kind: "dim", syn: ["department", "dept", "dept name", "department name", "revenue dept", "revenue department", "cost centre", "cost center", "division", "dept code", "area", "section", "home department", "labour department"] },
    { k: "staff", label: "Staff member", kind: "dim", syn: ["employee", "employee name", "staff", "staff name", "server", "server name", "cashier", "reported by", "emp name", "worker", "associate", "team member", "agent", "clerk", "bartender", "employee id", "emp id", "user", "user name", "employee number", "name"] },
    { k: "cat", label: "Category / type", kind: "dim", syn: ["category", "type", "loss type", "gl category", "account", "gl account", "expense type", "item category", "reason", "transaction type", "charge type", "revenue type", "incident type", "class", "expense category", "cost type", "account name"] },
    { k: "sub", label: "Outlet / vendor", kind: "dim", syn: ["outlet", "rvc", "revenue center", "revenue centre", "vendor", "supplier", "payee", "channel", "market segment", "source of business", "outlet name", "vendor name", "supplier name", "point of sale"] },
    { k: "rev", label: "Revenue", kind: "num", syn: ["revenue", "net revenue", "net sales", "sales", "total sales", "room revenue", "income", "revenue amount", "total revenue", "turnover", "takings", "rev", "sales amount", "net sales amount", "gross revenue"], weak: ["net amount", "net"] },
    { k: "exp", label: "Expense", kind: "num", syn: ["expense", "expenses", "cost", "invoice amount", "labour cost", "labor cost", "total cost", "wages", "gross pay", "spend", "expenditure", "payroll cost", "cost amount", "expense amount", "invoice total", "pay amount", "total pay", "wage cost"], weak: ["amount", "total amount", "debit", "pay", "total"] },
    { k: "loss", label: "Loss", kind: "num", syn: ["loss", "loss amount", "write off", "writeoff", "write off amount", "shrinkage", "void amount", "comp amount", "waste", "wastage", "damage", "refund amount", "loss value", "value lost"] },
    { k: "hrs", label: "Labour hours", kind: "num", syn: ["hours", "hours worked", "labour hours", "labor hours", "worked hours", "hrs", "paid hours", "total hours", "shift hours", "reg hours", "regular hours", "duration hours"] },
    { k: "rooms", label: "Rooms sold", kind: "num", syn: ["rooms sold", "rooms occupied", "occupied rooms", "room nights", "rn", "sold rooms", "occ rooms", "rooms"] },
    { k: "covers", label: "Covers / guests", kind: "num", syn: ["covers", "guests", "pax", "guest count", "check count", "quantity", "qty", "units", "items sold", "transactions", "cover count"] },
  ];
  const FD = Object.fromEntries(FIELDS.map((f) => [f.k, f]));
  const SHORT = { rev: "Revenue", exp: "Expense", loss: "Loss", hrs: "Hours", rooms: "Rooms", covers: "Covers" };
  const MEASURES = ["rev", "exp", "loss", "hrs", "rooms", "covers"];
  const BASE_DIMS = [
    { k: "hotel", label: "Hotel", pl: "Hotels" }, { k: "dept", label: "Department", pl: "Departments" }, { k: "staff", label: "Staff member", pl: "Staff" },
    { k: "cat", label: "Category / type", pl: "Categories" }, { k: "sub", label: "Outlet / vendor", pl: "Outlets / vendors" }, { k: "src", label: "Source file", pl: "Source files" },
  ];
  const MET = {
    rev: { label: "Revenue", unit: "money", color: "#2a78d6", f: (s) => s.rev, need: ["rev"] },
    exp: { label: "Expense", unit: "money", color: "#eb6834", f: (s) => s.exp, need: ["exp"], bad: true },
    loss: { label: "Loss", unit: "money", color: "#b42318", f: (s) => s.loss, need: ["loss"], bad: true },
    profit: { label: "Profit", unit: "money", color: "#1baf7a", f: (s) => s.rev - s.exp - s.loss, need: ["rev"] },
    margin: { label: "Profit margin", unit: "pct", color: "#1f4e79", f: (s) => (s.rev ? (s.rev - s.exp - s.loss) / s.rev : null), need: ["rev"] },
    lossPct: { label: "Loss as % of revenue", unit: "pct", color: "#d6409f", f: (s) => (s.rev ? s.loss / s.rev : null), need: ["rev", "loss"], bad: true },
    hrs: { label: "Labour hours", unit: "hours", color: "#eda100", f: (s) => s.hrs, need: ["hrs"] },
    rph: { label: "Revenue per labour hour", unit: "money", color: "#0ea5b7", f: (s) => (s.hrs ? s.rev / s.hrs : null), need: ["rev", "hrs"] },
    rooms: { label: "Rooms sold", unit: "count", color: "#7a5af8", f: (s) => s.rooms, need: ["rooms"] },
    covers: { label: "Covers", unit: "count", color: "#8a6d3b", f: (s) => s.covers, need: ["covers"] },
  };

  // ---------------- name matching for hotels and departments ----------------
  const DEPT_SYN = {
    "Rooms": ["rooms", "rooms division", "room division", "rooms dept", "accommodation", "lodging", "room"],
    "Food & Beverage": ["food and beverage", "f and b", "fnb", "f b", "fb", "food beverage", "food and bev", "f and b dept", "food and beverages"],
    "Front Office": ["front office", "front desk", "reception", "guest services", "fo"],
    "Housekeeping": ["housekeeping", "hskp", "hk", "house keeping", "hsk"],
    "Maintenance": ["maintenance", "engineering", "eng", "facilities", "property operations", "pom", "property operations and maintenance", "maint"],
    "Admin & General": ["admin and general", "a and g", "ag", "administration", "admin", "administrative and general", "g and a"],
    "Sales & Marketing": ["sales and marketing", "s and m", "marketing", "sales"],
    "Spa": ["spa", "wellness", "spa and wellness"],
    "Utilities": ["utilities", "utility", "energy"],
    "Parking": ["parking", "valet", "valet parking"],
    "Other Operated": ["other operated", "other operated departments", "ood", "minor operated", "other"],
    "Security": ["security", "loss prevention"],
    "Human Resources": ["human resources", "hr"],
  };
  const DEPT_LOOKUP = new Map();
  Object.entries(DEPT_SYN).forEach(([std, list]) => list.forEach((s) => DEPT_LOOKUP.set(s, std)));
  const ABBR = { htl: "hotel", hot: "hotel", ste: "suites", sts: "suites", rst: "resort", rsrt: "resort", intl: "international", ctr: "centre", center: "centre", mt: "mount", st: "saint" };
  const GENERIC = new Set(["hotel", "inn", "resort", "suites", "suite", "spa", "and", "the", "by", "at", "of", "lodge", "motel"]);
  const STOP = new Set(["and", "the", "of", "at", "by"]);
  function acr(code, toks) {
    toks = toks.filter((t) => !STOP.has(t));
    if (toks.length < 2 || code.length < 2 || code[0] !== toks[0][0]) return false;
    const rec = (ci, ti, pos) => {
      if (ci === code.length) return ti === toks.length - 1;
      const c = code[ci];
      if (ti + 1 < toks.length && toks[ti + 1][0] === c && rec(ci + 1, ti + 1, 0)) return true;
      for (let p = pos + 1; p < toks[ti].length; p++) if (toks[ti][p] === c && rec(ci + 1, ti, p)) return true;
      return false;
    };
    return rec(1, 0, 0);
  }
  function nameItem(n, v) {
    const toks = n.split(" ").filter(Boolean).map((t) => ABBR[t] || t);
    const first = String(v.raw).trim().split(/[^A-Za-z0-9]+/)[0] || "";
    const code = /^[A-Za-z]{2,5}$/.test(first) && (first === first.toUpperCase() || toks.length <= 2) ? first.toLowerCase() : null;
    const nameLike = toks.length >= 2 && /[a-z]/.test(v.raw) && !(code && first === first.toUpperCase() && toks.length <= 2) ? 1 : 0;
    return { n, raw: v.raw, count: v.count, nfiles: v.files.size, toks, code, nameLike, flat: toks.join("") };
  }
  function nameScore2(a, b) {
    if (a.n === b.n || a.flat === b.flat) return 1;
    const [s, l] = a.toks.length <= b.toks.length ? [a, b] : [b, a];
    const sig = s.toks.filter((t) => !GENERIC.has(t));
    if (sig.length && s.toks.every((t) => l.toks.includes(t)) && (sig.length >= 2 || sig[0].length >= 5)) return 0.92;
    if (a.code && !b.code && acr(a.code, b.toks)) return 0.9;
    if (b.code && !a.code && acr(b.code, a.toks)) return 0.9;
    const d = dice(a.flat, b.flat);
    return d >= 0.84 ? d : 0;
  }
  function clusterNames(values, field) {
    const out = new Map();
    const items = [];
    values.forEach((v, n) => {
      if (field === "dept" && DEPT_LOOKUP.has(n)) out.set(n, DEPT_LOOKUP.get(n));
      else items.push(nameItem(n, v));
    });
    items.sort((a, b) => b.nameLike - a.nameLike || b.toks.length - a.toks.length || b.count - a.count);
    const clusters = [];
    if (field === "dept") Object.keys(DEPT_SYN).forEach((std) => {
      const members = DEPT_SYN[std].filter((s) => s.split(" ").length >= 2 || s.length >= 4).map((s) => nameItem(s, { raw: std, count: 0, files: new Set() }));
      clusters.push({ members: members.length ? members : [nameItem(norm(std), { raw: std, count: 0, files: new Set() })], fixed: std });
    });
    for (const it of items) {
      let best = null, bs = 0, tie = false;
      for (const cl of clusters) {
        const s = Math.max(...cl.members.map((m) => nameScore2(it, m)));
        if (s > bs + 1e-9) { best = cl; bs = s; tie = false; } else if (s >= 0.84 && Math.abs(s - bs) < 1e-9) tie = true;
      }
      if (best && bs >= 0.84 && !tie) best.members.push(it); else clusters.push({ members: [it] });
    }
    for (const cl of clusters) {
      const real = cl.members.filter((m) => m.count > 0);
      if (!real.length) continue;
      let std = cl.fixed;
      if (!std) {
        const pick = [...real].sort((a, b) => b.nameLike - a.nameLike || b.nfiles - a.nfiles || b.toks.length - a.toks.length || b.count - a.count)[0];
        std = String(pick.raw).trim();
        if (std === std.toUpperCase() && /[A-Z]{3}/.test(std) && std.includes(" ")) std = titleCase(std);
      }
      real.forEach((m) => out.set(m.n, std));
    }
    return out;
  }

  // ---------------- state ----------------
  let T = { templates: {}, aliases: { hotel: {}, dept: {} }, x: { metrics: ["profit", "rev", "exp"], group: "day", split: "", type: "auto" }, noAutoSample: false };
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) T = Object.assign(T, s, { aliases: Object.assign({ hotel: {}, dept: {} }, s.aliases || {}) }); } catch (e) { /* storage blocked */ }
  const saveT = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* storage blocked */ } };

  const S = { files: [], tab: 0, alias: {}, data: null, customs: [], bench: null, benchName: "", benchCustom: false, hotelSort: { k: "profit", dir: -1 } };
  const F = { from: null, to: null, preset: "28", sets: {}, dow: null, hFrom: 0, hTo: 23 };

  // ---------------- IndexedDB for files ----------------
  const idb = (() => {
    let dbp;
    const open = () => (dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open("hbi-report-builder", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("files", { keyPath: "id" }); r.result.createObjectStore("kv"); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = async (store, mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode), req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined);
        t.onerror = () => rej(t.error);
      });
    };
    const safe = (p, fb) => p.catch(() => fb);
    return {
      all: () => safe(run("files", "readonly", (s) => s.getAll()), []),
      put: (f) => safe(run("files", "readwrite", (s) => s.put(f))),
      del: (id) => safe(run("files", "readwrite", (s) => s.delete(id))),
      clear: () => safe(run("files", "readwrite", (s) => s.clear())),
      get: (k) => safe(run("kv", "readonly", (s) => s.get(k)), null),
      set: (k, v) => safe(run("kv", "readwrite", (s) => s.put(v, k))),
      delKv: (k) => safe(run("kv", "readwrite", (s) => s.delete(k))),
    };
  })();

  // ---------------- reading files ----------------
  function profileCol(header, vals) {
    const n = vals.length;
    const step = Math.max(1, Math.floor(n / 1500));
    let filled = 0, numOk = 0, neg = 0, dOk = 0, dTime = 0, serOk = 0, tOk = 0, hInt = 0, sample = 0, mdyEv = 0, dmyEv = 0, slashN = 0;
    let min = Infinity, max = -Infinity;
    const distinct = new Set(), ex = [];
    for (let i = 0; i < n; i++) {
      const v = vals[i];
      const s = v == null ? "" : String(v).trim();
      if (!s) continue;
      filled++;
      if (distinct.size < 5000) distinct.add(s);
      if (ex.length < 3 && !ex.includes(s)) ex.push(s);
      if (i % step) continue;
      sample++;
      const x = num(s);
      if (x != null) { numOk++; if (x < 0) neg++; if (x < min) min = x; if (x > max) max = x; }
      const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
      if (m) { slashN++; if (+m[1] > 12) dmyEv++; if (+m[2] > 12) mdyEv++; }
      if (parseHour(s, false) != null) tOk++;
      if (parseHour(s, true) != null) hInt++;
      if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) serOk++;
    }
    const order = dmyEv > mdyEv ? "dmy" : "mdy";
    let k = 0;
    for (let i = 0; i < n && k < sample; i += step) {
      const s = vals[i] == null ? "" : String(vals[i]).trim();
      if (!s) continue;
      k++;
      const p = parseDate(s, order, false);
      if (p) { dOk++; if (p.h != null) dTime++; }
    }
    const r = (x) => (sample ? x / sample : 0);
    return {
      name: header, key: colKey(header), filled: n ? filled / n : 0, distinct: distinct.size, distinctCapped: distinct.size >= 5000, ex,
      numRate: r(numOk), negRate: numOk ? neg / numOk : 0, min: numOk ? min : null, max: numOk ? max : null,
      dateRate: r(dOk), timeInDate: dOk ? dTime / dOk : 0, serialRate: r(serOk), timeRate: r(tOk), hourIntRate: r(hInt),
      slash: slashN > 0, order, orderSure: dmyEv + mdyEv > 0,
    };
  }

  function parseText(name, text) {
    const res = Papa.parse(String(text).replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    let rows = res.data || [];
    let hi = rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 2);
    if (hi < 0) hi = 0;
    const seen = {};
    const header = (rows[hi] || []).map((h, i) => {
      let x = String(h ?? "").trim() || `Column ${i + 1}`;
      if (seen[x]) x = `${x} (${++seen[x]})`; else seen[x] = 1;
      return x;
    });
    rows = rows.slice(hi + 1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
    const cols = header.map((h, i) => profileCol(h, rows.map((r) => r[i])));
    const dupes = (() => { const s = new Set(); let d = 0; for (const r of rows) { const k = r.join("\u0001"); if (s.has(k)) d++; else s.add(k); } return d; })();
    return { header, rows, cols, dupes, sig: cols.map((c) => c.key).sort().join("|") };
  }

  function labelFromName(name) {
    const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
    const t = base.length > 28 ? base.slice(0, 28) + "…" : base;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function addFile(rec) {
    const p = parseText(rec.name, rec.text);
    const f = Object.assign({ id: rec.id, name: rec.name, text: rec.text, label: rec.label || labelFromName(rec.name), order: rec.order }, p);
    f.dateOrder = "mdy";
    autoMap(f);
    const i = S.files.findIndex((x) => x.id === f.id);
    if (i >= 0) S.files[i] = f; else S.files.push(f);
    return f;
  }

  async function readUpload(fileList) {
    busy(true);
    const added = [];
    try {
      for (const file of fileList) {
        if (/\.(xlsx|xls)$/i.test(file.name)) {
          const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
          wb.SheetNames.forEach((sn) => {
            const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn], { blankrows: false });
            if (csv.replace(/[,\s]/g, "").length) added.push({ name: wb.SheetNames.length > 1 ? `${file.name} · ${sn}` : file.name, text: csv });
          });
        } else added.push({ name: file.name, text: await file.text() });
      }
      let order = S.files.reduce((m, f) => Math.max(m, f.order || 0), 0);
      for (const a of added) {
        const existing = S.files.find((f) => f.name === a.name);
        const rec = { id: existing ? existing.id : "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: a.name, text: a.text, label: existing?.label, order: existing ? existing.order : ++order };
        addFile(rec);
        await idb.put({ id: rec.id, name: rec.name, text: rec.text, label: S.files.find((f) => f.id === rec.id).label, order: rec.order });
      }
      T.noAutoSample = true; saveT();
      if (added.length) S.tab = S.files.length - 1;
      refreshAll();
      toast(`${added.length} file${added.length === 1 ? "" : "s"} added.`);
    } catch (e) {
      alert("Sorry, one of the files could not be read: " + e.message);
    } finally { busy(false); }
  }

  const SAMPLES = [
    ["opera_pms_daily_revenue.csv", "PMS revenue"], ["micros_pos_sales.csv", "POS sales"], ["dayforce_timecards.csv", "Payroll"],
    ["ap_invoices.csv", "Invoices"], ["loss_incident_log.csv", "Loss log"],
  ];
  async function loadSamples() {
    busy(true);
    try {
      const texts = await Promise.all(SAMPLES.map(([n]) => fetch("samples/" + n).then((r) => { if (!r.ok) throw new Error(n); return r.text(); })));
      for (let i = 0; i < SAMPLES.length; i++) {
        const [name, label] = SAMPLES[i];
        const existing = S.files.find((f) => f.name === name);
        const rec = { id: existing ? existing.id : "s" + i, name, text: texts[i], label: existing?.label || label, order: existing ? existing.order : 100 + i };
        addFile(rec);
        await idb.put({ id: rec.id, name, text: texts[i], label: rec.label, order: rec.order });
      }
    } catch (e) {
      $("#files").innerHTML = `<div class="issuebox bad">The sample files could not be loaded (${esc(e.message)}). If you opened this page from your computer, open it through a web address instead.</div>`;
    } finally { busy(false); }
  }

  // ---------------- column matching ----------------
  function nameScore(key, fd) {
    let best = 0, why = "";
    const ct = key.split(" ");
    const flatK = key.replace(/ /g, "");
    const test = (s, cap) => {
      let sc = 0;
      if (key === s) sc = 1;
      else if (flatK === s.replace(/ /g, "")) sc = 0.97;
      else {
        const st = s.split(" ");
        if (st.length > 1 && st.every((t) => ct.includes(t))) sc = 0.88;
        else if (st.length === 1 && s.length >= 3 && ct.includes(s)) sc = 0.72;
        else { const d = dice(flatK, s.replace(/ /g, "")); if (d >= 0.8) sc = d * 0.85; }
      }
      sc = Math.min(sc, cap);
      if (sc > best) { best = sc; why = s; }
    };
    fd.syn.forEach((s) => test(s, 1));
    (fd.weak || []).forEach((s) => test(s, 0.7));
    return [best, why];
  }
  function fit(fd, c, ns) {
    if (fd.kind === "date") return c.dateRate >= 0.8 ? Math.max(ns, 0.6) : ns >= 0.7 && c.serialRate >= 0.9 ? ns : 0;
    if (ns <= 0) return 0;
    if (fd.kind === "time") {
      if (c.dateRate >= 0.8) return c.timeInDate >= 0.8 ? ns * 0.9 : 0;
      return c.timeRate >= 0.8 || c.hourIntRate >= 0.9 ? ns : 0;
    }
    if (fd.kind === "num") return c.numRate >= 0.9 && c.filled > 0 ? ns : 0;
    if (c.dateRate >= 0.8 && c.filled > 0) return 0;
    if (c.numRate >= 0.95 && !["hotel", "staff"].includes(fd.k)) return ns * 0.6;
    return ns;
  }
  function autoMap(f) {
    const cands = [];
    f.cols.forEach((c, i) => FIELDS.forEach((fd) => {
      const [ns, why] = nameScore(c.key, fd);
      const sc = fit(fd, c, ns);
      if (sc >= 0.5) cands.push({ i, k: fd.k, sc, why: ns > 0 ? `name is like "${why}"` : "its values are dates" });
    }));
    cands.sort((a, b) => b.sc - a.sc);
    f.map = f.cols.map(() => ({ field: "", state: "none", why: "" }));
    const taken = new Set();
    for (const c of cands) {
      if (taken.has(c.k) || f.map[c.i].field) continue;
      f.map[c.i] = { field: c.k, state: c.sc >= 0.85 ? "hi" : "mid", why: c.why, sc: c.sc };
      taken.add(c.k);
    }
    f.defaults = { hotel: "", dept: "" };
    f.defAuto = {};
    const tpl = T.templates[f.sig];
    if (tpl) {
      f.cols.forEach((c, i) => {
        if (!(c.key in (tpl.map || {}))) return;
        const k = tpl.map[c.key];
        if (k) f.map.forEach((m) => { if (m.field === k) Object.assign(m, { field: "", state: "none", why: "" }); });
        f.map[i] = { field: k, state: "tpl", why: "your saved rule" };
      });
      Object.assign(f.defaults, tpl.defaults || {});
      if (tpl.label) f.label = tpl.label;
      if (tpl.dateOrder) f.dateOrder = tpl.dateOrder;
    }
    const has = (k) => f.map.some((m) => m.field === k);
    if (!has("dept") && !f.defaults.dept && /(pos|f ?(&|and|n) ?b|restaurant|\bbar\b|food|micros|toast|square|lightspeed)/i.test(f.name + " " + f.label)) {
      f.defaults.dept = "Food & Beverage"; f.defAuto.dept = true;
    }
    const dc = f.map.findIndex((m) => m.field === "date");
    if (dc >= 0 && !(tpl && tpl.dateOrder)) f.dateOrder = f.cols[dc].order;
  }
  function saveTpl(f, patch) {
    const t = (T.templates[f.sig] ||= { map: {}, defaults: {} });
    if (patch.map) Object.assign(t.map, patch.map);
    if (patch.defaults) Object.assign(t.defaults, patch.defaults);
    if (patch.label != null) t.label = patch.label;
    if (patch.dateOrder) t.dateOrder = patch.dateOrder;
    saveT();
  }
  function fileIssues(f) {
    const bad = [], warn = [];
    const cnt = {};
    f.map.forEach((m) => { if (m.field) cnt[m.field] = (cnt[m.field] || 0) + 1; });
    Object.entries(cnt).forEach(([k, n]) => { if (n > 1) bad.push(`${n} columns are matched to <b>${esc(fieldLabel(k))}</b>. Keep one and set the others to "Not used".`); });
    if (!cnt.date) bad.push("No column is matched to <b>Date</b>. Choose the column that holds the date.");
    if (!MEASURES.some((k) => cnt[k])) bad.push("No amount is matched (revenue, expense, loss, hours, rooms or covers). Choose at least one.");
    if (!cnt.hotel && !f.defaults.hotel) warn.push("No hotel column: rows will show as <b>Unassigned</b> unless you type the hotel below.");
    const dc = f.map.findIndex((m) => m.field === "date");
    if (dc >= 0 && f.cols[dc].slash && !f.cols[dc].orderSure) warn.push("Dates like 03/04 could be month/day or day/month. Check the date order below.");
    const check = f.map.filter((m) => m.state === "mid").length;
    if (check) warn.push(`${check} match${check > 1 ? "es" : ""} marked amber: please check.`);
    return { bad, warn };
  }
  const fieldLabel = (k) => (k.startsWith("c:") ? k.slice(2) + " (custom)" : FD[k] ? FD[k].label : k);
  const usable = () => S.files.filter((f) => !fileIssues(f).bad.length);

  // ---------------- name aliases ----------------
  function buildAliases() {
    S.alias = {};
    for (const field of ["hotel", "dept"]) {
      const values = new Map();
      for (const f of usable()) {
        const ci = f.map.findIndex((m) => m.field === field);
        const add = (raw, c) => {
          const s = String(raw ?? "").trim();
          if (!s) return;
          const n = norm(s);
          if (!n) return;
          const v = values.get(n) || { raw: s, count: 0, files: new Set(), raws: {} };
          v.count += c; v.files.add(f.label); v.raws[s] = (v.raws[s] || 0) + c;
          values.set(n, v);
        };
        if (ci >= 0) {
          const seen = new Map();
          for (const r of f.rows) { const s = r[ci]; const k = s == null ? "" : String(s); if (k.trim()) seen.set(k, (seen.get(k) || 0) + 1); else if (f.defaults[field]) add(f.defaults[field], 1); }
          seen.forEach((c, s) => add(s, c));
        } else if (f.defaults[field]) add(f.defaults[field], f.rows.length);
      }
      values.forEach((v) => { v.raw = Object.entries(v.raws).sort((a, b) => b[1] - a[1])[0][0]; });
      const auto = clusterNames(values, field);
      const ov = T.aliases[field] || {};
      const m = new Map();
      values.forEach((v, n) => m.set(n, { std: ov[n] ?? auto.get(n) ?? v.raw, auto: !(n in ov), raw: v.raw, count: v.count, files: [...v.files] }));
      S.alias[field] = m;
    }
  }

  // ---------------- unified data ----------------
  function buildData() {
    const files = usable();
    const customs = [...new Set(files.flatMap((f) => f.map.filter((m) => m.field.startsWith("c:")).map((m) => m.field)))];
    S.customs = customs;
    const dimKeys = BASE_DIMS.map((d) => d.k).concat(customs);
    const D = { n: 0, d: [], h: [], dim: {}, dict: {}, idx: {}, m: {}, has: {}, minD: Infinity, maxD: -Infinity, hourRows: 0, perFile: {} };
    dimKeys.forEach((k) => { D.dim[k] = []; D.dict[k] = []; D.idx[k] = new Map(); });
    MEASURES.forEach((k) => { D.m[k] = []; D.has[k] = false; });
    const intern = (k, v) => { let i = D.idx[k].get(v); if (i == null) { i = D.dict[k].length; D.dict[k].push(v); D.idx[k].set(v, i); } return i; };
    for (const f of files) {
      const col = {};
      f.map.forEach((m, i) => { if (m.field) col[m.field] = i; });
      const dc = col.date, tc = col.time ?? -1;
      const dcol = f.cols[dc];
      const serial = dcol.dateRate < 0.5 && dcol.serialRate >= 0.8;
      const timeFromDate = tc >= 0 && tc === dc;
      const flip = {};
      MEASURES.forEach((k) => { if (col[k] != null && f.cols[col[k]].negRate >= 0.8 && k !== "rev") flip[k] = true; });
      f.flip = flip;
      const st = { rows: f.rows.length, used: 0, badDate: 0, badNum: 0, blankNum: 0, cells: 0, empty: 0, minD: Infinity, maxD: -Infinity };
      const srcI = intern("src", f.label);
      const dimCols = dimKeys.filter((k) => k !== "src").map((k) => [k, col[k] ?? -1]);
      for (const r of f.rows) {
        const p = parseDate(r[dc], f.dateOrder, serial);
        if (!p) { st.badDate++; continue; }
        st.used++;
        let h = -1;
        if (tc >= 0 && !timeFromDate) { const x = parseHour(r[tc], true); if (x != null) h = x; else if (p.h != null) h = p.h; }
        else if (p.h != null) h = p.h;
        D.d.push(p.d); D.h.push(h);
        if (h >= 0) D.hourRows++;
        if (p.d < D.minD) D.minD = p.d;
        if (p.d > D.maxD) D.maxD = p.d;
        if (p.d < st.minD) st.minD = p.d;
        if (p.d > st.maxD) st.maxD = p.d;
        for (const [k, ci] of dimCols) {
          let raw = ci >= 0 ? r[ci] : "";
          raw = raw == null ? "" : String(raw).trim();
          if (ci >= 0) { st.cells++; if (!raw) st.empty++; }
          if (!raw && (k === "hotel" || k === "dept")) raw = f.defaults[k] || "";
          let v;
          if (!raw) v = k === "hotel" ? "Unassigned" : "(not given)";
          else if (S.alias[k]) { const a = S.alias[k].get(norm(raw)); v = a ? a.std : raw; }
          else v = raw;
          D.dim[k].push(intern(k, v));
        }
        D.dim.src.push(srcI);
        for (const k of MEASURES) {
          const ci = col[k];
          let v = 0;
          if (ci != null) {
            const x = num(r[ci]);
            if (x == null) { if (String(r[ci] ?? "").trim()) st.badNum++; else st.blankNum++; }
            else { v = flip[k] ? -x : x; if (v) D.has[k] = true; }
          }
          D.m[k].push(v);
        }
        D.n++;
      }
      D.perFile[f.id] = st;
    }
    // case-insensitive merge for free-text dimensions
    for (const k of dimKeys) {
      if (k === "hotel" || k === "dept" || k === "src") continue;
      const byNorm = new Map(), remap = [];
      const counts = new Array(D.dict[k].length).fill(0);
      D.dim[k].forEach((i) => counts[i]++);
      D.dict[k].forEach((name, i) => { const n = norm(name) || name; const cur = byNorm.get(n); if (!cur || counts[i] > counts[cur.i]) byNorm.set(n, { i, name }); });
      const newDict = [], newIdx = new Map();
      D.dict[k].forEach((name, i) => {
        const keep = byNorm.get(norm(name) || name).name;
        let j = newIdx.get(keep);
        if (j == null) { j = newDict.length; newDict.push(keep); newIdx.set(keep, j); }
        remap[i] = j;
      });
      D.dim[k] = D.dim[k].map((i) => remap[i]);
      D.dict[k] = newDict; D.idx[k] = newIdx;
    }
    S.data = D.n ? D : null;
    if (S.data) {
      if (F.from == null || F.preset !== "custom") applyPreset(F.preset);
      else { F.from = Math.min(Math.max(F.from, D.minD), D.maxD); F.to = Math.min(Math.max(F.to, F.from), D.maxD); }
    }
  }
  const dimsAvail = () => {
    const D = S.data;
    if (!D) return [];
    return BASE_DIMS.concat(S.customs.map((k) => ({ k, label: k.slice(2), pl: k.slice(2) }))).filter((d) => D.dict[d.k] && D.dict[d.k].length > 1);
  };
  const metricsAvail = () => Object.keys(MET).filter((k) => S.data && MET[k].need.every((n) => S.data.has[n]));

  // ---------------- filtering and aggregation ----------------
  function rowsIn(from, to, ignore = {}) {
    const D = S.data, out = [];
    if (!D) return out;
    const allow = [];
    for (const [k, set] of Object.entries(F.sets)) {
      if (!set || !D.dict[k] || ignore[k]) continue;
      const a = new Uint8Array(D.dict[k].length);
      D.dict[k].forEach((n, i) => { if (set.has(n)) a[i] = 1; });
      allow.push([D.dim[k], a]);
    }
    const dowA = F.dow && !ignore.dow ? F.dow : null;
    const hourF = !ignore.hour && (F.hFrom > 0 || F.hTo < 23);
    for (let i = 0; i < D.n; i++) {
      const d = D.d[i];
      if (d < from || d > to) continue;
      if (dowA && !dowA.has(mdow(d))) continue;
      if (hourF) { const h = D.h[i]; if (h < F.hFrom || h > F.hTo) continue; }
      let ok = true;
      for (const [col, a] of allow) if (!a[col[i]]) { ok = false; break; }
      if (ok) out.push(i);
    }
    return out;
  }
  const zero = () => ({ rev: 0, exp: 0, loss: 0, hrs: 0, rooms: 0, covers: 0, n: 0, lossN: 0 });
  function add(s, i) {
    const m = S.data.m;
    s.rev += m.rev[i]; s.exp += m.exp[i]; s.loss += m.loss[i]; s.hrs += m.hrs[i]; s.rooms += m.rooms[i]; s.covers += m.covers[i]; s.n++;
    if (m.loss[i]) s.lossN++;
  }
  function total(idx) { const s = zero(); for (const i of idx) add(s, i); return s; }
  function group(idx, keyFn) {
    const g = new Map();
    for (const i of idx) { const k = keyFn(i); if (k == null) continue; let s = g.get(k); if (!s) g.set(k, (s = zero())); add(s, i); }
    return g;
  }
  function keyFnFor(gk) {
    const D = S.data;
    if (gk === "hour") return (i) => (D.h[i] >= 0 ? D.h[i] : null);
    if (gk === "day") return (i) => D.d[i];
    if (gk === "week") return (i) => weekOf(D.d[i]);
    if (gk === "month") return (i) => monthOf(D.d[i]);
    if (gk === "dow") return (i) => mdow(D.d[i]);
    return (i) => D.dim[gk][i];
  }
  function axisKeys(gk, g, from, to) {
    if (gk === "hour") { const ks = [...g.keys()]; if (!ks.length) return []; const lo = Math.min(...ks), hi = Math.max(...ks); return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); }
    if (gk === "day") return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    if (gk === "week") { const out = []; for (let w = weekOf(from); w <= to; w += 7) out.push(w); return out; }
    if (gk === "month") { const out = []; for (let m = monthOf(from); m <= monthOf(to); m++) out.push(m); return out; }
    if (gk === "dow") return [0, 1, 2, 3, 4, 5, 6];
    return null;
  }
  function keyLabel(gk, k) {
    if (gk === "hour") return lblHour(k);
    if (gk === "day") return lblDay(k);
    if (gk === "week") return "Wk " + lblShort(k);
    if (gk === "month") return lblMonth(k);
    if (gk === "dow") return DOW[k];
    return S.data.dict[gk][k];
  }
  const isTime = (gk) => ["hour", "day", "week", "month", "dow"].includes(gk);
  const groupLabel = (gk) => ({ hour: "Hour of day", day: "Day", week: "Week", month: "Month", dow: "Weekday" }[gk] || (dimsAvail().find((d) => d.k === gk) || {}).label || gk);
  function daysInRange(from, to) {
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    for (let d = from; d <= to; d++) if (!F.dow || F.dow.has(mdow(d))) cnt[mdow(d)]++;
    return cnt;
  }

  // ---------------- charts ----------------
  const charts = {};
  function mk(id, cfg) {
    if (charts[id]) charts[id].destroy();
    const el = document.getElementById(id);
    if (!el) return null;
    charts[id] = new Chart(el, cfg);
    return charts[id];
  }
  const narrow = () => window.innerWidth < 640;
  const catTicks = (extra = {}) => gridScale(Object.assign({ grid: { display: false }, ticks: { color: COLORS.ink, autoSkip: false, callback(v) { const l = String(this.getLabelForValue(v)); return narrow() && l.length > 17 ? l.slice(0, 16) + "…" : l; } } }, extra));
  const yScale = (unit, extra = {}) => gridScale(Object.assign({ ticks: { color: COLORS.ink, maxRotation: 0, autoSkipPadding: 8, callback: (v) => fmtU(v, unit, true) } }, extra));
  const tipLabel = (ctx) => {
    const u = ctx.dataset.unit || "money";
    const v = ctx.chart.options.indexAxis === "y" ? ctx.parsed.x : ctx.parsed.y;
    return ` ${ctx.dataset.label}: ${fmtU(v, u)}`;
  };

  // ---------------- UI: files ----------------
  function renderFiles() {
    const box = $("#files");
    if (!S.files.length) { box.innerHTML = ""; return; }
    box.innerHTML = S.files.map((f, i) => {
      const iss = fileIssues(f);
      const st = iss.bad.length ? '<span class="st bad">Needs your choice in step 2</span>' : iss.warn.length ? '<span class="st warn">Ready, a few things to check</span>' : '<span class="st ok">Matched and ready</span>';
      const used = f.map.filter((m) => m.field).length;
      return `<div class="fcard"><button class="xbtn" data-del="${i}" title="Remove this file" aria-label="Remove ${esc(f.name)}">×</button>
        <h4>${esc(f.name)}</h4><div class="meta">${nf(f.rows.length)} rows · ${f.cols.length} columns · ${used} used</div>
        <div class="lbl"><span>Name in report</span><input type="text" value="${esc(f.label)}" data-label="${i}" maxlength="40"></div>${st}</div>`;
    }).join("");
  }

  // ---------------- UI: mapping ----------------
  function fieldOptions(sel) {
    const customs = [...new Set(S.files.flatMap((f) => f.map.filter((m) => m.field.startsWith("c:")).map((m) => m.field)))];
    const grp = (lbl, ks) => `<optgroup label="${lbl}">` + ks.map((k) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(fieldLabel(k))}</option>`).join("") + "</optgroup>";
    return `<option value=""${!sel ? " selected" : ""}>— Not used —</option>` +
      grp("When and where", ["date", "time", "hotel", "dept"]) + grp("Who and what", ["staff", "cat", "sub"]) + grp("Amounts", MEASURES) +
      (customs.length ? grp("Your custom fields", customs) : "") + `<option value="__new">+ New custom field…</option>`;
  }
  function renderMapping() {
    const has = S.files.length > 0;
    $("#map-empty").hidden = has; $("#map-wrap").hidden = !has;
    if (!has) return;
    if (S.tab >= S.files.length) S.tab = 0;
    // matrix
    const used = new Set();
    S.files.forEach((f) => f.map.forEach((m) => m.field && used.add(m.field)));
    const rowsK = FIELDS.map((f) => f.k).filter((k) => used.has(k) || k === "date" || k === "hotel" || k === "dept").concat([...used].filter((k) => k.startsWith("c:")));
    const dot = (st) => `<i class="conf ${{ hi: "hi", mid: "mid", tpl: "tpl", man: "man" }[st] || "lo"}"></i>`;
    $("#matrix").innerHTML = `<thead><tr><th>Report field</th>${S.files.map((f, i) => `<th><a href="#s-map" data-tab="${i}">${esc(f.label)}</a></th>`).join("")}</tr></thead><tbody>` +
      rowsK.map((k) => `<tr><td class="f">${esc(fieldLabel(k))}</td>${S.files.map((f) => {
        const ms = f.map.map((m, i) => [m, i]).filter(([m]) => m.field === k);
        if (ms.length) return `<td>${ms.map(([m, i]) => dot(m.state) + `<span class="src">${esc(f.cols[i].name)}</span>`).join("<br>")}</td>`;
        if (k === "time") { const dc = f.map.findIndex((m) => m.field === "date"); if (dc >= 0 && f.cols[dc].timeInDate >= 0.8) return `<td class="miss">from the date column</td>`; }
        if ((k === "hotel" || k === "dept") && f.defaults[k]) return `<td>${dot(f.defAuto[k] ? "mid" : "man")}<span class="src">all rows: ${esc(f.defaults[k])}</span></td>`;
        return `<td class="miss">—</td>`;
      }).join("")}</tr>`).join("") + "</tbody>";
    // issues
    const all = S.files.map((f) => [f, fileIssues(f)]);
    const blocked = all.filter(([, x]) => x.bad.length);
    $("#issues").innerHTML = blocked.length
      ? `<div class="issuebox bad"><b>${blocked.length} file${blocked.length > 1 ? "s need" : " needs"} a choice before ${blocked.length > 1 ? "they are" : "it is"} added to the report.</b> The other files are already in the report.<ul>${blocked.map(([f, x]) => x.bad.map((b) => `<li><a href="#s-map" data-tab="${S.files.indexOf(f)}">${esc(f.label)}</a>: ${b}</li>`).join("")).join("")}</ul></div>`
      : `<div class="issuebox ok"><b>No conflicts.</b> All ${S.files.length} file${S.files.length > 1 ? "s are" : " is"} matched and included in the report below.</div>`;
    // tabs
    $("#ftabs").innerHTML = S.files.map((f, i) => { const x = fileIssues(f); const n = x.bad.length; return `<button data-tab="${i}" class="${i === S.tab ? "on" : ""}">${esc(f.label)}${n ? `<span class="n">${n}</span>` : ""}</button>`; }).join("");
    const f = S.files[S.tab];
    const x = fileIssues(f);
    $("#colmap").innerHTML = `<thead><tr><th>Column in ${esc(f.name)}</th><th>Example values</th><th>Matched to</th><th>Why</th></tr></thead><tbody>` +
      f.cols.map((c, i) => {
        const m = f.map[i];
        const why = m.state === "man" ? "set by you" : m.state === "tpl" ? "your saved rule" : m.field ? m.why + (m.state === "mid" ? " (please check)" : "") : c.filled === 0 ? "column is empty" : "no clear match";
        return `<tr class="${m.field ? "" : "unmatched"}"><td class="cn">${dotFor(m)}${esc(c.name)}</td><td class="sm" title="${esc(c.ex.join(" | "))}">${esc(c.ex.join(" · ")) || "<i>empty</i>"}</td>
          <td><select data-col="${i}" aria-label="Field for ${esc(c.name)}">${fieldOptions(m.field)}</select></td><td class="why">${esc(why)}</td></tr>`;
      }).join("") + "</tbody>";
    // per-file settings
    const has2 = (k) => f.map.some((m) => m.field === k);
    const dc = f.map.findIndex((m) => m.field === "date");
    const hotels = S.alias.hotel ? [...new Set([...S.alias.hotel.values()].map((a) => a.std))] : [];
    const depts = [...new Set(Object.keys(DEPT_SYN).concat(S.alias.dept ? [...S.alias.dept.values()].map((a) => a.std) : []))];
    let h = `<div class="defaults">`;
    if (!has2("hotel")) h += `<div class="field"><label for="def-hotel">Hotel for every row in this file</label><input type="text" id="def-hotel" list="dl-hotel" value="${esc(f.defaults.hotel)}" placeholder="e.g. Summit Tower Hotel"><small>This file has no hotel column.</small></div>`;
    if (!has2("dept")) h += `<div class="field"><label for="def-dept">Department for every row</label><input type="text" id="def-dept" list="dl-dept" value="${esc(f.defaults.dept)}" placeholder="e.g. Food & Beverage"><small>${f.defAuto.dept ? "Guessed from the file name. Please check." : "This file has no department column."}</small></div>`;
    if (dc >= 0 && f.cols[dc].slash) h += `<div class="field"><label for="def-order">Date order</label><select id="def-order"><option value="mdy"${f.dateOrder === "mdy" ? " selected" : ""}>Month/Day/Year (07/27/2026)</option><option value="dmy"${f.dateOrder === "dmy" ? " selected" : ""}>Day/Month/Year (27/07/2026)</option></select><small>${f.cols[dc].orderSure ? "Detected from the values." : "Could be either. Please check."}</small></div>`;
    h += `</div><datalist id="dl-hotel">${hotels.map((v) => `<option value="${esc(v)}">`).join("")}</datalist><datalist id="dl-dept">${depts.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;
    if (x.warn.length) h += `<div class="warnbox">${x.warn.join("<br>")}</div>`;
    if (f.flip && Object.keys(f.flip).length) h += `<p class="note">Amounts in ${Object.keys(f.flip).map((k) => fieldLabel(k)).join(", ")} were mostly negative, so they are read as positive amounts.</p>`;
    $("#defaults").innerHTML = h;
  }
  const dotFor = (m) => `<i class="conf ${m.field ? ({ hi: "hi", mid: "mid", tpl: "tpl", man: "man" }[m.state] || "hi") : "lo"}"></i>`;

  // ---------------- UI: names ----------------
  function renderValues() {
    const box = $("#valcols");
    const any = S.alias.hotel && (S.alias.hotel.size || S.alias.dept.size);
    $("#val-empty").hidden = !!any;
    if (!any) { box.innerHTML = ""; return; }
    box.innerHTML = ["hotel", "dept"].map((field) => {
      const m = S.alias[field];
      if (!m.size) return "";
      const rows = [...m.entries()].sort((a, b) => a[1].std.localeCompare(b[1].std) || b[1].count - a[1].count);
      const stds = new Set(rows.map(([, a]) => a.std));
      let prev = null;
      return `<div><h3 style="font-size:16px">${field === "hotel" ? "Hotels" : "Departments"} <span class="muted" style="font-weight:400;font-size:14px">${m.size} spellings → ${stds.size} ${field === "hotel" ? "hotels" : "departments"}</span></h3>
        <div class="table-wrap" style="max-height:460px"><table class="valmap"><thead><tr><th>Spelling in files</th><th class="num">Rows</th><th>Standard name</th></tr></thead><tbody>` +
        rows.map(([n, a]) => {
          const start = a.std !== prev; prev = a.std;
          return `<tr class="${start ? "grp-start" : ""}"><td><b>${esc(a.raw)}</b><br><small>${esc(a.files.join(", "))}</small></td><td class="num">${nf(a.count)}</td>
            <td><input type="text" value="${esc(a.std)}" data-alias="${field}" data-n="${esc(n)}" list="dl-std-${field}" aria-label="Standard name for ${esc(a.raw)}">${a.auto ? "" : ' <small class="muted">set by you</small>'}</td></tr>`;
        }).join("") + `</tbody></table></div><datalist id="dl-std-${field}">${[...stds].map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>`;
    }).join("");
  }

  // ---------------- UI: filters ----------------
  function renderFilters() {
    const D = S.data;
    const dims = dimsAvail();
    const btn = (k, label, set, total) => `<button class="fbtn${set ? " set" : ""}" data-f="${k}"><b>${label}</b><span class="v">${set ? (set.size === 1 ? esc([...set][0]) : set.size + " of " + total) : "All"}</span></button>`;
    let h = `<span class="dr"><select id="f-preset" aria-label="Period" style="width:auto;padding:6px 8px;font-size:13.5px">
      ${[["all", "All dates"], ["7", "Last 7 days"], ["14", "Last 14 days"], ["28", "Last 28 days"], ["month", "Latest month"], ["custom", "Custom dates"]].map(([v, l]) => `<option value="${v}"${F.preset === v ? " selected" : ""}>${l}</option>`).join("")}
      </select><input type="date" id="f-from" value="${isoOf(F.from)}" min="${isoOf(D.minD)}" max="${isoOf(D.maxD)}" aria-label="From"> to <input type="date" id="f-to" value="${isoOf(F.to)}" min="${isoOf(D.minD)}" max="${isoOf(D.maxD)}" aria-label="To"></span>`;
    h += dims.map((d) => btn(d.k, d.pl, F.sets[d.k], D.dict[d.k].length)).join("");
    h += `<button class="fbtn${F.dow ? " set" : ""}" data-f="dow"><b>Weekdays</b><span class="v">${F.dow ? [...F.dow].sort().map((i) => DOW[i]).join(", ") : "All"}</span></button>`;
    if (D.hourRows) h += `<button class="fbtn${F.hFrom > 0 || F.hTo < 23 ? " set" : ""}" data-f="hour"><b>Hours</b><span class="v">${F.hFrom > 0 || F.hTo < 23 ? lblHour(F.hFrom) + "–" + lblHour(F.hTo) : "All"}</span></button>`;
    $("#fbar").innerHTML = h;
    const parts = [];
    for (const d of dims) if (F.sets[d.k]) parts.push(`${d.pl}: ${[...F.sets[d.k]].join(", ")}`);
    if (F.dow) parts.push("Weekdays: " + [...F.dow].sort().map((i) => DOW[i]).join(", "));
    if (F.hFrom > 0 || F.hTo < 23) parts.push(`Hours ${lblHour(F.hFrom)}–${lblHour(F.hTo)} (rows without a time are left out)`);
    $("#active-f").innerHTML = `${lblDay(F.from)} ${new Date(F.from * DAY).getUTCFullYear()} to ${lblDay(F.to)} ${new Date(F.to * DAY).getUTCFullYear()} (${F.to - F.from + 1} days)` + (parts.length ? " · " + esc(parts.join(" · ")) : " · everything included");
  }
  function applyPreset(p) {
    const D = S.data;
    F.preset = p;
    if (p === "all") { F.from = D.minD; F.to = D.maxD; }
    else if (/^\d+$/.test(p)) { F.to = D.maxD; F.from = Math.max(D.minD, D.maxD - +p + 1); }
    else if (p === "month") { const t = new Date(D.maxD * DAY); F.from = Math.max(D.minD, Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) / DAY)); F.to = D.maxD; }
  }

  const pop = $("#pop");
  let popFor = null;
  function closePop() { pop.classList.remove("open"); popFor = null; }
  function placePop(btn) {
    const r = btn.getBoundingClientRect();
    pop.style.top = Math.min(r.bottom + 6, window.innerHeight - 380) + "px";
    pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 312)) + "px";
  }
  function openPop(btn, k) {
    if (popFor === k) { closePop(); return; }
    popFor = k;
    const D = S.data;
    if (k === "hour") {
      const opts = (v) => Array.from({ length: 24 }, (_, h) => `<option value="${h}"${h === v ? " selected" : ""}>${lblHour(h)}</option>`).join("");
      pop.innerHTML = `<div class="ph"><b>Hours of the day</b><p class="note" style="margin:4px 0 0">Only rows with a time are kept when hours are narrowed (${pct(D.hourRows / D.n, 0)} of rows have one).</p></div>
        <div style="padding:12px;display:flex;gap:10px;align-items:center"><select id="ph-from">${opts(F.hFrom)}</select> to <select id="ph-to">${opts(F.hTo)}</select></div>
        <div class="pf"><button class="btn sm" id="ph-all">All hours</button> <button class="btn sm primary" id="p-done">Done</button></div>`;
      const upd = () => { let a = +$("#ph-from").value, b = +$("#ph-to").value; if (a > b) [a, b] = [b, a]; F.hFrom = a; F.hTo = b; renderReport(); };
      $("#ph-from").onchange = upd; $("#ph-to").onchange = upd;
      $("#ph-all").onclick = () => { F.hFrom = 0; F.hTo = 23; $("#ph-from").value = 0; $("#ph-to").value = 23; renderReport(); };
    } else {
      let items;
      if (k === "dow") items = DOW.map((n, i) => ({ v: i, label: n }));
      else {
        const counts = new Array(D.dict[k].length).fill(0);
        rowsIn(F.from, F.to, { [k]: true }).forEach((i) => counts[D.dim[k][i]]++);
        items = D.dict[k].map((n, i) => ({ v: n, label: n, c: counts[i] })).sort((a, b) => b.c - a.c || String(a.label).localeCompare(b.label));
      }
      const cur = () => (k === "dow" ? F.dow : F.sets[k]);
      const set = (s) => { const full = s && s.size === items.length; if (k === "dow") F.dow = s && s.size && !full ? s : null; else F.sets[k] = s && s.size && !full ? s : null; renderReport(); };
      const title = k === "dow" ? "Weekdays" : (dimsAvail().find((d) => d.k === k) || {}).pl;
      pop.innerHTML = `<div class="ph"><b>${esc(title)}</b>${items.length > 8 ? '<input type="text" id="p-q" placeholder="Search…" style="margin-top:6px">' : ""}
        <div class="pa"><button id="p-all">Select all</button><button id="p-none">Clear</button>${k === "dow" ? '<button id="p-wkd">Mon–Fri</button><button id="p-wke">Sat–Sun</button>' : ""}</div></div>
        <div class="pl" id="p-list">${items.map((it, i) => `<label data-i="${i}"><input type="checkbox" value="${i}"${!cur() || cur().has(it.v) ? " checked" : ""}> <span>${esc(it.label)}</span>${it.c != null ? `<span class="c">${nf(it.c)} rows</span>` : ""}</label>`).join("")}</div>
        <div class="pf"><button class="btn sm primary" id="p-done">Done</button></div>`;
      const read = () => new Set([...pop.querySelectorAll("#p-list input:checked")].map((x) => items[+x.value].v));
      pop.querySelector("#p-list").onchange = () => set(read());
      const setAll = (fn) => { pop.querySelectorAll("#p-list input").forEach((x) => { if (x.closest("label").style.display !== "none") x.checked = fn(items[+x.value].v); }); set(read()); };
      $("#p-all").onclick = () => setAll(() => true);
      $("#p-none").onclick = () => { pop.querySelectorAll("#p-list input").forEach((x) => (x.checked = false)); F.dow = null; if (k !== "dow") F.sets[k] = new Set(); set(new Set()); };
      if (k === "dow") { $("#p-wkd").onclick = () => { pop.querySelectorAll("#p-list input").forEach((x) => (x.checked = +x.value < 5)); set(read()); }; $("#p-wke").onclick = () => { pop.querySelectorAll("#p-list input").forEach((x) => (x.checked = +x.value >= 5)); set(read()); }; }
      const q = $("#p-q");
      if (q) { q.oninput = () => { const t = q.value.toLowerCase(); pop.querySelectorAll("#p-list label").forEach((l) => (l.style.display = items[+l.dataset.i].label.toLowerCase().includes(t) ? "" : "none")); }; setTimeout(() => matchMedia("(hover: hover)").matches && q.focus(), 0); }
    }
    $("#p-done").onclick = closePop;
    placePop(btn);
    pop.classList.add("open");
  }

  // ---------------- report ----------------
  function renderReport() {
    const D = S.data;
    $("#rep-empty").hidden = !!D; $("#rep").hidden = !D;
    if (!D) return;
    // an empty selection (Clear) means nothing selected: treat as "no rows"
    renderFilters();
    if (popFor && pop.classList.contains("open")) { const b = document.querySelector(`[data-f="${popFor}"]`); if (b) placePop(b); }
    const idx = rowsIn(F.from, F.to);
    const len = F.to - F.from + 1;
    const prevIdx = rowsIn(F.from - len, F.from - 1);
    renderFlash();
    renderKpis(idx, prevIdx);
    renderExplorer(idx);
    renderStd(idx);
    renderHotelTable(idx, prevIdx);
    renderInsights(idx);
  }

  function renderKpis(idx, prevIdx) {
    const s = total(idx), p = total(prevIdx);
    const hasPrev = prevIdx.length > 0;
    const tiles = ["rev", "exp", "loss", "profit", "margin", "hrs", "rph", "rooms", "covers"].filter((k) => metricsAvail().includes(k)).slice(0, 6);
    $("#kpis").innerHTML = tiles.map((k) => {
      const M = MET[k], v = M.f(s), pv = hasPrev ? M.f(p) : null;
      let d = "";
      if (pv != null && v != null) {
        if (M.unit === "pct") d = ptsHtml(v, pv, M.bad);
        else d = chgHtml(chg(v, pv), !M.bad);
      }
      return `<div class="kpi"><div class="label">${M.label}</div><div class="value">${fmtU(v, M.unit, Math.abs(v) >= 1e6)}</div><div class="sub">${hasPrev ? d + " vs previous " + len2(prevIdx) : "No earlier period to compare"}</div></div>`;
    }).join("");
  }
  const len2 = () => `${F.to - F.from + 1} days`;

  function renderFlash() {
    const D = S.data;
    const days = [];
    for (let d = D.maxD; d >= D.minD && days.length < 60; d--) days.push(d);
    const sel = $("#flash-day");
    const cur = +sel.value && +sel.value >= D.minD && +sel.value <= D.maxD ? +sel.value : D.maxD;
    sel.innerHTML = days.map((d) => `<option value="${d}"${d === cur ? " selected" : ""}>${lblDay(d)} ${new Date(d * DAY).getUTCFullYear()}</option>`).join("");
    const day = cur;
    const ix = rowsIn(day, day), lw = rowsIn(day - 7, day - 7), avIx = rowsIn(day - 7, day - 1);
    const s = total(ix), l = total(lw), a = total(avIx);
    const avDays = Math.max(1, Math.min(7, day - D.minD));
    const scale = (o) => { const r = zero(); MEASURES.forEach((k) => (r[k] = o[k] / avDays)); return r; };
    const av = scale(a);
    $("#flash-title").textContent = `Daily flash report: ${lblDay(day)}`;
    $("#flash-sub").textContent = `Compared with the same day last week (${lblDay(day - 7)}) and the average of the 7 days before. Follows your hotel, department and other filters.`;
    const ms = ["rev", "exp", "loss", "profit", "margin", "hrs", "rooms", "covers"].filter((k) => metricsAvail().includes(k));
    const hasLw = lw.length > 0;
    $("#flash-table").innerHTML = `<thead><tr><th></th><th class="num">${lblShort(day)}</th><th class="num">vs last week</th><th class="num">vs 7-day avg</th></tr></thead><tbody>` +
      ms.map((k) => {
        const M = MET[k], v = M.f(s);
        const c1 = M.unit === "pct" ? ptsHtml(v, hasLw ? M.f(l) : null, M.bad) : chgHtml(hasLw ? chg(v, M.f(l)) : null, !M.bad);
        const c2 = M.unit === "pct" ? ptsHtml(v, avIx.length ? M.f(av) : null, M.bad) : chgHtml(avIx.length ? chg(v, M.f(av)) : null, !M.bad);
        return `<tr><td>${M.label}</td><td class="num"><b>${fmtU(v, M.unit)}</b></td><td class="num">${c1}</td><td class="num">${c2}</td></tr>`;
      }).join("") + "</tbody>";
    // notes
    const notes = [];
    const P = MET.profit.f;
    if (!ix.length) notes.push("No rows for this day with the current filters.");
    else {
      notes.push(`Profit was <b>${money(P(s))}</b>${hasLw ? `, ${chgWord(chg(P(s), P(l)))} the same day last week` : ""}.`);
      if (dimsAvail().some((d) => d.k === "hotel") && hasLw) {
        const g = group(ix, (i) => D.dim.hotel[i]), gl = group(lw, (i) => D.dim.hotel[i]);
        const diffs = [...g.keys()].map((k) => [D.dict.hotel[k], P(g.get(k)) - (gl.get(k) ? P(gl.get(k)) : 0)]).sort((a, b) => a[1] - b[1]);
        if (diffs.length > 1) {
          const lo = diffs[0], hi = diffs[diffs.length - 1];
          if (lo[1] < 0) notes.push(`Biggest drop against last week: <b>${esc(lo[0])}</b> (${money(lo[1])} profit).`);
          if (hi[1] > 0) notes.push(`Biggest gain: <b>${esc(hi[0])}</b> (+${money(hi[1])}).`);
        }
        const red = [...g.entries()].filter(([, v]) => P(v) < 0).map(([k]) => D.dict.hotel[k]);
        if (red.length) notes.push(`Lost money on the day: <b>${red.map(esc).join(", ")}</b>.`);
      }
      if (D.has.exp && dimsAvail().some((d) => d.k === "dept") && avIx.length) {
        const g = group(ix, (i) => D.dim.dept[i]), ga = group(avIx, (i) => D.dim.dept[i]);
        const ups = [...g.entries()].map(([k, v]) => [D.dict.dept[k], v.exp - (ga.get(k) ? ga.get(k).exp / avDays : 0), v.exp]).filter((x) => x[2] > 0).sort((a, b) => b[1] - a[1]);
        if (ups.length && ups[0][1] > 0) notes.push(`Largest expense increase against a normal day: <b>${esc(ups[0][0])}</b>, ${money(ups[0][2])} (+${money(ups[0][1])}).`);
      }
      if (D.has.loss && s.loss > 0) {
        const parts = [];
        if (dimsAvail().some((d) => d.k === "cat")) { const g = [...group(ix.filter((i) => D.m.loss[i]), (i) => D.dim.cat[i]).entries()].sort((a, b) => b[1].loss - a[1].loss)[0]; if (g) parts.push(`most from ${esc(D.dict.cat[g[0]])} (${money(g[1].loss)})`); }
        if (dimsAvail().some((d) => d.k === "staff")) { const g = [...group(ix.filter((i) => D.m.loss[i]), (i) => D.dim.staff[i]).entries()].sort((a, b) => b[1].loss - a[1].loss)[0]; if (g) parts.push(`highest by one person: ${esc(D.dict.staff[g[0]])} (${money(g[1].loss)})`); }
        notes.push(`Loss was <b>${money(s.loss)}</b>${s.rev ? ` (${pct(s.loss / s.rev)} of revenue)` : ""}${parts.length ? "; " + parts.join("; ") : ""}.`);
      }
      if (D.hourRows) {
        const g = [...group(ix, (i) => (D.h[i] >= 0 ? D.h[i] : null)).entries()];
        if (g.length) { const top = g.sort((a, b) => b[1].rev - a[1].rev)[0]; if (top[1].rev > 0) notes.push(`Busiest hour for sales with a time stamp: <b>${lblHour(top[0])}</b> (${money(top[1].rev)}).`); }
      }
    }
    $("#flash-notes").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
  }
  const ptsHtml = (v, p, bad) => { if (v == null || p == null) return '<span class="muted">–</span>'; const x = Math.round((v - p) * 1000) / 10; if (!x) return '<span class="muted">no change</span>'; return `<span class="${(x >= 0) !== !!bad ? "pos" : "neg"}">${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)} pts</span>`; };
  const chgWord = (c) => (c == null ? "about the same as" : c >= 0 ? `<span class="pos">${(c * 100).toFixed(1)}% above</span>` : `<span class="neg">${Math.abs(c * 100).toFixed(1)}% below</span>`);

  function renderExplorer(idx) {
    const D = S.data;
    const avail = metricsAvail();
    T.x.metrics = T.x.metrics.filter((k) => avail.includes(k));
    if (!T.x.metrics.length) T.x.metrics = [avail[0]];
    $("#x-metrics").innerHTML = avail.map((k) => `<button class="mchip${T.x.metrics.includes(k) ? " on" : ""}" data-m="${k}" aria-pressed="${T.x.metrics.includes(k)}"><i style="background:${MET[k].color}"></i>${MET[k].label}</button>`).join("");
    const groups = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["dow", "Weekday"]].concat(D.hourRows ? [["hour", "Hour of day"]] : []).concat(dimsAvail().map((d) => [d.k, d.label]));
    if (!groups.some(([k]) => k === T.x.group)) T.x.group = "day";
    $("#x-group").innerHTML = groups.map(([k, l]) => `<option value="${k}"${k === T.x.group ? " selected" : ""}>${esc(l)}</option>`).join("");
    const splits = [["", "Nothing"]].concat(dimsAvail().filter((d) => d.k !== T.x.group).map((d) => [d.k, d.label]));
    if (!splits.some(([k]) => k === T.x.split)) T.x.split = "";
    $("#x-split").innerHTML = splits.map(([k, l]) => `<option value="${k}"${k === T.x.split ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("#x-type").value = T.x.type;

    const gk = T.x.group, sk = T.x.split;
    const kf = keyFnFor(gk);
    const g = group(idx, kf);
    let keys = axisKeys(gk, g, F.from, F.to);
    let note = "";
    const m0 = T.x.metrics[0];
    if (!keys) {
      keys = [...g.keys()].sort((a, b) => (MET[m0].f(g.get(b)) ?? -Infinity) - (MET[m0].f(g.get(a)) ?? -Infinity));
      if (keys.length > 25) { note = `Showing the top 25 of ${keys.length} by ${MET[m0].label.toLowerCase()}. The table has all of them.`; }
    }
    const allKeys = keys;
    const shown = isTime(gk) ? keys : keys.slice(0, 25);
    const labels = shown.map((k) => keyLabel(gk, k));
    let datasets = [], tableCols = [];
    if (sk) {
      const M = MET[m0];
      const sg = group(idx, keyFnFor(sk));
      let sKeys = [...sg.keys()].sort((a, b) => Math.abs(M.f(sg.get(b)) || 0) - Math.abs(M.f(sg.get(a)) || 0));
      const top = sKeys.slice(0, 8), rest = new Set(sKeys.slice(8));
      const cell = new Map();
      for (const i of idx) {
        const gkey = kf(i); if (gkey == null) continue;
        let s2 = D.dim[sk][i]; s2 = rest.has(s2) ? "__o" : s2;
        const key = gkey + "|" + s2;
        let o = cell.get(key); if (!o) cell.set(key, (o = zero())); add(o, i);
      }
      const series = top.concat(rest.size ? ["__o"] : []);
      datasets = series.map((s2, j) => ({
        label: s2 === "__o" ? `Other (${rest.size})` : D.dict[sk][s2], unit: M.unit,
        data: shown.map((k) => { const o = cell.get(k + "|" + s2); return o ? M.f(o) : isTime(gk) && M.unit !== "pct" ? 0 : null; }),
        backgroundColor: PALETTE[j % PALETTE.length], borderColor: PALETTE[j % PALETTE.length],
      }));
      tableCols = series.map((s2) => ({ label: s2 === "__o" ? "Other" : D.dict[sk][s2], get: (k) => { const o = cell.get(k + "|" + s2); return o ? M.f(o) : null; }, unit: M.unit }));
      if (T.x.metrics.length > 1) note = (note ? note + " " : "") + `With a split, only the first measure (${M.label}) is shown.`;
    } else {
      const units = [...new Set(T.x.metrics.map((k) => MET[k].unit))];
      datasets = T.x.metrics.map((k) => ({
        label: MET[k].label, unit: MET[k].unit, yAxisID: units.indexOf(MET[k].unit) === 0 ? "y" : "y1",
        data: shown.map((x) => { const o = g.get(x); return o ? MET[k].f(o) : isTime(gk) && MET[k].unit !== "pct" ? 0 : null; }),
        backgroundColor: MET[k].color, borderColor: MET[k].color,
      }));
      tableCols = T.x.metrics.map((k) => ({ label: MET[k].label, get: (x) => { const o = g.get(x); return o ? MET[k].f(o) : null; }, unit: MET[k].unit }));
    }
    let type = T.x.type === "auto" ? (["day", "week", "month", "hour"].includes(gk) ? "line" : "bar") : T.x.type;
    const stacked = type === "stack";
    if (stacked) type = "bar";
    datasets.forEach((ds) => { if (type === "line") { ds.backgroundColor = ds.borderColor + "22"; ds.tension = 0.25; ds.pointRadius = shown.length < 40 ? 2.5 : 0; } else ds.borderWidth = 0; });
    const units = [...new Set(datasets.map((d) => d.unit))];
    const horiz = type === "bar" && !isTime(gk) && shown.length > 6;
    const scales = horiz
      ? { x: yScale(units[0], { stacked, beginAtZero: true }), y: catTicks({ stacked }) }
      : { x: gridScale({ stacked, grid: { display: false }, ticks: { color: COLORS.ink, maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } }), y: yScale(units[0], { stacked, beginAtZero: type === "bar" }) };
    if (!sk && units.length > 1 && !horiz) scales.y1 = yScale(units[1], { position: "right", grid: { display: false }, beginAtZero: type === "bar" });
    if (horiz) datasets.forEach((d) => delete d.yAxisID);
    const box = $("#c-x").parentElement;
    box.style.height = horiz ? Math.max(360, shown.length * (datasets.length > 1 && !stacked ? 30 : 22) + 60) + "px" : "";
    mk("c-x", { type, data: { labels, datasets }, options: { indexAxis: horiz ? "y" : "x", scales, plugins: { legend: { display: datasets.length > 1, position: "bottom" }, tooltip: { callbacks: { label: tipLabel } } } } });
    $("#x-note").textContent = note || `${groupLabel(gk)}${sk ? " split by " + groupLabel(sk).toLowerCase() : ""} · ${nf(idx.length)} rows in the selection.`;
    S.xTable = { head: [groupLabel(gk)].concat(tableCols.map((c) => c.label)), rows: allKeys.map((k) => [keyLabel(gk, k)].concat(tableCols.map((c) => c.get(k)))), units: tableCols.map((c) => c.unit) };
    $("#x-table").innerHTML = `<thead><tr>${S.xTable.head.map((h, i) => `<th${i ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
      S.xTable.rows.map((r) => `<tr>${r.map((v, i) => (i ? `<td class="num">${fmtU(v, S.xTable.units[i - 1])}</td>` : `<td>${esc(v)}</td>`)).join("")}</tr>`).join("") + "</tbody>";
  }

  function heatColor(t) {
    const stops = [isDark() ? [36, 44, 56] : [238, 245, 253], [134, 182, 239], [42, 120, 214], [24, 79, 149]];
    t = Math.max(0, Math.min(1, t)) * 3;
    const i = Math.min(2, Math.floor(t)), f = t - i;
    const c = stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * f));
    return `rgb(${c.join(",")})`;
  }

  function renderStd(idx) {
    const D = S.data;
    const P = MET.profit.f;
    // profit by day
    const gd = group(idx, (i) => D.d[i]);
    const days = axisKeys("day", gd, F.from, F.to);
    const pv = days.map((d) => (gd.get(d) ? P(gd.get(d)) : 0));
    const ma = pv.map((_, i) => (i < 6 ? null : pv.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7));
    mk("c-day", { data: { labels: days.map(lblDay), datasets: [
      { type: "bar", label: "Profit", unit: "money", data: pv, backgroundColor: pv.map((v) => (v >= 0 ? "#1baf7a" : "#b42318")), borderWidth: 0, order: 2 },
      { type: "line", label: "7-day average", unit: "money", data: ma, borderColor: "#1f4e79", backgroundColor: "#1f4e79", tension: 0.3, order: 1 },
    ] }, options: { scales: { x: gridScale({ grid: { display: false }, ticks: { color: COLORS.ink, maxRotation: 0, autoSkipPadding: 12 } }), y: yScale("money") }, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: tipLabel } } } } });
    // profit by week
    const gw = group(idx, (i) => weekOf(D.d[i]));
    const weeks = axisKeys("week", gw, F.from, F.to);
    const wv = weeks.map((w) => (gw.get(w) ? P(gw.get(w)) : 0));
    const wm = weeks.map((w) => (gw.get(w) ? MET.margin.f(gw.get(w)) : null));
    const partial = weeks.map((w) => Math.min(w + 6, F.to) - Math.max(w, F.from) + 1 < 7);
    mk("c-week", { data: { labels: weeks.map((w, i) => "Wk " + lblShort(w) + (partial[i] ? "*" : "")), datasets: [
      { type: "bar", label: "Profit", unit: "money", data: wv, backgroundColor: wv.map((v, i) => (partial[i] ? "#a8dcc6" : v >= 0 ? "#1baf7a" : "#b42318")), borderWidth: 0, order: 2 },
      { type: "line", label: "Profit margin", unit: "pct", data: wm, yAxisID: "y1", borderColor: "#1f4e79", backgroundColor: "#1f4e79", pointRadius: 3, order: 1 },
    ] }, options: { scales: { x: gridScale({ grid: { display: false }, ticks: { color: COLORS.ink, maxRotation: 0, autoSkipPadding: 10 } }), y: yScale("money"), y1: yScale("pct", { position: "right", grid: { display: false } }) },
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: tipLabel, footer: (items) => { const i = items[0].dataIndex; const c = i ? chg(wv[i], wv[i - 1]) : null; return (c == null ? "" : `Change vs week before: ${c >= 0 ? "+" : ""}${(c * 100).toFixed(1)}%`) + (partial[i] ? "\n* part week in the selected dates" : ""); } } } } } });
    // expense by department
    const gdep = [...group(idx, (i) => D.dim.dept[i]).entries()].filter(([, v]) => v.exp > 0).sort((a, b) => b[1].exp - a[1].exp).slice(0, 14);
    $("#c-dept").parentElement.style.height = Math.max(250, gdep.length * 26 + 50) + "px";
    mk("c-dept", { type: "bar", data: { labels: gdep.map(([k]) => D.dict.dept[k]), datasets: [{ label: "Expense", unit: "money", data: gdep.map(([, v]) => v.exp), backgroundColor: "#eb6834" }] },
      options: { indexAxis: "y", scales: { x: yScale("money", { beginAtZero: true }), y: catTicks() }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => { const tot = gdep.reduce((a, [, v]) => a + v.exp, 0); return ` ${money(c.parsed.x)} (${pct(c.parsed.x / tot)} of expense)`; } } } } } });
    renderHeat(idx);
    // loss by hotel
    const gh = [...group(idx, (i) => D.dim.hotel[i]).entries()].sort((a, b) => b[1].loss - a[1].loss);
    mk("c-loss-hotel", { type: "bar", data: { labels: gh.map(([k, v]) => (narrow() ? D.dict.hotel[k] : `${D.dict.hotel[k]}${v.rev ? ` (${pct(v.loss / v.rev, 2)})` : ""}`)), datasets: [{ label: "Loss", unit: "money", data: gh.map(([, v]) => v.loss), backgroundColor: "#b42318" }] },
      options: { indexAxis: "y", scales: { x: yScale("money", { beginAtZero: true }), y: catTicks() }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => { const v = gh[c.dataIndex][1]; return ` ${money(v.loss)}${v.rev ? ` (${pct(v.loss / v.rev, 2)} of revenue)` : ""}`; } } } } } });
    const lossIdx = idx.filter((i) => D.m.loss[i]);
    const gt = [...group(lossIdx, (i) => D.dim.cat[i]).entries()].sort((a, b) => b[1].loss - a[1].loss).slice(0, 10);
    mk("c-loss-type", { type: "bar", data: { labels: gt.map(([k]) => D.dict.cat[k]), datasets: [{ label: "Loss", unit: "money", data: gt.map(([, v]) => v.loss), backgroundColor: "#d6409f" }] },
      options: { indexAxis: "y", scales: { x: yScale("money", { beginAtZero: true }), y: catTicks() }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.parsed.x)} from ${nf(gt[c.dataIndex][1].lossN)} entries` } } } } });
    const gs = [...group(lossIdx, (i) => D.dim.staff[i]).entries()].filter(([k]) => D.dict.staff[k] !== "(not given)").sort((a, b) => b[1].loss - a[1].loss).slice(0, 10);
    const hotelOf = (k) => { const g = group(lossIdx.filter((i) => D.dim.staff[i] === k), (i) => D.dim.hotel[i]); const top = [...g.entries()].sort((a, b) => b[1].loss - a[1].loss)[0]; return top ? D.dict.hotel[top[0]] : ""; };
    mk("c-loss-staff", { type: "bar", data: { labels: gs.map(([k]) => D.dict.staff[k]), datasets: [{ label: "Loss", unit: "money", data: gs.map(([, v]) => v.loss), backgroundColor: "#eb6834" }] },
      options: { indexAxis: "y", scales: { x: yScale("money", { beginAtZero: true }), y: catTicks() }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.parsed.x)} from ${nf(gs[c.dataIndex][1].lossN)} entries`, afterLabel: (c) => ` Mostly at ${hotelOf(gs[c.dataIndex][0])}` } } } } });
    // profit by weekday by hotel
    const cnt = daysInRange(F.from, F.to);
    const hotels = [...group(idx, (i) => D.dim.hotel[i]).entries()].sort((a, b) => P(b[1]) - P(a[1])).slice(0, 8).map(([k]) => k);
    const cell = new Map();
    for (const i of idx) { const k = D.dim.hotel[i] + "|" + mdow(D.d[i]); let o = cell.get(k); if (!o) cell.set(k, (o = zero())); add(o, i); }
    mk("c-dow", { type: "bar", data: { labels: DOW, datasets: hotels.map((h, j) => ({ label: D.dict.hotel[h], unit: "money", data: DOW.map((_, w) => { const o = cell.get(h + "|" + w); return o && cnt[w] ? P(o) / cnt[w] : null; }), backgroundColor: PALETTE[j % PALETTE.length], borderWidth: 0 })) },
      options: { scales: { x: gridScale({ grid: { display: false } }), y: yScale("money") }, plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: tipLabel } } } } });
  }

  function renderHeat(idx) {
    const D = S.data;
    const mk2 = $("#heat-m").value;
    const box = $("#heat");
    if (!D.hourRows) { box.innerHTML = '<div class="chart-empty" style="height:200px">None of the files has a time of day.</div>'; return; }
    const cnt = daysInRange(F.from, F.to);
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let any = 0, rowsT = 0;
    for (const i of idx) { const h = D.h[i]; if (h < 0) continue; const v = D.m[mk2][i]; if (!v) continue; grid[mdow(D.d[i])][h] += v; any++; }
    for (const i of idx) if (D.h[i] >= 0) rowsT++;
    if (!any) { box.innerHTML = `<div class="chart-empty" style="height:200px">No ${MET[mk2] ? MET[mk2].label.toLowerCase() : "data"} with a time of day in the selection.</div>`; return; }
    let lo = 23, hi = 0, max = 0;
    grid.forEach((r, w) => r.forEach((v, h) => { if (v) { lo = Math.min(lo, h); hi = Math.max(hi, h); } const a = cnt[w] ? v / cnt[w] : 0; if (a > max) max = a; }));
    const unit = MET[mk2].unit;
    const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    box.innerHTML = `<table class="heat"><thead><tr><th></th>${hours.map((h) => `<th>${h % 3 === 0 || hours.length < 12 ? lblHour(h) : ""}</th>`).join("")}</tr></thead><tbody>` +
      DOW.map((dn, w) => `<tr><th class="rh">${dn}</th>${hours.map((h) => { const a = cnt[w] ? grid[w][h] / cnt[w] : 0; const t = max ? a / max : 0; return `<td style="background:${heatColor(t)}" class="${t > 0.55 ? "dk" : ""}" title="${dn} ${lblHour(h)}: ${fmtU(a, unit)} on an average day"></td>`; }).join("")}</tr>`).join("") +
      `</tbody></table><div class="heat-leg"><span>Low</span><span class="bar"></span><span>High (${fmtU(max, unit)} per hour)</span></div>`;
    $("#heat-sub").textContent = `Average ${MET[mk2].label.toLowerCase()} in each hour on a typical weekday. Uses the ${nf(rowsT)} selected rows that have a time.`;
  }

  function renderHotelTable(idx, prevIdx) {
    const D = S.data;
    const g = group(idx, (i) => D.dim.hotel[i]), gp = group(prevIdx, (i) => D.dim.hotel[i]);
    const P = MET.profit.f;
    const cols = [
      ["name", "Hotel", null], ["rev", "Revenue", "money"], ["exp", "Expense", "money"], ["loss", "Loss", "money"], ["profit", "Profit", "money"], ["margin", "Margin", "pct"],
      ["lossPct", "Loss % of rev.", "pct"], ["hrs", "Labour hours", "hours"], ["rph", "Revenue / labour hr", "money"], ["chg", "Profit change", "chg"],
    ].filter(([k]) => ["name", "profit", "margin", "chg"].includes(k) || metricsAvail().includes(k));
    const rows = [...g.entries()].map(([k, s]) => ({ name: D.dict.hotel[k], rev: s.rev, exp: s.exp, loss: s.loss, profit: P(s), margin: MET.margin.f(s), lossPct: MET.lossPct.f(s), hrs: s.hrs, rph: MET.rph.f(s), chg: gp.get(k) ? chg(P(s), P(gp.get(k))) : null }));
    const { k: sk, dir } = S.hotelSort;
    rows.sort((a, b) => (sk === "name" ? a.name.localeCompare(b.name) * -dir : ((a[sk] ?? -Infinity) - (b[sk] ?? -Infinity)) * dir));
    const tot = total(idx), tp = total(prevIdx);
    const totRow = { name: "All selected", rev: tot.rev, exp: tot.exp, loss: tot.loss, profit: P(tot), margin: MET.margin.f(tot), lossPct: MET.lossPct.f(tot), hrs: tot.hrs, rph: MET.rph.f(tot), chg: prevIdx.length ? chg(P(tot), P(tp)) : null };
    const cellF = (r, [k, , u]) => (k === "name" ? `<td>${esc(r.name)}</td>` : u === "chg" ? `<td class="num">${chgHtml(r.chg)}</td>` : `<td class="num${k === "profit" && r.profit < 0 ? " neg" : ""}">${fmtU(r[k], u)}</td>`);
    $("#t-hotels").innerHTML = `<thead><tr>${cols.map(([k, l]) => `<th class="sortable${k === "name" ? "" : " num"}" data-sort="${k}">${l}${sk === k ? (dir < 0 ? " ▾" : " ▴") : ""}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr>${cols.map((c) => cellF(r, c)).join("")}</tr>`).join("") + `</tbody><tfoot><tr style="font-weight:600;background:var(--surface-2)">${cols.map((c) => cellF(totRow, c)).join("")}</tr></tfoot>`;
    S.hotelCsv = { head: cols.map((c) => c[1]), rows: rows.concat([totRow]).map((r) => cols.map(([k]) => r[k])) };
  }

  function renderInsights(idx) {
    const D = S.data;
    const out = [];
    const P = MET.profit.f;
    if (!idx.length) { $("#insights").innerHTML = "<li>No rows match the current filters.</li>"; return; }
    const gd = group(idx, (i) => D.d[i]);
    const dayList = [...gd.entries()].map(([d, s]) => [d, P(s)]).sort((a, b) => b[1] - a[1]);
    if (dayList.length > 2) out.push(`Best day: <b>${lblDay(dayList[0][0])}</b> (${money(dayList[0][1])} profit). Weakest day: <b>${lblDay(dayList[dayList.length - 1][0])}</b> (${money(dayList[dayList.length - 1][1])}).`);
    // weekend vs weekday
    const wk = total(idx.filter((i) => mdow(D.d[i]) >= 5)), wd = total(idx.filter((i) => mdow(D.d[i]) < 5));
    const cnt = daysInRange(F.from, F.to), nWe = cnt[5] + cnt[6], nWd = cnt.slice(0, 5).reduce((a, b) => a + b, 0);
    if (nWe && nWd && wk.rev && wd.rev) out.push(`An average weekend day makes <b>${money(P(wk) / nWe)}</b> profit (margin ${pct(MET.margin.f(wk))}) against <b>${money(P(wd) / nWd)}</b> on a weekday (margin ${pct(MET.margin.f(wd))}).`);
    // anomalies per hotel and day (robust z-score on expense and profit)
    const hd = new Map();
    for (const i of idx) { const k = D.dim.hotel[i] + "|" + D.d[i]; let o = hd.get(k); if (!o) hd.set(k, (o = zero())); add(o, i); }
    const byHotel = new Map();
    hd.forEach((s, k) => { const [h, d] = k.split("|").map(Number); if (!byHotel.has(h)) byHotel.set(h, []); byHotel.get(h).push([d, s]); });
    const anomalies = [];
    const med = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    byHotel.forEach((list, h) => {
      if (list.length < 10) return;
      for (const key of ["exp", "loss"]) {
        if (!D.has[key]) continue;
        // compare each day with the same weekday where there is enough history (weekly bills, weekend peaks)
        const base = (sub) => { const vals = sub.map(([, s]) => s[key]); const m = med(vals); return [m, med(vals.map((v) => Math.abs(v - m))) * 1.4826 || Math.max(1, m * 0.05)]; };
        const all = base(list);
        const byDow = [0, 1, 2, 3, 4, 5, 6].map((w) => { const sub = list.filter(([d]) => mdow(d) === w); return sub.length >= 4 ? base(sub) : all; });
        list.forEach(([d, s]) => { const [m, mad] = byDow[mdow(d)]; const z = (s[key] - m) / mad; if (z > 4 && s[key] > m * 1.5) anomalies.push({ h, d, key, z, v: s[key], m }); });
      }
    });
    anomalies.sort((a, b) => b.z - a.z);
    const seen = new Set();
    anomalies.filter((a) => { const k = a.h + a.key; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4).forEach((a) => {
      const rowsHD = idx.filter((i) => D.dim.hotel[i] === a.h && D.d[i] === a.d && D.m[a.key][i]);
      const by = [...group(rowsHD, (i) => D.dim.dept[i]).entries()].sort((x, y) => y[1][a.key] - x[1][a.key])[0];
      const run = anomalies.filter((b) => b.h === a.h && b.key === a.key).length;
      out.push(`<b>Unusual ${a.key === "exp" ? "expense" : "loss"}:</b> ${esc(D.dict.hotel[a.h])} on ${lblDay(a.d)}, ${money(a.v)} against a usual ${money(a.m)}${by ? `, mostly ${esc(D.dict.dept[by[0]])}` : ""}${run > 1 ? ` (${run} unusual days in the selection)` : ""}.`);
    });
    // trend: first half vs second half revenue and profit per hotel
    const len = F.to - F.from + 1;
    if (len >= 14) {
      const mid = F.from + Math.floor(len / 2);
      const a = group(idx.filter((i) => D.d[i] < mid), (i) => D.dim.hotel[i]), b = group(idx.filter((i) => D.d[i] >= mid), (i) => D.dim.hotel[i]);
      const tr = [...b.entries()].map(([h, s]) => [h, a.get(h) ? chg(s.rev, a.get(h).rev) : null]).filter((x) => x[1] != null).sort((x, y) => x[1] - y[1]);
      if (tr.length > 1) {
        const lo = tr[0], hi = tr[tr.length - 1];
        out.push(`Revenue trend (second half of the period against the first): weakest <b>${esc(D.dict.hotel[lo[0]])}</b> ${chgHtml(lo[1])}, strongest <b>${esc(D.dict.hotel[hi[0]])}</b> ${chgHtml(hi[1])}.`);
      }
    }
    // staff loss outliers
    if (D.has.loss && dimsAvail().some((d) => d.k === "staff")) {
      const li = idx.filter((i) => D.m.loss[i]);
      const gs = [...group(li, (i) => D.dim.staff[i]).entries()].filter(([k, s]) => s.lossN >= 3 && D.dict.staff[k] !== "(not given)");
      if (gs.length >= 8) {
        const vals = gs.map(([, s]) => s.loss).sort((a, b) => a - b);
        const q1 = vals[Math.floor(vals.length * 0.25)], q3 = vals[Math.floor(vals.length * 0.75)], fence = q3 + 3 * (q3 - q1);
        const totL = li.reduce((a, i) => a + D.m.loss[i], 0);
        gs.filter(([, s]) => s.loss > fence).sort((a, b) => b[1].loss - a[1].loss).slice(0, 3).forEach(([k, s]) => {
          const tops = [...group(li.filter((i) => D.dim.staff[i] === k), (i) => D.dim.cat[i]).entries()].sort((a, b) => b[1].loss - a[1].loss).slice(0, 2).map(([c]) => D.dict.cat[c]);
          out.push(`<b>Loss outlier:</b> ${esc(D.dict.staff[k])} recorded ${money(s.loss)} over ${s.lossN} entries (${pct(s.loss / totL)} of all loss), far above other staff${tops.length ? `, mainly ${tops.map(esc).join(" and ")}` : ""}. Worth a review.`);
        });
      }
    }
    // labour productivity
    if (D.has.hrs && D.has.rev) {
      const g = [...group(idx, (i) => D.dim.hotel[i]).entries()].filter(([, s]) => s.hrs > 0 && s.rev > 0).map(([h, s]) => [h, s.rev / s.hrs]).sort((a, b) => a[1] - b[1]);
      if (g.length > 1) out.push(`Revenue per labour hour ranges from <b>${money(g[0][1])}</b> at ${esc(D.dict.hotel[g[0][0]])} to <b>${money(g[g.length - 1][1])}</b> at ${esc(D.dict.hotel[g[g.length - 1][0]])}.`);
    }
    const unassigned = D.idx.hotel.get("Unassigned");
    if (unassigned != null) { const n = idx.filter((i) => D.dim.hotel[i] === unassigned).length; if (n) out.push(`${nf(n)} rows have no hotel and show as Unassigned. Set the hotel for those files in step 2.`); }
    $("#insights").innerHTML = out.map((x) => `<li>${x}</li>`).join("") || "<li>Nothing unusual found in this selection.</li>";
  }

  // ---------------- EDA ----------------
  function renderEDA() {
    const D = S.data;
    $("#eda-empty").hidden = !!S.files.length; $("#eda").hidden = !S.files.length;
    if (!S.files.length) return;
    $("#t-quality").innerHTML = `<thead><tr><th>File</th><th class="num">Rows</th><th class="num">Rows in report</th><th>Dates</th><th>Completeness</th><th class="num">Duplicate rows</th><th>Notes</th></tr></thead><tbody>` +
      S.files.map((f) => {
        const st = D && D.perFile[f.id];
        const iss = fileIssues(f);
        if (!st) return `<tr><td>${esc(f.label)}</td><td class="num">${nf(f.rows.length)}</td><td class="num">0</td><td>–</td><td>–</td><td class="num">${nf(f.dupes)}</td><td><span class="st bad">Not in report</span> ${iss.bad.length ? "needs a choice in step 2" : ""}</td></tr>`;
        const comp = st.cells + st.badNum ? 1 - (st.empty + st.badNum) / (st.cells + st.badNum) : 1;
        const notes = [];
        if (st.badDate) notes.push(`${nf(st.badDate)} rows with an unreadable date left out`);
        if (st.badNum) notes.push(`${nf(st.badNum)} amounts were not numbers`);
        if (st.blankNum) notes.push(`${nf(st.blankNum)} blank amounts read as 0`);
        const unused = f.map.filter((m, i) => !m.field && f.cols[i].filled > 0).length;
        if (unused) notes.push(`${unused} column${unused > 1 ? "s" : ""} not used`);
        const empty = f.cols.filter((c) => c.filled === 0).map((c) => c.name);
        if (empty.length) notes.push(`empty: ${empty.map(esc).join(", ")}`);
        if (f.dupes) notes.push("check duplicates: they are counted");
        return `<tr><td>${esc(f.label)}</td><td class="num">${nf(f.rows.length)}</td><td class="num">${nf(st.used)}</td><td style="white-space:nowrap">${st.used ? lblShort(st.minD) + " – " + lblShort(st.maxD) + " " + new Date(st.maxD * DAY).getUTCFullYear() : "–"}</td>
          <td style="min-width:120px">${pct(comp)}<div class="qbar"><i style="width:${(comp * 100).toFixed(1)}%;background:${comp > 0.97 ? "var(--good)" : comp > 0.85 ? "#e0a100" : "var(--bad)"}"></i></div></td><td class="num">${nf(f.dupes)}</td><td>${notes.join("; ") || "–"}</td></tr>`;
      }).join("") + "</tbody>";
    if (!D) { $("#t-stats").innerHTML = ""; $("#t-profile").innerHTML = ""; return; }
    // stats per measure
    const stats = MEASURES.filter((k) => D.has[k]).map((k) => {
      const v = D.m[k].filter((x) => x !== 0).sort((a, b) => a - b);
      const n = v.length, sum = v.reduce((a, b) => a + b, 0), mean = sum / n;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
      const q = (p) => v[Math.min(n - 1, Math.floor(p * (n - 1)))];
      const iqr = q(0.75) - q(0.25), out = v.filter((x) => x > q(0.75) + 3 * iqr || x < q(0.25) - 3 * iqr).length;
      return { k, n, sum, mean, sd, min: v[0], p50: q(0.5), p95: q(0.95), max: v[n - 1], out };
    });
    const u = (k) => MET[k].unit;
    $("#t-stats").innerHTML = `<thead><tr><th>Amount</th><th class="num">Rows</th><th class="num">Total</th><th class="num">Average</th><th class="num">Median</th><th class="num">Std. dev.</th><th class="num">Min</th><th class="num">95th pct</th><th class="num">Max</th><th class="num">Extreme rows</th></tr></thead><tbody>` +
      stats.map((s) => `<tr><td>${FD[s.k].label}</td><td class="num">${nf(s.n)}</td><td class="num">${fmtU(s.sum, u(s.k))}</td><td class="num">${fmtU(s.mean, u(s.k))}</td><td class="num">${fmtU(s.p50, u(s.k))}</td><td class="num">${fmtU(s.sd, u(s.k))}</td><td class="num">${fmtU(s.min, u(s.k))}</td><td class="num">${fmtU(s.p95, u(s.k))}</td><td class="num">${fmtU(s.max, u(s.k))}</td><td class="num">${nf(s.out)}</td></tr>`).join("") + "</tbody>";
    // histogram
    const hm = $("#hist-m");
    const cur = hm.value && D.has[hm.value] ? hm.value : stats[0] && stats[0].k;
    hm.innerHTML = stats.map((s) => `<option value="${s.k}"${s.k === cur ? " selected" : ""}>${FD[s.k].label}</option>`).join("");
    renderHist(cur);
    renderCorr();
    // column profile
    $("#t-profile").innerHTML = `<thead><tr><th>File</th><th>Column</th><th>Matched to</th><th>Looks like</th><th class="num">Filled</th><th class="num">Distinct</th><th>Range or examples</th></tr></thead><tbody>` +
      S.files.flatMap((f) => f.cols.map((c, i) => {
        const type = c.filled === 0 ? "empty" : c.dateRate >= 0.8 ? (c.timeInDate >= 0.8 ? "date and time" : "date") : c.timeRate >= 0.8 ? "time" : c.numRate >= 0.9 ? "number" : "text";
        const range = type === "number" ? `${nf(c.min, 2)} to ${nf(c.max, 2)}` : esc(c.ex.join(" · "));
        return `<tr><td>${esc(f.label)}</td><td><b>${esc(c.name)}</b></td><td>${f.map[i].field ? esc(fieldLabel(f.map[i].field)) : '<span class="muted">not used</span>'}</td><td>${type}</td><td class="num">${pct(c.filled, 0)}</td><td class="num">${nf(c.distinct)}${c.distinctCapped ? "+" : ""}</td><td class="sm" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${range}</td></tr>`;
      })).join("") + "</tbody>";
  }
  function renderHist(k) {
    const D = S.data;
    if (!k) return;
    const v = D.m[k].filter((x) => x !== 0).sort((a, b) => a - b);
    const lo = v[Math.floor(v.length * 0.005)], hi = v[Math.floor((v.length - 1) * 0.995)];
    const med = v[Math.floor(v.length / 2)];
    // very skewed amounts (single sales next to daily totals) read better on a log scale
    const log = lo > 0 && hi / Math.max(med, 1e-9) > 20;
    const tf = log ? Math.log10 : (x) => x, inv = log ? (x) => 10 ** x : (x) => x;
    const a0 = tf(lo), nb = 24, w = (tf(hi) - a0) / nb || 1;
    const bins = new Array(nb).fill(0);
    let clipped = 0;
    v.forEach((x) => { if (x < lo || x > hi) { clipped++; return; } bins[Math.min(nb - 1, Math.floor((tf(x) - a0) / w))]++; });
    const edge = (i) => inv(a0 + i * w);
    const unit = MET[k].unit;
    mk("c-hist", { type: "bar", data: { labels: bins.map((_, i) => fmtU(edge(i), unit, true)), datasets: [{ label: "Rows", unit: "count", data: bins, backgroundColor: MET[k].color, barPercentage: 1, categoryPercentage: 0.95 }] },
      options: { scales: { x: gridScale({ grid: { display: false }, ticks: { color: COLORS.ink, maxRotation: 0, autoSkipPadding: 8 } }), y: yScale("count", { beginAtZero: true }) },
        plugins: { legend: { display: false }, title: { display: clipped > 0 || log, text: (log ? "Log scale: each bar covers a wider range than the last. " : "") + (clipped ? `${clipped} extreme rows beyond the 0.5–99.5% range not drawn.` : ""), color: COLORS.muted, font: { size: 11.5, weight: "normal" }, position: "bottom" },
          tooltip: { callbacks: { title: (it) => `${fmtU(edge(it[0].dataIndex), unit)} to ${fmtU(edge(it[0].dataIndex + 1), unit)}`, label: (c) => ` ${nf(c.parsed.y)} rows` } } } } });
  }
  function renderCorr() {
    const D = S.data;
    const ks = MEASURES.filter((k) => D.has[k]);
    const box = $("#corr");
    if (ks.length < 2) { box.innerHTML = '<p class="muted">Needs at least two kinds of amount.</p>'; return; }
    const g = new Map();
    for (let i = 0; i < D.n; i++) { const key = D.dim.hotel[i] + "|" + D.d[i]; let o = g.get(key); if (!o) g.set(key, (o = zero())); add(o, i); }
    const rows = [...g.values()];
    const col = (k) => rows.map((r) => r[k]);
    const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return va && vb ? c / Math.sqrt(va * vb) : 0; };
    const cols = ks.map(col);
    const color = (r) => (r >= 0 ? heatColor(r) : `rgb(${Math.round(253 + (235 - 253) * -r)},${Math.round(236 + (104 - 236) * -r)},${Math.round(234 + (52 - 234) * -r)})`);
    box.innerHTML = `<table class="heat" style="font-size:12px"><thead><tr><th></th>${ks.map((k) => `<th>${SHORT[k]}</th>`).join("")}</tr></thead><tbody>` +
      ks.map((a, i) => `<tr><th class="rh">${SHORT[a]}</th>${ks.map((b, j) => { const r = i === j ? 1 : corr(cols[i], cols[j]); return `<td style="background:${color(r)};height:34px" class="${Math.abs(r) > 0.55 ? "dk" : ""}" title="${FD[a].label} and ${FD[b].label}: ${r.toFixed(2)}">${r.toFixed(2)}</td>`; }).join("")}</tr>`).join("") +
      `</tbody></table><p class="note">Based on ${nf(rows.length)} hotel-days. Blue = rise together, orange = one rises as the other falls.</p>`;
  }

  // ---------------- benchmarks ----------------
  function parseBench(text) {
    const res = Papa.parse(String(text).replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
    const hmap = {};
    (res.meta.fields || []).forEach((h) => (hmap[norm(h)] = h));
    const need = ["date", "property", "group", "source", "metric", "value"];
    const miss = need.filter((k) => !hmap[k]);
    if (miss.length) throw new Error("missing columns: " + miss.join(", "));
    const rows = [];
    for (const r of res.data) {
      const p = parseDate(r[hmap.date], "mdy", false), v = num(r[hmap.value]);
      if (!p || v == null) continue;
      const grp = norm(r[hmap.group]);
      rows.push({ d: p.d, prop: String(r[hmap.property]).trim(), group: grp.startsWith("own") ? "Own" : grp.startsWith("sis") ? "Sister" : "Competitor", source: String(r[hmap.source]).trim(), metric: String(r[hmap.metric]).trim(), v });
    }
    if (!rows.length) throw new Error("no readable rows");
    return rows;
  }
  function renderBench() {
    const B = S.bench;
    $("#bench-src").innerHTML = S.benchCustom
      ? `<b>Showing your benchmark file:</b> ${esc(S.benchName)} (${nf(B ? B.length : 0)} rows). Stored only in this browser.`
      : `<b>Sample data, not real market figures.</b> The competitor hotels, occupancy, rates and review scores below are made up to show how this section works. Load your own licensed benchmark file to replace them.`;
    if (!B) return;
    const isRev = (m) => /rating|review/i.test(m);
    const market = [...new Set(B.filter((r) => !isRev(r.metric) && !isRev(r.source)).map((r) => r.metric))];
    const own = [...new Set(B.filter((r) => r.group !== "Competitor").map((r) => r.prop))];
    const ms = $("#bm-metric"), ps = $("#bm-prop");
    const mCur = market.includes(ms.value) ? ms.value : market.includes("RevPAR") ? "RevPAR" : market[0];
    const pCur = own.includes(ps.value) ? ps.value : own[0];
    ms.innerHTML = market.map((m) => `<option${m === mCur ? " selected" : ""}>${esc(m)}</option>`).join("");
    ps.innerHTML = own.map((m) => `<option${m === pCur ? " selected" : ""}>${esc(m)}</option>`).join("");
    const unitOf = (m) => (/%|occ/i.test(m) ? "pct100" : /adr|revpar|rate|price/i.test(m) ? "money" : "count");
    const fmtB = (v, m) => (unitOf(m) === "pct100" ? nf(v, 1) + "%" : unitOf(m) === "money" ? money(v) : nf(v, 2));
    if (mCur) {
      const rows = B.filter((r) => r.metric === mCur);
      const dates = [...new Set(rows.map((r) => r.d))].sort((a, b) => a - b);
      const comp = dates.map((d) => rows.filter((r) => r.d === d && r.group === "Competitor").map((r) => r.v));
      const avg = comp.map((a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null));
      const mine = dates.map((d) => { const r = rows.find((x) => x.d === d && x.prop === pCur); return r ? r.v : null; });
      $("#bm-t1").textContent = `${pCur || "Your hotel"} against the competitor set: ${mCur}`;
      const tick = { ticks: { color: COLORS.ink, callback: (v) => fmtB(v, mCur) } };
      mk("c-bm-trend", { type: "line", data: { labels: dates.map((d) => "Wk " + lblShort(d)), datasets: [
        { label: "Competitor highest", data: comp.map((a) => (a.length ? Math.max(...a) : null)), borderColor: "transparent", backgroundColor: "rgba(154,164,174,.18)", fill: "+1", pointRadius: 0 },
        { label: "Competitor lowest", data: comp.map((a) => (a.length ? Math.min(...a) : null)), borderColor: "transparent", backgroundColor: "rgba(154,164,174,.18)", pointRadius: 0 },
        { label: "Competitor average", data: avg, borderColor: "#6b7682", backgroundColor: "#6b7682", borderDash: [6, 4] },
        { label: pCur, data: mine, borderColor: "#2a78d6", backgroundColor: "#2a78d6", borderWidth: 2.5, pointRadius: 2.5 },
      ] }, options: { scales: { x: gridScale({ grid: { display: false }, ticks: { color: COLORS.ink, maxRotation: 0, autoSkipPadding: 10 } }), y: gridScale(tick) },
        plugins: { legend: { position: "bottom", labels: { filter: (it) => !/highest|lowest/.test(it.text) } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtB(c.parsed.y, mCur)}` } } } } });
      mk("c-bm-index", { type: "line", data: { labels: dates.map((d) => "Wk " + lblShort(d)), datasets: own.map((p, j) => ({
        label: p, data: dates.map((d, i) => { const r = rows.find((x) => x.d === d && x.prop === p); return r && avg[i] ? (r.v / avg[i]) * 100 : null; }),
        borderColor: PALETTE[j % PALETTE.length], backgroundColor: PALETTE[j % PALETTE.length], borderWidth: p === pCur ? 3 : 1.5, pointRadius: 0,
      })) }, options: { scales: { x: gridScale({ grid: { display: false }, ticks: { color: COLORS.ink, maxRotation: 0, autoSkipPadding: 10 } }), y: gridScale({ ticks: { color: COLORS.ink } }) },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${nf(c.parsed.y, 1)}` } } } }, plugins: [refLine(100)] });
    }
    // reviews
    const rr = B.filter((r) => /rating/i.test(r.metric));
    const srcs = [...new Set(rr.map((r) => r.source))];
    const ss = $("#bm-src");
    const sCur = srcs.includes(ss.value) ? ss.value : srcs[0];
    ss.innerHTML = srcs.map((s) => `<option${s === sCur ? " selected" : ""}>${esc(s)}</option>`).join("");
    if (!sCur) return;
    const rs = rr.filter((r) => r.source === sCur);
    const scale = Math.max(...rs.map((r) => r.v)) > 5 ? 2 : 1;
    const last = Math.max(...rs.map((r) => r.d));
    const lr = rs.filter((r) => r.d === last).sort((a, b) => b.v - a.v);
    const gc = { Own: "#2a78d6", Sister: "#eda100", Competitor: "#9aa4ae" };
    $("#c-bm-rating").parentElement.style.height = Math.max(300, lr.length * 24 + 60) + "px";
    mk("c-bm-rating", { type: "bar", data: { labels: lr.map((r) => r.prop), datasets: [{ label: "Rating", data: lr.map((r) => r.v / scale), backgroundColor: lr.map((r) => gc[r.group]) }] },
      options: { indexAxis: "y", scales: { x: gridScale({ min: Math.max(0, Math.floor(Math.min(...lr.map((r) => r.v / scale)) * 2) / 2 - 0.5), max: 5 }), y: catTicks() },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${lr[c.dataIndex].group}: ${nf(c.parsed.x, 2)} out of 5` } }, subtitle: { display: true, text: `${lblShort(last)} ${new Date(last * DAY).getUTCFullYear()} · blue = yours, amber = sister hotels, grey = competitors`, color: COLORS.muted, font: { size: 11.5 }, position: "bottom" } } } });
    const months = [...new Set(rs.map((r) => r.d))].sort((a, b) => a - b);
    const ownP = [...new Set(rs.filter((r) => r.group !== "Competitor").map((r) => r.prop))];
    mk("c-bm-rtrend", { type: "line", data: { labels: months.map((d) => lblMonth(monthOf(d))), datasets: ownP.map((p, j) => ({
      label: p, data: months.map((d) => { const r = rs.find((x) => x.d === d && x.prop === p); return r ? r.v / scale : null; }), borderColor: PALETTE[j % PALETTE.length], backgroundColor: PALETTE[j % PALETTE.length], pointRadius: 3,
    })).concat([{ label: "Competitor average", data: months.map((d) => { const a = rs.filter((x) => x.d === d && x.group === "Competitor").map((x) => x.v / scale); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }), borderColor: "#6b7682", backgroundColor: "#6b7682", borderDash: [6, 4], pointRadius: 0 }]) },
      options: { scales: { x: gridScale({ grid: { display: false } }), y: gridScale({ suggestedMin: 3, suggestedMax: 5 }) }, plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${nf(c.parsed.y, 2)}` } } } } });
  }
  const refLine = (y) => ({ id: "ref", afterDatasetsDraw(c) { const s = c.scales.y; if (!s) return; const py = s.getPixelForValue(y); const { left, right } = c.chartArea; const ctx = c.ctx; ctx.save(); ctx.strokeStyle = COLORS.ink; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke(); ctx.restore(); } });
  async function loadBench() {
    const saved = await idb.get("bench");
    if (saved) { try { S.bench = parseBench(saved.text); S.benchName = saved.name; S.benchCustom = true; return; } catch (e) { /* fall back to sample */ } }
    try { S.bench = parseBench(await fetch("samples/benchmark_sample.csv").then((r) => r.text())); S.benchCustom = false; } catch (e) { S.bench = null; }
  }

  // ---------------- orchestration ----------------
  function refreshAll() {
    buildAliases();
    renderFiles();
    renderMapping();
    renderValues();
    buildData();
    renderReport();
    renderEDA();
  }
  let rt;
  const refreshSoon = () => { clearTimeout(rt); rt = setTimeout(() => { busy(true); requestAnimationFrame(() => { refreshAll(); busy(false); }); }, 30); };
  function busy(on) { $("#busy").classList.toggle("on", on); }
  function toast(msg) { $("#rep-sub").dataset.msg = msg; }
  function download(name, head, rows) {
    const q = (v) => { const s = v == null ? "" : typeof v === "number" ? String(Math.round(v * 10000) / 10000) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const blob = new Blob([[head, ...rows].map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------------- events ----------------
  function wire() {
    const drop = $("#drop");
    ["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (ev) => { if (ev.dataTransfer.files.length) readUpload([...ev.dataTransfer.files]); });
    $("#f-in").onchange = (e) => { readUpload([...e.target.files]); e.target.value = ""; };
    $("#b-sample").onclick = async () => { await loadSamples(); T.noAutoSample = false; saveT(); refreshAll(); };
    $("#b-clear").onclick = async () => {
      if (!S.files.length || !confirm("Remove all files from this browser? Your saved matching rules are kept.")) return;
      await idb.clear(); S.files = []; T.noAutoSample = true; saveT(); F.sets = {}; F.dow = null; refreshAll();
    };
    $("#files").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]"); if (!b) return;
      const f = S.files[+b.dataset.del];
      S.files.splice(+b.dataset.del, 1); await idb.del(f.id);
      if (!S.files.length) { T.noAutoSample = true; saveT(); }
      refreshSoon();
    });
    $("#files").addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-label]"); if (!inp) return;
      const f = S.files[+inp.dataset.label];
      f.label = inp.value.trim() || labelFromName(f.name);
      saveTpl(f, { label: f.label });
      await idb.put({ id: f.id, name: f.name, text: f.text, label: f.label, order: f.order });
      refreshSoon();
    });
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tab]");
      if (t) { S.tab = +t.dataset.tab; renderMapping(); if (t.tagName === "A") { e.preventDefault(); $("#ftabs").scrollIntoView({ behavior: "smooth", block: "start" }); } }
    });
    $("#colmap").addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-col]"); if (!sel) return;
      const f = S.files[S.tab], i = +sel.dataset.col;
      let v = sel.value;
      if (v === "__new") {
        const name = (prompt("Name of the new field (for example: Market segment, Room type, Shift):", f.cols[i].name) || "").trim();
        if (!name) { sel.value = f.map[i].field; return; }
        v = "c:" + name;
      }
      f.map[i] = { field: v, state: "man", why: "set by you" };
      saveTpl(f, { map: { [f.cols[i].key]: v } });
      if (v === "date") f.dateOrder = f.cols[i].order;
      refreshSoon();
    });
    $("#defaults").addEventListener("change", (e) => {
      const f = S.files[S.tab];
      if (e.target.id === "def-hotel" || e.target.id === "def-dept") {
        const k = e.target.id === "def-hotel" ? "hotel" : "dept";
        f.defaults[k] = e.target.value.trim(); f.defAuto[k] = false;
        saveTpl(f, { defaults: { [k]: f.defaults[k] } });
      }
      if (e.target.id === "def-order") { f.dateOrder = e.target.value; saveTpl(f, { dateOrder: f.dateOrder }); }
      refreshSoon();
    });
    $("#valcols").addEventListener("change", (e) => {
      const inp = e.target.closest("[data-alias]"); if (!inp) return;
      const field = inp.dataset.alias, n = inp.dataset.n;
      const v = inp.value.trim();
      if (v) T.aliases[field][n] = v; else delete T.aliases[field][n];
      saveT(); refreshSoon();
    });
    $("#b-val-reset").onclick = () => { if (!confirm("Forget your name changes and match names automatically again?")) return; T.aliases = { hotel: {}, dept: {} }; saveT(); refreshSoon(); };
    $("#b-tpl-reset").onclick = () => {
      if (!confirm("Forget all saved column matching rules and match every file automatically again?")) return;
      T.templates = {}; saveT(); S.files.forEach((f) => { f.label = labelFromName(f.name); const s = SAMPLES.find(([n]) => n === f.name); if (s) f.label = s[1]; autoMap(f); }); refreshSoon();
    };
    $("#b-tpl-export").onclick = () => {
      const blob = new Blob([JSON.stringify({ app: "hotel-report-builder", version: 1, templates: T.templates, aliases: T.aliases }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "matching-rules.json"; a.click();
    };
    $("#tpl-in").onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = "";
      if (!file) return;
      try {
        const j = JSON.parse(await file.text());
        if (!j.templates) throw new Error("not a matching-rules file");
        Object.assign(T.templates, j.templates);
        if (j.aliases) { Object.assign(T.aliases.hotel, j.aliases.hotel || {}); Object.assign(T.aliases.dept, j.aliases.dept || {}); }
        saveT(); S.files.forEach(autoMap); refreshSoon();
      } catch (err) { alert("That file could not be read: " + err.message); }
    };
    // filters
    $("#fbar").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { e.stopPropagation(); openPop(b, b.dataset.f); } });
    $("#fbar").addEventListener("change", (e) => {
      const D = S.data;
      if (e.target.id === "f-preset") { if (e.target.value !== "custom") applyPreset(e.target.value); else F.preset = "custom"; }
      if (e.target.id === "f-from" || e.target.id === "f-to") {
        const a = dayOf($("#f-from").value), b = dayOf($("#f-to").value);
        if (isFinite(a) && isFinite(b)) { F.from = Math.max(D.minD, Math.min(a, b)); F.to = Math.min(D.maxD, Math.max(a, b)); F.preset = "custom"; }
      }
      renderReport();
    });
    document.addEventListener("click", (e) => { if (pop.classList.contains("open") && !pop.contains(e.target) && !e.target.closest("[data-f]")) closePop(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
    window.addEventListener("resize", () => { if (popFor) { const b = document.querySelector(`[data-f="${popFor}"]`); if (b) placePop(b); } });
    $("#b-freset").onclick = () => { F.sets = {}; F.dow = null; F.hFrom = 0; F.hTo = 23; applyPreset("28"); closePop(); renderReport(); };
    $("#b-print").onclick = () => window.print();
    $("#flash-day").onchange = () => renderFlash();
    $("#heat-m").onchange = () => renderHeat(rowsIn(F.from, F.to));
    $("#hist-m").onchange = (e) => renderHist(e.target.value);
    // explorer
    $("#x-metrics").addEventListener("click", (e) => {
      const b = e.target.closest("[data-m]"); if (!b) return;
      const k = b.dataset.m, i = T.x.metrics.indexOf(k);
      if (i >= 0) { if (T.x.metrics.length > 1) T.x.metrics.splice(i, 1); } else T.x.metrics.push(k);
      saveT(); renderExplorer(rowsIn(F.from, F.to));
    });
    ["x-group", "x-split", "x-type"].forEach((id) => ($("#" + id).onchange = (e) => { T.x[id.slice(2)] = e.target.value; saveT(); renderExplorer(rowsIn(F.from, F.to)); }));
    $("#b-x-csv").onclick = () => S.xTable && download("report-view.csv", S.xTable.head, S.xTable.rows);
    $("#b-h-csv").onclick = () => S.hotelCsv && download("hotel-comparison.csv", S.hotelCsv.head, S.hotelCsv.rows);
    $("#t-hotels").addEventListener("click", (e) => {
      const th = e.target.closest("[data-sort]"); if (!th) return;
      const k = th.dataset.sort;
      S.hotelSort = { k, dir: S.hotelSort.k === k ? -S.hotelSort.dir : k === "name" ? 1 : -1 };
      const len = F.to - F.from + 1;
      renderHotelTable(rowsIn(F.from, F.to), rowsIn(F.from - len, F.from - 1));
    });
    // benchmarks
    ["bm-metric", "bm-prop", "bm-src"].forEach((id) => ($("#" + id).onchange = renderBench));
    $("#bench-in").onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = "";
      if (!file) return;
      try {
        let text;
        if (/\.xlsx?$/i.test(file.name)) { const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]); }
        else text = await file.text();
        S.bench = parseBench(text); S.benchName = file.name; S.benchCustom = true;
        await idb.set("bench", { name: file.name, text });
        renderBench();
      } catch (err) { alert("That benchmark file could not be read: " + err.message + ". It needs the columns date, property, group, source, metric, value."); }
    };
    window.addEventListener("themechange", () => { if (S.data) { renderHeat(rowsIn(F.from, F.to)); renderCorr(); } });
    $("#b-bench-reset").onclick = async () => { await idb.delKv("bench"); await loadBench(); renderBench(); };
  }

  async function init() {
    chartDefaults();
    Chart.register({
      id: "emptyMsg",
      afterDraw(c) {
        const has = c.data.datasets.some((ds) => ds.data.some((v) => v != null && v !== 0));
        if (has) return;
        const { ctx, width, height } = c;
        ctx.save(); ctx.fillStyle = COLORS.muted; ctx.font = "14px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Nothing to show for these filters", width / 2, height / 2); ctx.restore();
      },
    });
    wire();
    busy(true);
    const recs = await idb.all();
    if (recs.length) recs.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(addFile);
    else if (!T.noAutoSample) await loadSamples();
    await loadBench();
    refreshAll();
    renderBench();
    busy(false);
  }
  init();
})();
