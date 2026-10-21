// Hotel Workforce Suite: date helpers, pay rules and the fictional demo data set.
// Everything is generated in the browser relative to today, so the demo always looks current.
"use strict";

const WF = (() => {
  // ---------- Dates and times (local time, "YYYY-MM-DD" and "HH:MM") ----------
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const dow = (s) => parse(s).getDay();
  const weekStart = (s) => addDays(s, -dow(s));
  const today = () => iso(new Date());
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const toMin = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toHM = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const span = (a, b) => { const x = toMin(a), y = toMin(b); return y > x ? y - x : y + 1440 - x; };
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtD = (s) => { const d = parse(s); return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; };
  const fmtDs = (s) => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
  const fmtDY = (s) => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
  const fmtT = (t) => { if (!t) return "–"; const m = toMin(t); const h = Math.floor(m / 60) % 24; return `${h % 12 || 12}:${pad(m % 60)}${h < 12 ? "a" : "p"}`; };
  const money = (v, d = 2) => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
  const hrs = (m) => (m / 60).toFixed(2);

  // Ontario statutory holidays (the demo hotels are in Ontario).
  const HOLIDAYS = {
    "2026-01-01": "New Year's Day", "2026-02-16": "Family Day", "2026-04-03": "Good Friday", "2026-05-18": "Victoria Day",
    "2026-07-01": "Canada Day", "2026-09-07": "Labour Day", "2026-10-12": "Thanksgiving", "2026-12-25": "Christmas Day", "2026-12-26": "Boxing Day",
    "2027-01-01": "New Year's Day", "2027-02-15": "Family Day", "2027-03-26": "Good Friday", "2027-05-24": "Victoria Day",
    "2027-07-01": "Canada Day", "2027-09-06": "Labour Day", "2027-10-11": "Thanksgiving", "2027-12-25": "Christmas Day", "2027-12-26": "Boxing Day",
  };

  // Bi-weekly pay periods start on Sundays, counted from this anchor.
  const ANCHOR = "2026-01-04";
  const periodStart = (s) => addDays(ANCHOR, Math.floor(diffDays(ANCHOR, s) / 14) * 14);
  const payDate = (ps) => addDays(ps, 19); // the Friday after the period closes

  // ---------- Company structure ----------
  const PROPS = [
    { id: "p1", name: "Lakeshore Grand Toronto", short: "Lakeshore Grand", rooms: 186, city: "Toronto" },
    { id: "p2", name: "Harbourview Inn Niagara", short: "Harbourview Inn", rooms: 112, city: "Niagara-on-the-Lake" },
    { id: "p3", name: "Rideau Suites Ottawa", short: "Rideau Suites", rooms: 134, city: "Ottawa" },
  ];
  const DEPTS = [
    { id: "fo", name: "Front Office", color: "#2a78d6" },
    { id: "hk", name: "Housekeeping", color: "#1baf7a" },
    { id: "fb", name: "Food & Beverage", color: "#eb6834" },
    { id: "kt", name: "Kitchen", color: "#c2410c" },
    { id: "mt", name: "Maintenance", color: "#6b7682" },
    { id: "sa", name: "Sales & Events", color: "#8b5cf6" },
    { id: "ad", name: "Administration", color: "#1f4e79" },
  ];
  const POS = {
    gm: { name: "General Manager", dept: "ad", salary: 118000 },
    hrc: { name: "HR & Payroll Coordinator", dept: "ad", wage: 28.5 },
    fom: { name: "Front Office Manager", dept: "fo", salary: 68000 },
    gss: { name: "Guest Services Supervisor", dept: "fo", wage: 24.25 },
    fda: { name: "Front Desk Agent", dept: "fo", wage: 19.75 },
    na: { name: "Night Auditor", dept: "fo", wage: 21.5 },
    eh: { name: "Executive Housekeeper", dept: "hk", salary: 62000 },
    hks: { name: "Housekeeping Supervisor", dept: "hk", wage: 23.0 },
    ra: { name: "Room Attendant", dept: "hk", wage: 19.25 },
    hp: { name: "Houseperson", dept: "hk", wage: 18.9 },
    fbs: { name: "F&B Supervisor", dept: "fb", wage: 23.5 },
    srv: { name: "Server", dept: "fb", wage: 18.1, tips: true },
    bar: { name: "Bartender", dept: "fb", wage: 19.0, tips: true },
    sc: { name: "Sous Chef", dept: "kt", wage: 27.5 },
    lc: { name: "Line Cook", dept: "kt", wage: 21.25 },
    pc: { name: "Prep Cook", dept: "kt", wage: 19.4 },
    mtt: { name: "Maintenance Technician", dept: "mt", wage: 27.0 },
    slc: { name: "Sales Coordinator", dept: "sa", wage: 25.0 },
  };
  // Staff list per property: [position, FT/PT]
  const ROSTER = [
    ["gm", "FT"], ["hrc", "FT"],
    ["fom", "FT"], ["gss", "FT"], ["fda", "FT"], ["fda", "FT"], ["fda", "PT"], ["na", "FT"],
    ["eh", "FT"], ["hks", "FT"], ["ra", "FT"], ["ra", "FT"], ["ra", "FT"], ["ra", "PT"], ["hp", "FT"],
    ["fbs", "FT"], ["srv", "FT"], ["srv", "PT"], ["srv", "PT"], ["bar", "FT"],
    ["sc", "FT"], ["lc", "FT"], ["lc", "FT"], ["pc", "PT"],
    ["mtt", "FT"], ["slc", "FT"],
  ];
  // Daily shift needs per department: [start, end, count on weekdays, count on Fri/Sat, weekdaysOnly]
  const SLOTS = {
    fo: [["07:00", "15:00", 1, 1], ["15:00", "23:00", 1, 2], ["23:00", "07:00", 1, 1]],
    hk: [["07:00", "15:00", 1, 1], ["08:00", "16:00", 3, 4]],
    fb: [["06:30", "14:30", 1, 1], ["16:00", "00:00", 2, 3]],
    kt: [["06:00", "14:00", 1, 1], ["14:00", "22:00", 2, 2]],
    mt: [["08:00", "16:00", 1, 0, true]],
    sa: [["09:00", "17:00", 1, 1, true]],
    ad: [["09:00", "17:00", 1, 1, true]],
  };
  const CERTS = { fb: "Smart Serve", kt: "Food Handler Certificate" };

  const FIRST = ["Aisha", "Ben", "Carmen", "Daniel", "Elena", "Farhan", "Grace", "Hiro", "Isabel", "Jamal", "Keira", "Liam", "Maya", "Noah", "Olivia", "Priya", "Quinn", "Rafael", "Sofia", "Tariq", "Uma", "Victor", "Wen", "Ximena", "Yusuf", "Zara", "Amir", "Bianca", "Chen", "Divya", "Emeka", "Fatima", "Gabriel", "Hannah", "Ibrahim", "Jasmine", "Kofi", "Leah", "Mateo", "Nadia", "Omar", "Paula", "Ravi", "Sana", "Tomas", "Ana", "Wei", "Lucas", "Mei", "Nikhil", "Rosa", "Sam", "Tanvi", "Owen", "Hana", "Diego", "Ines", "Jordan", "Kavya", "Marco", "Nora", "Pedro", "Riya", "Simone", "Theo", "Vera", "Yara", "Alex", "Brooke", "Cyrus", "Dana", "Eli", "Fern", "Gita", "Hugo", "Ivy", "Jun", "Kai", "Lina", "Moses", "Nia", "Oscar"];
  const LAST = ["Ahmed", "Bouchard", "Chen", "Dubois", "Evans", "Fernandes", "Gill", "Hughes", "Ito", "Johnson", "Khan", "Lam", "Martin", "Nguyen", "Okafor", "Patel", "Quinlan", "Roy", "Singh", "Tremblay", "Usman", "Vasquez", "Wong", "Xu", "Yilmaz", "Zhang", "Abara", "Baptiste", "Costa", "Desai", "Ellis", "Forde", "Gagnon", "Haddad", "Iyer", "Jovanovic", "Kowalski", "Leblanc", "Mensah", "Novak", "Ortiz", "Pereira", "Reid", "Santos", "Thomas", "Vieira", "Walsh", "Young", "Morin", "Clarke"];

  // ---------- Small deterministic random generator ----------
  function rng(seed) {
    let a = seed >>> 0;
    const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  }

  let idn = 0;
  const uid = (p) => `${p}${(++idn).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Seed ----------
  function seed() {
    const R = rng(20261021);
    const T = today();
    const curPS = periodStart(T);
    const from = addDays(curPS, -14);              // previous pay period start
    const to = addDays(weekStart(T), 20);          // end of the week after next
    const S = {
      v: 1, seededOn: T, dataFrom: from, company: "Maple & Lake Hotels", props: PROPS, depts: DEPTS,
      settings: { otWeekly: 44, graceMin: 5, roundMin: 0, breakAfterHrs: 5, breakMin: 30, vacPayPct: 4, ehtPct: 1.95, wsibPct: 1.32, cpor: { p1: 44, p2: 39, p3: 37 } },
      emps: [], shifts: [], punches: [], timeoff: [], swaps: [], corrections: [], tsApproved: {}, payruns: {},
      onboarding: {}, announcements: [], forecast: {}, budget: {}, audit: [], published: {},
      me: { role: "manager", emp: null, prop: "p1" },
    };

    // People
    const usedNames = new Set(["Priya Raman", "Daniel Okafor", "Sofia Martin", "Lucas Ferreira", "Amara Diallo", "Jonah Whitfield", "Mina Kaur"]);
    const name = () => { for (;;) { const n = [R.pick(FIRST), R.pick(LAST)]; const k = n.join(" "); if (!usedNames.has(k)) { usedNames.add(k); return n; } } };
    let empNo = 1040;
    for (const p of PROPS) {
      for (const [pos, type] of ROSTER) {
        const P = POS[pos];
        const [first, last] = name();
        const years = R.chance(0.25) ? R.int(0, 1) : R.int(1, 12);
        const hire = addDays(T, -(years * 365 + R.int(20, 330)));
        const wageBump = 1 + Math.min(years, 8) * 0.012 + R.int(0, 3) * 0.005;
        const e = {
          id: "e" + (++empNo), no: empNo, first, last, prop: p.id, dept: P.dept, pos, type,
          pay: P.salary ? "salary" : "hourly",
          wage: P.salary ? Math.round(P.salary * (1 + R.int(0, 8) / 100) / 500) * 500 : Math.round(P.wage * wageBump * 4) / 4,
          hire, status: "active", birthday: `${pad(R.int(1, 12))}-${pad(R.int(1, 28))}`,
          email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@maplelake.example",
          phone: `(${R.pick(["416", "647", "905", "613", "289"])}) 555-${pad(R.int(10, 99))}${pad(R.int(10, 99))}`,
          pin: String(1000 + (empNo * 7919) % 9000).slice(0, 4),
          maxShifts: type === "FT" ? 5 : R.pick([3, 3, 4]),
          avail: [0, 1, 2, 3, 4, 5, 6].map(() => (type === "PT" && R.chance(0.2) ? "off" : "any")),
          bal: { vac: type === "FT" ? R.int(24, 112) : R.int(0, 24), sick: R.pick([16, 24, 24, 32, 40]), per: R.pick([0, 8, 8, 16]) },
          certs: [], emergency: { name: `${R.pick(FIRST)} ${last}`, rel: R.pick(["Spouse", "Parent", "Sibling", "Partner", "Friend"]), phone: `(${R.pick(["416", "905", "613"])}) 555-${pad(R.int(10, 99))}${pad(R.int(10, 99))}` },
          address: `${R.int(12, 980)} ${R.pick(["King St W", "Queen St E", "Bay St", "Lakeshore Blvd", "Bank St", "Elgin St", "Victoria Ave", "Main St", "Dundas St", "Carling Ave"])}, ${p.city}, ON`,
          union: ["ra", "hp", "srv", "bar", "lc", "pc", "fda", "na"].includes(pos) && p.id !== "p2",
        };
        if (CERTS[P.dept]) e.certs.push({ name: CERTS[P.dept], exp: addDays(T, R.int(-20, 900)) });
        if (R.chance(0.35)) e.certs.push({ name: "Standard First Aid & CPR", exp: addDays(T, R.int(-10, 700)) });
        e.certs.push({ name: "WHMIS training", exp: addDays(T, R.int(30, 1000)) });
        if (pos === "na" || pos === "gss" || pos === "fom") e.certs.push({ name: "Cash handling", exp: addDays(T, R.int(60, 700)) });
        S.emps.push(e);
      }
    }
    // Fixed demo personas at the Lakeshore Grand
    const p1 = S.emps.filter((e) => e.prop === "p1");
    const set = (e, f, l) => { e.first = f; e.last = l; e.email = `${f}.${l}`.toLowerCase() + "@maplelake.example"; };
    const gm = p1.find((e) => e.pos === "gm"); set(gm, "Priya", "Raman"); gm.hire = addDays(T, -2400);
    const hr = p1.find((e) => e.pos === "hrc"); set(hr, "Daniel", "Okafor"); hr.hire = addDays(T, -1500);
    const agent = p1.find((e) => e.pos === "fda" && e.type === "FT"); set(agent, "Sofia", "Martin"); agent.hire = addDays(T, -900); agent.pin = "2468"; agent.bal = { vac: 56, sick: 24, per: 8 };
    S.me.emp = gm.id;
    S.personas = { manager: gm.id, hr: hr.id, employee: agent.id };

    // New hires in onboarding
    const tasksFor = (e) => {
      const t = ["Offer letter signed", "Personal details and SIN", "TD1 federal and Ontario tax forms", "Direct deposit details", "Emergency contact", "Uniform and name badge issued", "Locker and key card", "PMS and email accounts created", "Health and safety awareness training", "WHMIS training", "Department orientation shift", "Buddy assigned", "30-day check-in"];
      if (CERTS[e.dept]) t.splice(9, 0, `${CERTS[e.dept]} uploaded`);
      return t.map((x) => ({ t: x, done: false, owner: /letter|PMS|Uniform|Locker|Buddy|check-in|orientation/.test(x) ? "Manager" : /SIN|TD1|Direct|Emergency|uploaded/.test(x) ? "Employee" : "HR" }));
    };
    const newHire = (prop, pos, type, f, l, startIn, doneN) => {
      const P = POS[pos]; empNo++;
      usedNames.add(`${f} ${l}`);
      const e = { id: "e" + empNo, no: empNo, first: f, last: l, prop, dept: P.dept, pos, type, pay: "hourly", wage: P.wage, hire: addDays(T, startIn), status: "onboarding", birthday: "06-14",
        email: `${f}.${l}`.toLowerCase() + "@maplelake.example", phone: "(416) 555-0199", pin: String(3000 + empNo).slice(-4), maxShifts: type === "FT" ? 5 : 3, avail: [0, 1, 2, 3, 4, 5, 6].map(() => "any"),
        bal: { vac: 0, sick: 0, per: 0 }, certs: [], emergency: { name: "", rel: "", phone: "" }, address: "", union: false };
      S.emps.push(e);
      const tasks = tasksFor(e); tasks.slice(0, doneN).forEach((x) => (x.done = true));
      S.onboarding[e.id] = { tasks, started: addDays(T, -6) };
    };
    newHire("p1", "fda", "PT", "Lucas", "Ferreira", 5, 6);
    newHire("p1", "ra", "FT", "Amara", "Diallo", 2, 9);
    newHire("p2", "srv", "PT", "Jonah", "Whitfield", 9, 3);
    newHire("p3", "lc", "FT", "Mina", "Kaur", 12, 1);

    // Forecast occupancy per property per day
    for (const p of PROPS) {
      S.forecast[p.id] = {};
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const w = dow(d);
        const base = { p1: 0.74, p2: 0.66, p3: 0.71 }[p.id];
        const occ = Math.min(0.99, base + (w === 5 || w === 6 ? 0.15 : w === 0 ? -0.06 : 0) + (R() - 0.5) * 0.12 + (HOLIDAYS[d] ? 0.1 : 0));
        S.forecast[p.id][d] = Math.round(occ * 1000) / 1000;
      }
    }

    // Time off (approved first, so the schedule respects it)
    const hourly = S.emps.filter((e) => e.status === "active" && e.pay === "hourly");
    const mkTO = (e, type, start, days, status, note) => {
      const r = { id: uid("t"), emp: e.id, type, from: start, to: addDays(start, days - 1), hours: days * 8, status, note: note || "", created: addDays(start, -R.int(5, 30)), decidedBy: status === "pending" ? null : gm.id };
      S.timeoff.push(r); return r;
    };
    for (const p of PROPS) {
      const pool = hourly.filter((e) => e.prop === p.id && e.id !== agent.id);
      const pk = () => pool.splice(R.int(0, pool.length - 1), 1)[0];
      mkTO(pk(), "vac", addDays(T, R.int(-12, -6)), R.int(3, 5), "approved", "Family visit");
      mkTO(pk(), "vac", addDays(T, R.int(2, 8)), R.int(2, 5), "approved", "Long weekend away");
      mkTO(pk(), "sick", addDays(T, -R.int(2, 9)), 1, "approved", "Called in sick");
      mkTO(pk(), "sick", addDays(T, -R.int(10, 18)), 1, "approved", "");
      mkTO(pk(), "vac", addDays(T, R.int(6, 16)), R.int(3, 7), "pending", R.pick(["Wedding out of town", "Trip to see family", "Moving apartments"]));
      mkTO(pk(), "per", addDays(T, R.int(3, 12)), 1, "pending", R.pick(["Appointment", "Child's school event"]));
      mkTO(pk(), "vac", addDays(T, R.int(4, 14)), 2, "denied", "Concert");
    }
    mkTO(agent, "vac", addDays(T, 24), 3, "pending", "Cousin's wedding in Montreal");
    mkTO(agent, "sick", addDays(T, -19), 1, "approved", "");

    const onLeave = (empId, d) => S.timeoff.some((t) => t.emp === empId && t.status === "approved" && d >= t.from && d <= t.to);

    // Schedule: weeks from the previous period through the week after next
    for (const p of PROPS) {
      const staff = S.emps.filter((e) => e.prop === p.id && e.status === "active");
      for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
        const count = {}; const busy = {};
        staff.forEach((e) => (count[e.id] = 0));
        // Salaried managers work Mon-Fri
        staff.filter((e) => e.pay === "salary").forEach((e) => {
          for (let i = 1; i <= 5; i++) {
            const d = addDays(ws, i);
            if (onLeave(e.id, d)) continue;
            S.shifts.push({ id: uid("s"), emp: e.id, prop: p.id, dept: e.dept, pos: e.pos, date: d, start: e.pos === "gm" ? "08:30" : "09:00", end: "17:00", brk: 30, note: "" });
          }
        });
        for (let i = 0; i < 7; i++) {
          const d = addDays(ws, i), w = dow(d);
          for (const dept of Object.keys(SLOTS)) {
            for (const [st, en, nWk, nWe, wkOnly] of SLOTS[dept]) {
              if (wkOnly && (w === 0 || w === 6)) continue;
              let n = w === 5 || w === 6 ? nWe : nWk;
              if (dept === "hk") n += Math.round((S.forecast[p.id][d] - 0.75) * 6);
              for (let k = 0; k < n; k++) {
                const cands = staff.filter((e) => e.dept === dept && e.pay === "hourly" && !busy[e.id + d] && !onLeave(e.id, d) && e.avail[w] !== "off" &&
                  !(st < "12:00" && busy[e.id + addDays(d, -1) + "N"]));
                let pickE = null;
                const under = cands.filter((e) => count[e.id] < e.maxShifts + (e.type === "FT" && d <= addDays(T, 6) && R.chance(0.07) ? 1 : 0));
                if (under.length) {
                  under.sort((a, b) => count[a.id] - count[b.id] || (st === "23:00" ? (b.pos === "na") - (a.pos === "na") : 0) || R() - 0.5);
                  pickE = under[0];
                } else if (d < T && cands.length && R.chance(0.45)) {
                  pickE = R.pick(cands); // covered with overtime
                }
                const pos = pickE ? pickE.pos : staff.find((e) => e.dept === dept && e.pay === "hourly" && !/sup|hks|gss|fbs|sc/.test(e.pos))?.pos || staff.find((e) => e.dept === dept)?.pos;
                if (!pickE && d < T) continue;
                S.shifts.push({ id: uid("s"), emp: pickE ? pickE.id : null, prop: p.id, dept, pos, date: d, start: st, end: en, brk: span(st, en) > 300 ? 30 : 0, note: "" });
                if (pickE) { count[pickE.id]++; busy[pickE.id + d] = 1; if (st >= "22:00") busy[pickE.id + d + "N"] = 1; }
              }
            }
          }
        }
        S.published[p.id + "|" + ws] = ws <= addDays(weekStart(T), 7);
      }
    }

    // Punches from the schedule: past shifts are complete, today's shifts are in progress
    const nm = nowMin();
    for (const s of S.shifts) {
      if (!s.emp || s.date > T) continue;
      const e = S.emps.find((x) => x.id === s.emp);
      const st = toMin(s.start), dur = span(s.start, s.end);
      const startAbs = diffDays(T, s.date) * 1440 + st; // minutes relative to today 00:00
      if (startAbs > nm + 10) continue;
      if (s.date < T && R.chance(0.012)) continue; // no-show
      const late = R.chance(0.07) ? R.int(8, 26) : R.int(-8, 3);
      const inAbs = startAbs + late;
      if (inAbs > nm) continue;
      const pch = { id: uid("c"), emp: s.emp, date: s.date, in: toHM(inAbs), out: null, brk: 0, brkStart: null, shift: s.id, edited: false, note: "", tips: 0 };
      const outAbs = startAbs + dur + (R.chance(0.04) ? -R.int(20, 50) : R.int(-3, 14)) + (R.chance(0.05) ? R.int(30, 75) : 0);
      if (outAbs <= nm) {
        if (s.date < T && R.chance(0.025)) pch.out = null; // forgot to punch out
        else pch.out = toHM(outAbs);
        pch.brk = dur > 300 && !R.chance(0.04) ? R.pick([30, 30, 30, 32, 35, 28]) : 0;
      } else if (dur > 300 && nm - inAbs > 240 && nm - inAbs < 275) {
        pch.brkStart = toHM(inAbs + 240);
      } else if (dur > 300 && nm - inAbs >= 275) {
        pch.brk = 30;
      }
      if (POS[e.pos].tips && pch.out) pch.tips = Math.round((s.start >= "15:00" ? R.int(90, 260) : R.int(30, 110)) * 100) / 100;
      S.punches.push(pch);
    }

    // Shift swaps and pick-ups waiting for approval
    for (const p of PROPS) {
      const fut = S.shifts.filter((s) => s.prop === p.id && s.emp && s.date > T && s.date <= addDays(T, 9) && S.emps.find((e) => e.id === s.emp).pay === "hourly");
      const s1 = R.pick(fut);
      const mates = S.emps.filter((e) => e.prop === p.id && e.dept === s1.dept && e.id !== s1.emp && e.pay === "hourly" && e.status === "active");
      S.swaps.push({ id: uid("w"), type: "swap", shift: s1.id, from: s1.emp, to: R.pick(mates).id, status: "pending", note: "Doctor's appointment that morning", created: T });
      const open = S.shifts.filter((s) => s.prop === p.id && !s.emp && s.date > T);
      if (open.length) {
        const o = R.pick(open);
        const m2 = S.emps.filter((e) => e.prop === p.id && e.dept === o.dept && e.pay === "hourly" && e.status === "active");
        S.swaps.push({ id: uid("w"), type: "pickup", shift: o.id, from: null, to: R.pick(m2).id, status: "pending", note: "Happy to take this one", created: T });
      }
    }
    // Punch corrections waiting for approval
    const missed = S.punches.filter((c) => !c.out && c.date < T);
    missed.slice(0, 4).forEach((c) => {
      const s = S.shifts.find((x) => x.id === c.shift);
      S.corrections.push({ id: uid("k"), emp: c.emp, punch: c.id, date: c.date, field: "out", from: null, to: s ? s.end : "17:00", reason: "Forgot to punch out at the end of my shift", status: "pending", created: addDays(c.date, 1) });
    });

    // Previous period already paid; the current period is open
    S.payruns[addDays(curPS, -14)] = { status: "finalized", at: addDays(curPS, 2), by: hr.id };
    S.emps.forEach((e) => (S.tsApproved[e.id + "|" + addDays(curPS, -14)] = { by: gm.id, at: addDays(curPS, 1) }));

    S.announcements = [
      { id: uid("a"), date: addDays(T, -1), prop: null, title: "Holiday season scheduling opens soon", body: "Requests for December 20 to January 3 will open in the app next week. Requests are approved by seniority within each department." },
      { id: uid("a"), date: addDays(T, -3), prop: "p1", title: "New uniforms for the front desk", body: "Fittings are on Thursday from 10:00 to 14:00 in the training room on level B1." },
      { id: uid("a"), date: addDays(T, -6), prop: null, title: "Flu shot clinic", body: "Free flu shots for all staff and their families at each hotel on the first Wednesday of November." },
    ];

    // Labour budget per day from the forecast and a cost-per-occupied-room target set near this hotel's normal level
    for (const p of PROPS) {
      let cost = 0, occ = 0;
      for (const s of S.shifts) if (s.prop === p.id) { const e = S.emps.find((x) => x.id === s.emp); const r = e ? (e.pay === "salary" ? e.wage / 2080 : e.wage) : POS[s.pos].wage || 25; cost += (shiftMin(s) / 60) * r; }
      for (const d of Object.keys(S.forecast[p.id])) occ += p.rooms * S.forecast[p.id][d];
      S.settings.cpor[p.id] = Math.round((cost / occ) * 0.98 * 2) / 2;
    }
    for (const p of PROPS) {
      S.budget[p.id] = {};
      for (const d of Object.keys(S.forecast[p.id])) S.budget[p.id][d] = Math.round(p.rooms * S.forecast[p.id][d] * S.settings.cpor[p.id]);
    }
    S.audit.push({ at: new Date().toISOString(), who: "System", what: "Demo data created" });
    return S;
  }

  // ---------- Calculations ----------
  const shiftMin = (s) => span(s.start, s.end) - (s.brk || 0);
  // Worked minutes for a punch. Open punches count up to now when they are today.
  const punchMin = (c, T = today()) => {
    if (!c.in) return 0;
    let out = c.out;
    if (!out) { if (c.date !== T && c.date !== addDays(T, -1)) return 0; out = toHM(nowMin()); if (c.date !== T && toMin(out) > toMin(c.in)) return 0; }
    let m = span(c.in, out) - (c.brk || 0);
    if (c.brkStart && !c.out) m -= span(c.brkStart, toHM(nowMin()));
    return Math.max(0, m);
  };

  // Simplified 2026 Canadian payroll deductions (estimates for the demo, not CRA tables).
  function deductions(gross, emp, S) {
    const cpp = Math.max(0, (gross - 3500 / 26) * 0.0595);
    const ei = gross * 0.0164;
    const annual = gross * 26;
    const fedTax = Math.max(0, bracket(annual, [[58523, 0.14], [117045, 0.205], [181440, 0.26], [258482, 0.29], [Infinity, 0.33]]) - 16452 * 0.14 - Math.min(cpp * 26, 4230) * 0.14 - Math.min(ei * 26, 1123) * 0.14 - 1471 * 0.14);
    const onTax = Math.max(0, bracket(annual, [[53891, 0.0505], [107785, 0.0915], [150000, 0.1116], [220000, 0.1216], [Infinity, 0.1316]]) - 12989 * 0.0505 - Math.min(cpp * 26, 4230) * 0.0505);
    const tax = (fedTax + onTax) / 26;
    const ben = emp.type === "FT" && emp.status === "active" ? (emp.pay === "salary" ? 41.2 : 28.4) : 0;
    const union = emp.union ? Math.round(gross * 0.014 * 100) / 100 : 0;
    return { cpp, ei, tax, ben, union };
  }
  function bracket(x, b) { let t = 0, lo = 0; for (const [hi, r] of b) { if (x > lo) t += (Math.min(x, hi) - lo) * r; lo = hi; } return t; }

  // Pay for one employee and one bi-weekly period.
  function payFor(S, emp, ps) {
    const pe = addDays(ps, 13);
    const ps2 = addDays(ps, 7);
    const T = today();
    const P = S.punches.filter((c) => c.emp === emp.id && c.date >= ps && c.date <= pe);
    const r = { emp: emp.id, reg: 0, ot: 0, hol: 0, holPay: 0, regPay: 0, otPay: 0, holPremPay: 0, salary: 0, vacPay: 0, tips: 0, ptoHrs: 0, ptoPay: 0, days: 0 };
    if (emp.pay === "salary") {
      r.salary = emp.wage / 26; r.days = new Set(P.map((c) => c.date)).size;
    } else {
      const wk = [0, 0];
      for (const c of P) {
        const m = punchMin(c, T); if (!m) continue;
        r.days++;
        r.tips += c.tips || 0;
        if (HOLIDAYS[c.date]) { r.hol += m; continue; }
        wk[c.date < ps2 ? 0 : 1] += m;
      }
      const th = S.settings.otWeekly * 60;
      for (const m of wk) { r.reg += Math.min(m, th); r.ot += Math.max(0, m - th); }
      r.regPay = (r.reg / 60) * emp.wage;
      r.otPay = (r.ot / 60) * emp.wage * 1.5;
      r.holPremPay = (r.hol / 60) * emp.wage * 1.5;
      // Ontario public holiday pay: regular wages in the four weeks before, divided by 20
      for (const h of Object.keys(HOLIDAYS)) {
        if (h < ps || h > pe || emp.hire > h) continue;
        const w0 = addDays(weekStart(h), -28), w1 = addDays(weekStart(h), -1);
        const avail = Math.max(1, diffDays(w0 < (S.dataFrom || w0) ? S.dataFrom : w0, w1) + 1);
        const earned = S.punches.filter((c) => c.emp === emp.id && c.date >= w0 && c.date <= w1).reduce((a, c) => a + punchMin(c, T), 0) / 60 * emp.wage;
        r.holPay += Math.round((earned * (28 / avail)) / 20 * 100) / 100;
      }
    }
    // Paid time off taken in the period
    for (const t of S.timeoff) {
      if (t.emp !== emp.id || t.status !== "approved" || t.type === "per") continue;
      for (let d = t.from; d <= t.to; d = addDays(d, 1)) if (d >= ps && d <= pe) r.ptoHrs += 8;
    }
    if (emp.pay === "hourly") r.ptoPay = r.ptoHrs * emp.wage;
    const base = r.regPay + r.otPay + r.holPremPay + r.holPay + r.ptoPay;
    if (emp.pay === "hourly" && emp.type === "PT") r.vacPay = base * S.settings.vacPayPct / 100;
    r.gross = r.salary + base + r.vacPay + r.tips;
    const d = deductions(r.gross, emp, S);
    Object.assign(r, d);
    r.ded = d.cpp + d.ei + d.tax + d.ben + d.union;
    r.net = r.gross - r.ded;
    r.employer = d.cpp + d.ei * 1.4 + r.gross * (S.settings.ehtPct + S.settings.wsibPct) / 100;
    return r;
  }

  return { pad, iso, parse, addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, hrs, DOW, MON,
    HOLIDAYS, periodStart, payDate, PROPS, DEPTS, POS, seed, shiftMin, punchMin, payFor, uid };
})();
