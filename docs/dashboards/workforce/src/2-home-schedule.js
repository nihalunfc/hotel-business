// Home dashboards and the scheduler.
"use strict";
(() => {
const A = window.WFAPP;
const { ui, save, refresh, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, h1, m0, pct, role, me, isMgr, scope, inScope, rate, shiftCost, onLeave, isPublished, activeEmps, typeName, roleName, greeting, shiftsOn, openPunch, exceptionsFor, weekMinutes, pending } = A;
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const S = () => A.S;

// ---------- Live status of today's shifts ----------
function liveBoard(pid) {
  const T = today(), Y = addDays(T, -1), n = nowMin(), g = S().settings.graceMin;
  const rows = [];
  const sh = S().shifts.filter((s) => s.emp && (pid === "all" || s.prop === pid) && (s.date === T || (s.date === Y && toMin(s.end) <= toMin(s.start) && n < toMin(s.end))));
  for (const s of sh) {
    const c = S().punches.find((x) => x.shift === s.id) || S().punches.find((x) => x.emp === s.emp && x.date === s.date);
    const startAbs = (s.date === Y ? -1440 : 0) + toMin(s.start);
    const endAbs = startAbs + span(s.start, s.end);
    let st, cls, ord;
    if (onLeave(s.emp, s.date)) { st = "On leave"; cls = ""; ord = 6; }
    else if (c && !c.out && c.brkStart) { st = "On break"; cls = "warn"; ord = 1; }
    else if (c && !c.out) { const late = span(s.start, c.in); st = late > g && late < 600 ? `In · ${late} min late` : "In"; cls = "good"; ord = 0; }
    else if (c && c.out) { st = "Done"; cls = ""; ord = 5; }
    else if (n > startAbs + g && n < endAbs) { st = "Not in yet"; cls = "bad"; ord = 2; }
    else if (n >= endAbs) { st = "No-show"; cls = "bad"; ord = 2; }
    else { st = "Starts " + fmtT(s.start); cls = "info"; ord = 3; }
    rows.push({ s, c, st, cls, ord });
  }
  // Clocked in without a shift
  S().punches.filter((c) => !c.out && c.date === T && !c.shift && (pid === "all" || E(c.emp).prop === pid)).forEach((c) => rows.push({ s: { emp: c.emp, dept: E(c.emp).dept, start: c.in, end: c.in, pos: E(c.emp).pos }, c, st: "In · unscheduled", cls: "warn", ord: 0 }));
  rows.sort((a, b) => a.ord - b.ord || a.s.start.localeCompare(b.s.start));
  return rows;
}

function dayCost(pid, d) { return S().shifts.filter((s) => s.prop === pid && s.date === d).reduce((a, s) => a + shiftCost(s), 0); }
function budgetFor(pid, d) { return pid === "all" ? S().props.reduce((a, p) => a + (S().budget[p.id][d] || 0), 0) : S().budget[pid]?.[d] || 0; }
function costFor(pid, d) { return pid === "all" ? S().props.reduce((a, p) => a + dayCost(p.id, d), 0) : dayCost(pid, d); }

// ---------- Home ----------
VIEWS.home = (v) => (role() === "employee" ? homeEmployee(v) : homeManager(v));

function homeManager(v) {
  const T = today(), pid = scope(), p = pending();
  const board = liveBoard(pid);
  const inNow = board.filter((r) => r.ord <= 1).length;
  const notIn = board.filter((r) => r.ord === 2 && r.st === "Not in yet").length;
  const cost = costFor(pid, T), bud = budgetFor(pid, T);
  const ws = weekStart(T);
  const openNext = S().shifts.filter((s) => !s.emp && inScope(s.prop) && s.date >= T && s.date <= addDays(T, 7)).length;
  const scopeEmps = activeEmps().filter((e) => inScope(e.prop) && e.pay === "hourly" && e.status === "active");
  const otRisk = scopeEmps.map((e) => ({ e, m: weekMinutes(e.id, ws) })).filter((x) => x.m > S().settings.otWeekly * 60 - 60).sort((a, b) => b.m - a.m);
  const ps = periodStart(T);
  const exc = [];
  for (let d = ps; d < T; d = addDays(d, 1)) for (const e of scopeEmps) for (const x of exceptionsFor(e.id, d)) exc.push({ e, d, x });
  exc.sort((a, b) => b.d.localeCompare(a.d));
  const soon = (md) => { for (let i = 0; i < 8; i++) if (addDays(T, i).slice(5) === md) return i; return -1; };
  const events = [];
  activeEmps().filter((e) => inScope(e.prop) && e.status === "active").forEach((e) => {
    const b = soon(e.birthday); if (b >= 0) events.push({ e, i: b, t: "🎂 Birthday" });
    const a = soon(e.hire.slice(5)); const yrs = Number(T.slice(0, 4)) - Number(e.hire.slice(0, 4)); if (a >= 0 && yrs > 0) events.push({ e, i: a, t: `🎉 ${yrs} year${yrs > 1 ? "s" : ""} with us` });
  });
  events.sort((a, b) => a.i - b.i);
  const certs = [];
  activeEmps().filter((e) => inScope(e.prop)).forEach((e) => e.certs.forEach((c) => { const dd = diffDays(T, c.exp); if (dd < 45) certs.push({ e, c, dd }); }));
  certs.sort((a, b) => a.dd - b.dd);
  const items = [...p.to.map((t) => ({ k: "to", o: t, d: t.created })), ...p.sw.map((w) => ({ k: "sw", o: w, d: w.created })), ...p.co.map((c) => ({ k: "co", o: c, d: c.created }))].sort((a, b) => b.d.localeCompare(a.d));

  v.innerHTML = `
  <div class="card hello banner" style="margin-bottom:16px">
    <div><h1>${greeting()}, ${esc(me().first)}</h1><p>${fmtDY(T)} · ${esc(pid === "all" ? "All " + S().props.length + " hotels" : prop(pid).name)}${HOLIDAYS[T] ? " · " + HOLIDAYS[T] : ""}</p></div>
    <div class="toolbar"><a class="btn" href="#/schedule">Open schedule</a><a class="btn" href="#/timesheets">Timesheets</a></div>
  </div>
  <div class="grid g4 keep2">
    <div class="kpi ok"><div class="l">On the clock now</div><div class="v">${inNow}</div><div class="s">${notIn ? `<span style="color:var(--bad);font-weight:600">${notIn} not in yet</span>` : "Everyone due is in"}</div></div>
    <div class="kpi ${cost > bud ? "alert" : ""}"><div class="l">Labour cost today</div><div class="v">${m0(cost)}</div><div class="s">Budget ${m0(bud)} · ${cost > bud ? m0(cost - bud) + " over" : m0(bud - cost) + " under"}</div><div class="bar"><i class="${cost > bud ? "over" : "good"}" style="width:${Math.min(100, (cost / Math.max(bud, 1)) * 100)}%"></i></div></div>
    <a class="kpi" href="#/approvals" style="color:inherit;text-decoration:none"><div class="l">Waiting for approval</div><div class="v">${p.n}</div><div class="s">${p.to.length} time off · ${p.sw.length} shift changes · ${p.co.length} punch fixes</div></a>
    <div class="kpi ${otRisk.length ? "alert" : ""}"><div class="l">Overtime risk this week</div><div class="v">${otRisk.length}</div><div class="s">${openNext} open shift${openNext === 1 ? "" : "s"} in the next 7 days</div></div>
  </div>

  <div class="grid g-main mt">
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Who's working today</h2><span class="muted" style="font-size:13px">Live · <span data-clock>${new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}</span></span></div>
        <div class="tw"><table><thead><tr><th>Employee</th><th class="hide-sm">Department</th><th>Shift</th><th>Status</th></tr></thead><tbody>
        ${board.length ? board.slice(0, 14).map((r) => { const e = E(r.s.emp); return `<tr class="click" data-act="open-person" data-id="${e.id}"><td><div style="display:flex;gap:8px;align-items:center">${av(e, "sm")}<span><b style="font-size:13.5px">${esc(nm(e))}</b><br><small>${esc(posName(e.pos))}</small></span></div></td><td class="hide-sm"><span class="dot" style="background:${dept(e.dept).color}"></span>${esc(dept(e.dept).name)}</td><td class="nowrap">${fmtT(r.s.start)}–${fmtT(r.s.end)}</td><td><span class="pill ${r.cls}">${esc(r.st)}</span></td></tr>`; }).join("") : `<tr><td colspan="4" class="empty">No shifts today.</td></tr>`}
        </tbody></table></div>
        ${board.length > 14 ? `<p class="muted" style="margin:10px 0 0;font-size:13px">Showing 14 of ${board.length}. <a href="#/clock">See everyone on the time clock board</a>.</p>` : ""}
      </div>
      <div class="card">
        <div class="card-h"><h2>Labour cost vs budget, this week</h2><span class="muted" style="font-size:13px">Scheduled wages against the forecast-based budget</span></div>
        <div class="chart"><canvas id="ch-week"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Attendance exceptions this pay period</h2><a href="#/timesheets" class="btn sm">Review timesheets</a></div>
        ${exc.length ? `<div class="list">${exc.slice(0, 8).map(({ e, d, x }) => `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${fmtD(d)} · ${esc(posName(e.pos))}</small></div><span class="pill ${x.cls}">${esc(x.t)}</span></div>`).join("")}</div>${exc.length > 8 ? `<p class="muted" style="font-size:13px;margin:8px 0 0">${exc.length - 8} more on the timesheets page.</p>` : ""}` : `<div class="empty">No exceptions. Nice.</div>`}
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2>Approvals</h2><a href="#/approvals" class="btn sm">See all</a></div>
        ${items.length ? `<div class="list">${items.slice(0, 5).map(approvalLine).join("")}</div>` : `<div class="empty">You're all caught up.</div>`}
      </div>
      <div class="card">
        <div class="card-h"><h2>Overtime watch</h2><span class="muted" style="font-size:13px">Over ${S().settings.otWeekly - 1} h this week</span></div>
        ${otRisk.length ? `<div class="list">${otRisk.slice(0, 6).map(({ e, m }) => `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${esc(posName(e.pos))}</small></div><span class="pill ${m > S().settings.otWeekly * 60 ? "bad" : "warn"}">${h1(m)}</span></div>`).join("")}</div>` : `<div class="empty">Nobody is close to overtime.</div>`}
      </div>
      <div class="card">
        <h2>This week</h2>
        ${events.length ? `<div class="list">${events.slice(0, 6).map(({ e, i, t }) => `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${t} · ${i === 0 ? "today" : fmtD(addDays(T, i))}</small></div></div>`).join("")}</div>` : `<div class="empty">No birthdays or anniversaries this week.</div>`}
      </div>
      <div class="card">
        <div class="card-h"><h2>Certifications due</h2><span class="muted" style="font-size:13px">Next 45 days</span></div>
        ${certs.length ? `<div class="list">${certs.slice(0, 6).map(({ e, c, dd }) => `<div class="li"><div class="grow"><b>${esc(nm(e))}</b><small>${esc(c.name)}</small></div><span class="pill ${dd < 0 ? "bad" : "warn"}">${dd < 0 ? "Expired " + fmtDs(c.exp) : "Due " + fmtDs(c.exp)}</span></div>`).join("")}</div>` : `<div class="empty">Nothing due.</div>`}
      </div>
      ${annCard(pid)}
    </div>
  </div>`;
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  chart($("#ch-week"), { type: "bar", data: { labels: days.map((d) => DOW[dow(d)] + " " + d.slice(8)), datasets: [
    { label: "Scheduled cost", data: days.map((d) => Math.round(costFor(pid, d))), backgroundColor: days.map((d) => (d === T ? "#1f4e79" : "#2a78d6")), borderRadius: 5, order: 2 },
    { label: "Budget", type: "line", data: days.map((d) => budgetFor(pid, d)), borderColor: "#eb6834", backgroundColor: "#eb6834", pointRadius: 3, tension: 0.25, order: 1 }] },
    options: { scales: { y: { ticks: { callback: (x) => "$" + (x / 1000).toFixed(1) + "k" }, grid: { color: "#eef1f4" } }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m0(c.raw)}` } } } } });
}

function annCard(pid) {
  const list = S().announcements.filter((a) => !a.prop || pid === "all" || a.prop === pid).slice(0, 3);
  return `<div class="card"><div class="card-h"><h2>Announcements</h2>${isMgr() ? `<button class="btn sm" data-act="new-ann">Post</button>` : ""}</div>
    ${list.map((a) => `<div class="li" style="align-items:flex-start"><div class="grow"><b>${esc(a.title)}</b><small style="white-space:normal">${esc(a.body)}</small><small>${fmtD(a.date)} · ${a.prop ? esc(prop(a.prop).short) : "All hotels"}</small></div></div>`).join("") || `<div class="empty">No announcements.</div>`}</div>`;
}
ACT["new-ann"] = () => modal({
  title: "Post an announcement",
  body: `<div class="fields"><div class="field full"><label>Title</label><input id="an-t" type="text" maxlength="80"></div><div class="field full"><label>Message</label><textarea id="an-b" maxlength="400"></textarea></div>
    <div class="field full"><label>Who sees it</label><select id="an-p"><option value="">All hotels</option>${S().props.filter((p) => inScope(p.id)).map((p) => `<option value="${p.id}" ${scope() === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div></div>`,
  foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="an-ok">Post</button>`,
  onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#an-ok", m).onclick = () => {
    const t = $("#an-t", m).value.trim(); if (!t) return toast("Add a title");
    S().announcements.unshift({ id: uid("a"), date: today(), prop: $("#an-p", m).value || null, title: t, body: $("#an-b", m).value.trim() });
    log(`Posted announcement "${t}"`); closeModal(); refresh(); toast("Announcement posted"); }; },
});

function approvalLine({ k, o }) {
  if (k === "to") { const e = E(o.emp); return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${typeName[o.type]} · ${fmtDs(o.from)}${o.to !== o.from ? "–" + fmtDs(o.to) : ""} · ${o.hours} h</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="to" data-id="${o.id}" aria-label="Approve">✓</button><button class="btn sm danger" data-act="deny" data-k="to" data-id="${o.id}" aria-label="Deny">✕</button></div></div>`; }
  if (k === "sw") { const s = S().shifts.find((x) => x.id === o.shift); const e = E(o.type === "pickup" ? o.to : o.from); return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${o.type === "swap" ? "Swap to " + esc(nmId(o.to)) : o.type === "pickup" ? "Pick up open shift" : "Give away shift"} · ${s ? fmtDs(s.date) + " " + fmtT(s.start) : ""}</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="sw" data-id="${o.id}" aria-label="Approve">✓</button><button class="btn sm danger" data-act="deny" data-k="sw" data-id="${o.id}" aria-label="Deny">✕</button></div></div>`; }
  const e = E(o.emp);
  return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>Punch fix · ${fmtDs(o.date)} · ${o.field === "out" ? "Out" : "In"} ${fmtT(o.to)}</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="co" data-id="${o.id}" aria-label="Approve">✓</button><button class="btn sm danger" data-act="deny" data-k="co" data-id="${o.id}" aria-label="Deny">✕</button></div></div>`;
}
A.approvalLine = approvalLine;

function homeEmployee(v) {
  const T = today(), e = me(), ps = periodStart(T);
  const next = S().shifts.filter((s) => s.emp === e.id && (s.date > T || (s.date === T && (toMin(s.end) > nowMin() || toMin(s.end) <= toMin(s.start)))) && isPublished(s.prop, weekStart(s.date))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const c = openPunch(e.id);
  const pay = payFor(S(), e, ps);
  const workedM = pay.reg + pay.ot + pay.hol;
  const myWeek = [...Array(7)].map((_, i) => addDays(weekStart(T), i));
  const opens = S().shifts.filter((s) => !s.emp && s.prop === e.prop && s.dept === e.dept && s.date >= T && isPublished(s.prop, weekStart(s.date)) && !S().swaps.some((w) => w.shift === s.id && w.status === "pending" && w.to === e.id)).slice(0, 4);
  const reqs = [...S().timeoff.filter((t) => t.emp === e.id).map((t) => ({ d: t.created, t: `${typeName[t.type]} ${fmtDs(t.from)}${t.to !== t.from ? "–" + fmtDs(t.to) : ""}`, st: t.status })),
    ...S().swaps.filter((w) => w.from === e.id || w.to === e.id).map((w) => { const s = S().shifts.find((x) => x.id === w.shift); return { d: w.created, t: `${w.type === "pickup" ? "Pick up" : w.type === "swap" ? "Swap" : "Give away"} ${s ? fmtDs(s.date) : ""}`, st: w.status }; }),
    ...S().corrections.filter((k) => k.emp === e.id).map((k) => ({ d: k.created, t: `Punch fix ${fmtDs(k.date)}`, st: k.status }))].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5);
  const n0 = next[0];
  v.innerHTML = `
  <div class="card hello banner" style="margin-bottom:16px">
    <div><h1>${greeting()}, ${esc(e.first)}</h1><p>${esc(posName(e.pos))} · ${esc(prop(e.prop).name)}</p></div>
    <div class="toolbar">${c ? `<span class="status-chip ${c.brkStart ? "brk" : "in"}">${c.brkStart ? "On break" : "Clocked in at " + fmtT(c.in)}</span>` : ""}<a class="btn" href="#/clock">${c ? "Clock out or break" : "Clock in"}</a></div>
  </div>
  <div class="grid g4 keep2">
    <div class="kpi"><div class="l">Next shift</div><div class="v" style="font-size:20px">${n0 ? (n0.date === T ? "Today" : fmtD(n0.date)) : "None"}</div><div class="s">${n0 ? `${fmtT(n0.start)}–${fmtT(n0.end)} · ${esc(dept(n0.dept).name)}` : "Nothing scheduled"}</div></div>
    <div class="kpi"><div class="l">Hours this pay period</div><div class="v">${h1(workedM)}</div><div class="s">${fmtDs(ps)}–${fmtDs(addDays(ps, 13))}${pay.ot ? ` · ${h1(pay.ot)} overtime` : ""}</div></div>
    <div class="kpi"><div class="l">Vacation balance</div><div class="v">${e.bal.vac} h</div><div class="s">Sick ${e.bal.sick} h · Personal ${e.bal.per} h</div></div>
    <a class="kpi" href="#/pay" style="color:inherit;text-decoration:none"><div class="l">Next pay · ${fmtDs(payDate(ps))}</div><div class="v">${money(pay.net, 0)}</div><div class="s">Estimated take-home so far</div></a>
  </div>
  <div class="grid g-main mt">
    <div class="stack">
      <div class="card"><div class="card-h"><h2>My week</h2><a class="btn sm" href="#/schedule">Full schedule</a></div>
        <div class="list">${myWeek.map((d) => { const sh = shiftsOn(e.id, d).filter((s) => isPublished(s.prop, weekStart(s.date))); const lv = onLeave(e.id, d);
          return `<div class="li"><div style="width:62px;flex:none"><b style="font-size:13.5px;${d === T ? "color:var(--brand-2)" : ""}">${DOW[dow(d)]}</b><br><small>${fmtDs(d)}</small></div><div class="grow">${lv ? `<span class="pill violet">${typeName[lv.type]}</span>` : sh.length ? sh.map((s) => `<b>${fmtT(s.start)} – ${fmtT(s.end)}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}${s.note ? " · " + esc(s.note) : ""}</small>`).join("") : `<small>Day off</small>`}</div>${HOLIDAYS[d] ? `<span class="pill good">${HOLIDAYS[d]}</span>` : ""}</div>`; }).join("")}</div></div>
      <div class="card"><div class="card-h"><h2>Open shifts you can pick up</h2></div>
        ${opens.length ? `<div class="list">${opens.map((s) => `<div class="li"><div class="grow"><b>${fmtD(s.date)} · ${fmtT(s.start)}–${fmtT(s.end)}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}</small></div><button class="btn sm primary" data-act="pickup" data-id="${s.id}">Request</button></div>`).join("")}</div>` : `<div class="empty">No open shifts in your department right now.</div>`}</div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-h"><h2>My requests</h2><a class="btn sm" href="#/timeoff">Request time off</a></div>
        ${reqs.length ? `<div class="list">${reqs.map((r) => `<div class="li"><div class="grow"><b>${esc(r.t)}</b><small>Sent ${fmtDs(r.d)}</small></div><span class="pill ${r.st === "approved" ? "good" : r.st === "denied" ? "bad" : r.st === "cancelled" ? "" : "warn"}">${r.st}</span></div>`).join("")}</div>` : `<div class="empty">No requests yet.</div>`}</div>
      ${annCard(e.prop)}
    </div>
  </div>`;
}
ACT.pickup = (b) => {
  const s = S().shifts.find((x) => x.id === b.dataset.id);
  S().swaps.push({ id: uid("w"), type: "pickup", shift: s.id, from: null, to: S().me.emp, status: "pending", note: "", created: today() });
  log(`Asked to pick up the open shift on ${fmtD(s.date)} ${fmtT(s.start)}`); refresh(); toast("Request sent to your manager");
};

// ---------- Schedule ----------
VIEWS.schedule = (v) => (role() === "employee" ? scheduleEmployee(v) : scheduleManager(v));

function schedProp() { return scope() === "all" ? null : scope(); }

function scheduleManager(v) {
  const pid = schedProp();
  if (!pid) {
    v.innerHTML = `<div class="ph"><div><h1>Schedule</h1><p>Schedules are built per hotel. Pick one to open it.</p></div></div><div class="grid g3">${S().props.map((p) => `<button class="card" style="text-align:left;cursor:pointer" data-act="pick-prop" data-id="${p.id}"><h2>${esc(p.name)}</h2><p class="muted">${p.rooms} rooms · ${activeEmps().filter((e) => e.prop === p.id).length} staff</p></button>`).join("")}</div>`;
    return;
  }
  const ws = ui.week, T = today();
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const pub = isPublished(pid, ws);
  const mode = ui.schedMode || (innerWidth <= 640 ? "list" : "grid");
  const depts = S().depts.filter((d) => ui.dept === "all" || d.id === ui.dept);
  const wkShifts = S().shifts.filter((s) => s.prop === pid && s.date >= ws && s.date <= days[6] && (ui.dept === "all" || s.dept === ui.dept));
  const open = wkShifts.filter((s) => !s.emp);
  const tot = wkShifts.reduce((a, s) => a + shiftMin(s), 0);
  const cost = wkShifts.reduce((a, s) => a + shiftCost(s), 0);
  const bud = ui.dept === "all" ? days.reduce((a, d) => a + (S().budget[pid][d] || 0), 0) : null;
  const past = days[6] < T;
  const conflicts = wkShifts.filter((s) => s.emp && shiftWarnings(s).length).length;

  v.innerHTML = `
  <div class="ph"><div><h1>Schedule · ${esc(prop(pid).short)}</h1><p>Week of ${fmtDY(ws)} · ${pub ? `<span class="pill good">Published</span>` : `<span class="pill warn">Draft, not visible to staff</span>`}</p></div>
    <div class="toolbar">
      <div class="seg"><button data-act="wk" data-n="-7" aria-label="Previous week">‹</button><button data-act="wk" data-n="0">This week</button><button data-act="wk" data-n="7" aria-label="Next week">›</button></div>
      <select id="sc-dept" aria-label="Department"><option value="all">All departments</option>${S().depts.map((d) => `<option value="${d.id}" ${ui.dept === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
      <div class="seg"><button data-act="mode" data-m="grid" class="${mode === "grid" ? "on" : ""}">Grid</button><button data-act="mode" data-m="list" class="${mode === "list" ? "on" : ""}">By day</button></div>
    </div></div>
  <div class="grid g4 keep2" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Scheduled hours</div><div class="v">${h1(tot)}</div><div class="s">${wkShifts.filter((s) => s.emp).length} shifts · ${new Set(wkShifts.map((s) => s.emp).filter(Boolean)).size} people</div></div>
    <div class="kpi ${bud && cost > bud ? "alert" : ""}"><div class="l">Labour cost</div><div class="v">${m0(cost)}</div><div class="s">${bud ? `Budget ${m0(bud)} · ${cost > bud ? m0(cost - bud) + " over" : m0(bud - cost) + " under"}` : "Budget is set for the whole hotel"}</div></div>
    <div class="kpi ${open.length ? "alert" : ""}"><div class="l">Open shifts</div><div class="v">${open.length}</div><div class="s">${open.length ? "Need someone" : "Fully covered"}</div></div>
    <div class="kpi ${conflicts ? "alert" : "ok"}"><div class="l">Rule warnings</div><div class="v">${conflicts}</div><div class="s">Overtime, rest, leave or availability</div></div>
  </div>
  <div class="toolbar no-print" style="margin-bottom:12px">
    ${past ? `<span class="muted">This week is in the past and is read only.</span>` : `
    <button class="btn primary" data-act="add-shift">+ Add shift</button>
    <button class="btn" data-act="autofill" ${open.length ? "" : "disabled"}>Auto-fill open shifts</button>
    <button class="btn" data-act="copy-week">Copy last week</button>
    ${pub ? "" : `<button class="btn good" data-act="publish">Publish week</button>`}`}
    <button class="btn" data-act="sched-csv">Export CSV</button>
    <button class="btn" onclick="window.print()">Print</button>
  </div>
  <div id="sched-body"></div>
  <div class="legend">${S().depts.map((d) => `<span><i style="background:${d.color}"></i>${esc(d.name)}</span>`).join("")}<span><i style="background:#fff5ef;border:1px dashed #eb6834"></i>Open shift</span><span><i style="background:#fff8de;border-left:3px solid #8a6d00"></i>Time off</span><span><i style="background:repeating-linear-gradient(135deg,#fff,#fff 3px,#dcebfb 3px,#dcebfb 6px)"></i>Draft</span></div>`;
  $("#sc-dept").onchange = (e) => { ui.dept = e.target.value; A.render(); };
  const body = $("#sched-body");
  if (mode === "grid") body.innerHTML = gridHTML(pid, days, depts, pub);
  else body.innerHTML = listHTML(pid, days, depts, pub);
}

function shiftChip(s, pub) {
  const w = shiftWarnings(s);
  return `<span class="shift ${s.emp ? "" : "open"} ${pub ? "" : "draft"}" style="--c:${dept(s.dept).color}" data-act="edit-shift" data-id="${s.id}" title="${esc(w.join(". "))}">${fmtT(s.start)}–${fmtT(s.end)}${w.length ? " ⚠️" : ""}<small>${s.emp ? esc(posName(s.pos)) : "Open · " + esc(posName(s.pos))}</small></span>`;
}

function gridHTML(pid, days, depts, pub) {
  const T = today(), ws = days[0];
  let rows = "";
  for (const d of depts) {
    const staff = activeEmps().filter((e) => e.prop === pid && e.dept === d.id && e.hire <= days[6]).sort((a, b) => (a.pay === "salary" ? -1 : 0) - (b.pay === "salary" ? -1 : 0) || a.pos.localeCompare(b.pos) || a.last.localeCompare(b.last));
    const open = S().shifts.filter((s) => !s.emp && s.prop === pid && s.dept === d.id && s.date >= ws && s.date <= days[6]);
    rows += `<tr class="dept-row"><td class="emp" colspan="9"><span class="dot" style="background:${d.color}"></span>${esc(d.name)}</td></tr>`;
    if (open.length) rows += `<tr><td class="emp"><b style="color:#c2410c">Open shifts</b><small>${open.length} to fill</small></td>${days.map((day) => `<td class="cell ${day === T ? "today" : ""}">${open.filter((s) => s.date === day).map((s) => shiftChip(s, pub)).join("")}</td>`).join("")}<td></td></tr>`;
    for (const e of staff) {
      const wm = days.reduce((a, day) => a + shiftsOn(e.id, day).reduce((b, s) => b + shiftMin(s), 0), 0);
      rows += `<tr><td class="emp"><b>${esc(nm(e))}</b><small>${esc(posName(e.pos))} · ${e.type}${e.status === "onboarding" ? " · new" : ""}</small></td>${days.map((day) => {
        const lv = onLeave(e.id, day);
        const sh = shiftsOn(e.id, day);
        const unav = e.avail[dow(day)] === "off";
        return `<td class="cell ${day === T ? "today" : ""} ${unav && !sh.length ? "off" : ""}" data-act="cell" data-emp="${e.id}" data-d="${day}">${lv ? `<span class="shift lv"><small style="font-weight:700;color:#6b4e00">${typeName[lv.type]}${lv.status === "pending" ? " (asked)" : ""}</small></span>` : ""}${sh.map((s) => shiftChip(s, pub)).join("")}</td>`;
      }).join("")}<td class="n ${wm > S().settings.otWeekly * 60 ? "over" : ""}" style="font-weight:600">${(wm / 60).toFixed(1)}</td></tr>`;
    }
  }
  const all = ui.dept === "all";
  const foot = `<tfoot>
    <tr><td class="emp">Hours</td>${days.map((d) => `<td>${(S().shifts.filter((s) => s.prop === pid && s.date === d && (all || s.dept === ui.dept)).reduce((a, s) => a + shiftMin(s), 0) / 60).toFixed(1)}</td>`).join("")}<td></td></tr>
    <tr><td class="emp">Cost</td>${days.map((d) => `<td>${m0(S().shifts.filter((s) => s.prop === pid && s.date === d && (all || s.dept === ui.dept)).reduce((a, s) => a + shiftCost(s), 0))}</td>`).join("")}<td></td></tr>
    ${all ? `<tr><td class="emp">Budget</td>${days.map((d) => { const c = dayCost(pid, d), b = S().budget[pid][d] || 0; return `<td>${m0(b)}<br><span class="${c > b ? "over" : "under"}">${c > b ? "+" : "−"}${m0(Math.abs(c - b))}</span></td>`; }).join("")}<td></td></tr>` : ""}
    <tr><td class="emp">Forecast occupancy</td>${days.map((d) => `<td>${S().forecast[pid][d] != null ? pct(S().forecast[pid][d]) : "–"}</td>`).join("")}<td></td></tr></tfoot>`;
  return `<div class="sched-wrap"><table class="sched"><thead><tr><th class="emp">Employee</th>${days.map((d) => `<th class="${d === T ? "today" : ""}">${DOW[dow(d)]} ${d.slice(8)}${HOLIDAYS[d] ? `<br><small style="color:var(--good)">${HOLIDAYS[d]}</small>` : ""}</th>`).join("")}<th>Hrs</th></tr></thead><tbody>${rows}</tbody>${foot}</table></div>`;
}

function listHTML(pid, days, depts, pub) {
  const T = today();
  return `<div class="day-list">${days.map((d) => {
    const sh = S().shifts.filter((s) => s.prop === pid && s.date === d && depts.some((x) => x.id === s.dept)).sort((a, b) => a.start.localeCompare(b.start) || a.dept.localeCompare(b.dept));
    return `<div class="day ${d === T ? "today" : ""}"><h3><span>${fmtD(d)}${HOLIDAYS[d] ? " · " + HOLIDAYS[d] : ""}</span><span class="muted" style="font-weight:500">${sh.length} shifts · ${m0(sh.reduce((a, s) => a + shiftCost(s), 0))}</span></h3>
      ${sh.map((s) => { const e = E(s.emp); const w = shiftWarnings(s); return `<div class="mshift ${s.emp ? "" : "open"}" style="--c:${s.emp ? dept(s.dept).color : "#eb6834"}" data-act="edit-shift" data-id="${s.id}"><span class="tm">${fmtT(s.start)}–${fmtT(s.end)}</span><div class="grow"><b>${s.emp ? esc(nm(e)) : `<span style="color:#c2410c">Open shift</span>`}${w.length ? " ⚠️" : ""}</b><small>${esc(posName(s.pos))} · ${esc(dept(s.dept).name)}${pub ? "" : " · draft"}</small></div></div>`; }).join("") || `<div class="muted" style="font-size:13px">No shifts.</div>`}</div>`;
  }).join("")}</div>`;
}

function shiftWarnings(s, ignoreId) {
  const w = [];
  if (!s.emp) return w;
  const e = E(s.emp);
  if (!e) return w;
  const lv = onLeave(e.id, s.date); if (lv) w.push(`${e.first} is on ${typeName[lv.type].toLowerCase()} leave`);
  if (e.avail[dow(s.date)] === "off") w.push(`${e.first} is not available on ${DOW[dow(s.date)]}s`);
  const same = S().shifts.filter((x) => x.emp === e.id && x.date === s.date && x.id !== s.id && x.id !== ignoreId);
  const a0 = toMin(s.start), a1 = a0 + span(s.start, s.end);
  if (same.some((x) => { const b0 = toMin(x.start), b1 = b0 + span(x.start, x.end); return a0 < b1 && b0 < a1; })) w.push("Overlaps another shift");
  const prev = S().shifts.filter((x) => x.emp === e.id && x.date === addDays(s.date, -1) && x.id !== s.id);
  for (const x of prev) { const endAbs = toMin(x.start) + span(x.start, x.end) - 1440; if (a0 - endAbs < 600 && a0 - endAbs >= 0) w.push(`Only ${Math.round((a0 - endAbs) / 60)} h rest after the previous shift`); }
  if (e.pay === "hourly") {
    const ws = weekStart(s.date);
    let m = 0; for (let i = 0; i < 7; i++) m += shiftsOn(e.id, addDays(ws, i)).filter((x) => x.id !== s.id && x.id !== ignoreId).reduce((a, x) => a + shiftMin(x), 0);
    m += shiftMin(s);
    if (m > S().settings.otWeekly * 60) w.push(`Puts ${e.first} at ${h1(m)} this week (overtime)`);
  }
  return w;
}
A.shiftWarnings = shiftWarnings;

ACT["pick-prop"] = (b) => { S().me.prop = b.dataset.id; save(); A.render(); };
ACT.wk = (b) => { const n = Number(b.dataset.n); ui.week = n ? addDays(ui.week, n) : weekStart(today()); A.render(); };
ACT.mode = (b) => { ui.schedMode = b.dataset.m; A.render(); };
ACT.cell = (b, ev) => { if (ev.target.closest(".shift")) return; if (b.dataset.d < today()) return; shiftEditor(null, { emp: b.dataset.emp, date: b.dataset.d }); };
ACT["add-shift"] = () => shiftEditor(null, { date: ui.week < today() ? today() : ui.week });
ACT["edit-shift"] = (b) => { const s = S().shifts.find((x) => x.id === b.dataset.id); if (role() === "employee") return myShiftActions(s); shiftEditor(s); };

function shiftEditor(s, pre = {}) {
  const pid = schedProp();
  const isNew = !s;
  const T = today();
  const base = s || { emp: pre.emp || null, prop: pid, dept: pre.emp ? E(pre.emp).dept : ui.dept !== "all" ? ui.dept : "fo", pos: pre.emp ? E(pre.emp).pos : null, date: pre.date || T, start: "09:00", end: "17:00", brk: 30, note: "" };
  if (!base.pos) base.pos = Object.keys(POS).find((k) => POS[k].dept === base.dept && POS[k].wage && !/s$|sup/.test(k)) || Object.keys(POS).find((k) => POS[k].dept === base.dept);
  const readOnly = s && s.date < T;
  const staff = activeEmps().filter((e) => e.prop === base.prop).sort((a, b) => a.dept.localeCompare(b.dept) || a.last.localeCompare(b.last));
  modal({
    title: isNew ? "Add a shift" : readOnly ? "Shift (past, read only)" : "Edit shift",
    body: `<div class="fields">
      <div class="field"><label>Department</label><select id="f-dept" ${readOnly ? "disabled" : ""}>${S().depts.map((d) => `<option value="${d.id}" ${d.id === base.dept ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Position</label><select id="f-pos" ${readOnly ? "disabled" : ""}></select></div>
      <div class="field full"><label>Employee</label><select id="f-emp" ${readOnly ? "disabled" : ""}></select><small id="f-sug"></small></div>
      <div class="field"><label>Date</label><input type="date" id="f-date" value="${base.date}" min="${T}" ${readOnly ? "disabled" : ""}></div>
      <div class="field"><label>Unpaid break (min)</label><input type="number" id="f-brk" min="0" max="120" step="5" value="${base.brk}" ${readOnly ? "disabled" : ""}></div>
      <div class="field"><label>Start</label><input type="time" id="f-st" value="${base.start}" ${readOnly ? "disabled" : ""}></div>
      <div class="field"><label>End</label><input type="time" id="f-en" value="${base.end}" ${readOnly ? "disabled" : ""}></div>
      <div class="field full"><label>Note for the employee</label><input type="text" id="f-note" maxlength="120" value="${esc(base.note)}" placeholder="e.g. VIP arrival, cover the lobby bar" ${readOnly ? "disabled" : ""}></div>
    </div>
    <div id="f-warn"></div>
    <p class="muted" id="f-sum" style="margin:10px 0 0;font-size:13px"></p>`,
    foot: readOnly ? `<button class="btn" data-x2>Close</button>` : `${isNew ? "" : `<button class="btn danger left" id="f-del">Delete</button>`}<button class="btn" data-x2>Cancel</button><button class="btn primary" id="f-ok">${isNew ? "Add shift" : "Save"}</button>`,
    onMount: (m) => {
      const fd = $("#f-dept", m), fp = $("#f-pos", m), fe = $("#f-emp", m);
      const fillPos = () => { fp.innerHTML = Object.entries(POS).filter(([, p]) => p.dept === fd.value).map(([k, p]) => `<option value="${k}" ${k === base.pos ? "selected" : ""}>${esc(p.name)}</option>`).join(""); };
      const fillEmp = () => {
        const cur = fe.value || base.emp || "";
        const list = staff.filter((e) => e.dept === fd.value);
        const others = staff.filter((e) => e.dept !== fd.value);
        fe.innerHTML = `<option value="">Open shift (anyone can pick it up)</option><optgroup label="${esc(dept(fd.value).name)}">${list.map((e) => `<option value="${e.id}">${esc(nm(e))} · ${esc(posName(e.pos))}</option>`).join("")}</optgroup><optgroup label="Other departments (cross-trained)">${others.map((e) => `<option value="${e.id}">${esc(nm(e))} · ${esc(posName(e.pos))}</option>`).join("")}</optgroup>`;
        fe.value = cur;
      };
      const draft = () => ({ id: s ? s.id : "_new", emp: fe.value || null, prop: base.prop, dept: fd.value, pos: fp.value, date: $("#f-date", m).value, start: $("#f-st", m).value, end: $("#f-en", m).value, brk: Number($("#f-brk", m).value) || 0, note: $("#f-note", m).value.trim() });
      const upd = () => {
        const d = draft();
        if (!d.start || !d.end || !d.date) return;
        const w = shiftWarnings(d, s && s.id);
        $("#f-warn", m).innerHTML = w.length ? `<div class="banner warn mt" style="display:block">${w.map((x) => `<div>⚠️ ${esc(x)}</div>`).join("")}</div>` : "";
        $("#f-sum", m).textContent = `${h1(shiftMin(d))} paid · estimated cost ${money((shiftMin(d) / 60) * rate(E(d.emp), d.pos))}`;
        if (!d.emp) {
          const best = suggest(d);
          $("#f-sug", m).innerHTML = best.length ? "Suggested: " + best.map((x) => `<a href="#" data-sug="${x.e.id}">${esc(nm(x.e))}</a> (${h1(x.m)} this week)`).join(", ") : "";
          $$("[data-sug]", m).forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); fe.value = a.dataset.sug; upd(); }));
        } else $("#f-sug", m).textContent = "";
      };
      fillPos(); fillEmp();
      fd.onchange = () => { base.pos = null; fillPos(); fillEmp(); upd(); };
      fe.onchange = () => { const e = E(fe.value); if (e && e.dept === fd.value) fp.value = e.pos; upd(); };
      $$("input, select", m).forEach((x) => x.addEventListener("input", upd));
      upd();
      $("[data-x2]", m).onclick = closeModal;
      if (readOnly) return;
      $("#f-ok", m).onclick = () => {
        const d = draft();
        if (!d.date || !d.start || !d.end) return toast("Fill in the date and times");
        if (d.date < today()) return toast("Pick today or a later date");
        if (s) { Object.assign(s, d); log(`Edited shift ${fmtD(d.date)} ${fmtT(d.start)} (${nmId(d.emp)})`); }
        else { d.id = uid("s"); S().shifts.push(d); log(`Added shift ${fmtD(d.date)} ${fmtT(d.start)} for ${d.emp ? nmId(d.emp) : "open"}`); }
        if (isPublished(d.prop, weekStart(d.date)) && d.emp) toast(`${nmId(d.emp)} will be notified`); else toast(isNew ? "Shift added" : "Shift saved");
        closeModal(); refresh();
      };
      if (!isNew) $("#f-del", m).onclick = () => { S().shifts = S().shifts.filter((x) => x.id !== s.id); S().swaps = S().swaps.filter((w) => w.shift !== s.id); log(`Deleted shift ${fmtD(s.date)} ${fmtT(s.start)}`); closeModal(); refresh(); toast("Shift deleted"); };
    },
  });
}

function suggest(d) {
  const ws = weekStart(d.date);
  return activeEmps().filter((e) => e.prop === d.prop && e.dept === d.dept && e.pay === "hourly" && e.status === "active")
    .map((e) => ({ e, m: [...Array(7)].reduce((a, _, i) => a + shiftsOn(e.id, addDays(ws, i)).reduce((b, x) => b + shiftMin(x), 0), 0) }))
    .filter(({ e }) => !shiftWarnings({ ...d, emp: e.id }).length)
    .sort((a, b) => a.m - b.m).slice(0, 3);
}

ACT.autofill = () => {
  const pid = schedProp(), ws = ui.week, T = today();
  const open = S().shifts.filter((s) => !s.emp && s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6) && s.date >= T && (ui.dept === "all" || s.dept === ui.dept));
  let n = 0;
  for (const s of open) { const b = suggest(s)[0]; if (b) { s.emp = b.e.id; n++; } }
  log(`Auto-filled ${n} open shifts for the week of ${fmtDs(ws)}`);
  refresh();
  toast(n ? `Filled ${n} of ${open.length} open shifts without overtime or rule breaks` : "No one is free without breaking a rule. Try posting them as open shifts.");
};
ACT["copy-week"] = () => {
  const pid = schedProp(), ws = ui.week, prev = addDays(ws, -7), T = today();
  confirmBox("Copy last week?", `This replaces the shifts from ${fmtDs(ws)} onward in ${ui.dept === "all" ? "every department" : dept(ui.dept).name} with last week's pattern. Shifts for anyone on approved leave become open shifts. The week goes back to draft.`, "Copy last week", () => {
    const inD = (s) => ui.dept === "all" || s.dept === ui.dept;
    S().shifts = S().shifts.filter((s) => !(s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6) && s.date >= T && inD(s)));
    let n = 0;
    S().shifts.filter((s) => s.prop === pid && s.date >= prev && s.date < ws && inD(s)).forEach((s) => {
      const d = addDays(s.date, 7); if (d < T) return;
      const emp = s.emp && E(s.emp)?.status !== "terminated" && !onLeave(s.emp, d) ? s.emp : null;
      S().shifts.push({ ...s, id: uid("s"), date: d, emp }); n++;
    });
    S().published[pid + "|" + ws] = false;
    log(`Copied ${n} shifts from the week of ${fmtDs(prev)}`); refresh(); toast(`Copied ${n} shifts. Review, then publish.`);
  });
};
ACT.publish = () => {
  const pid = schedProp(), ws = ui.week;
  const people = new Set(S().shifts.filter((s) => s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6) && s.emp).map((s) => s.emp)).size;
  S().published[pid + "|" + ws] = true;
  log(`Published the schedule for the week of ${fmtDs(ws)} at ${prop(pid).short}`); refresh(); toast(`Published. ${people} people can now see their shifts.`);
};
ACT["sched-csv"] = () => {
  const pid = schedProp(), ws = ui.week;
  const rows = [["Date", "Day", "Department", "Position", "Employee", "Start", "End", "Break (min)", "Paid hours", "Est. cost", "Note"]];
  S().shifts.filter((s) => s.prop === pid && s.date >= ws && s.date <= addDays(ws, 6)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .forEach((s) => rows.push([s.date, DOW[dow(s.date)], dept(s.dept).name, posName(s.pos), s.emp ? nmId(s.emp) : "OPEN", s.start, s.end, s.brk, (shiftMin(s) / 60).toFixed(2), shiftCost(s).toFixed(2), s.note]));
  csv(`schedule-${pid}-${ws}.csv`, rows);
};

// Employee schedule
function scheduleEmployee(v) {
  const e = me(), T = today();
  const ws = ui.week;
  const days = [...Array(14)].map((_, i) => addDays(ws, i));
  const team = ui.team || false;
  v.innerHTML = `
  <div class="ph"><div><h1>My schedule</h1><p>${fmtDs(ws)} – ${fmtDY(days[13])}</p></div>
    <div class="toolbar"><div class="seg"><button data-act="wk" data-n="-7" aria-label="Previous week">‹</button><button data-act="wk" data-n="0">Today</button><button data-act="wk" data-n="7" aria-label="Next week">›</button></div>
    <div class="seg"><button data-act="team" data-t="0" class="${team ? "" : "on"}">Mine</button><button data-act="team" data-t="1" class="${team ? "on" : ""}">My team</button></div>
    <button class="btn" data-act="avail">My availability</button></div></div>
  <div class="day-list">${days.map((d) => {
    const pub = isPublished(e.prop, weekStart(d));
    const lv = onLeave(e.id, d);
    let sh = S().shifts.filter((s) => s.prop === e.prop && s.date === d && (team ? s.dept === e.dept : s.emp === e.id));
    if (!pub) sh = [];
    sh.sort((a, b) => a.start.localeCompare(b.start));
    return `<div class="day ${d === T ? "today" : ""}"><h3><span>${fmtD(d)}${HOLIDAYS[d] ? " · " + HOLIDAYS[d] : ""}</span>${!pub ? `<span class="muted" style="font-weight:500">Not published yet</span>` : ""}</h3>
      ${lv ? `<div class="mshift" style="--c:#8a6d00"><div class="grow"><b>${typeName[lv.type]} (approved)</b></div></div>` : ""}
      ${sh.map((s) => { const mine = s.emp === e.id; const pend = S().swaps.find((w) => w.shift === s.id && w.status === "pending");
        return `<div class="mshift" style="--c:${mine ? dept(s.dept).color : s.emp ? "#cfd6de" : "#eb6834"}" ${mine || !s.emp ? `data-act="edit-shift" data-id="${s.id}"` : ""}><span class="tm">${fmtT(s.start)}–${fmtT(s.end)}</span><div class="grow"><b>${mine ? "You" : s.emp ? esc(nmId(s.emp)) : "Open shift"}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}${s.note ? " · " + esc(s.note) : ""}</small></div>${pend ? `<span class="pill warn">${pend.type === "pickup" ? "Pick-up asked" : "Change asked"}</span>` : mine && d >= T ? `<span class="muted" style="font-size:12px">Swap ›</span>` : !s.emp ? `<span class="pill info">Pick up</span>` : ""}</div>`; }).join("")}
      ${!lv && !sh.length && pub ? `<div class="muted" style="font-size:13px">${team ? "No shifts." : "Day off"}</div>` : ""}</div>`;
  }).join("")}</div>`;
}
ACT.team = (b) => { ui.team = b.dataset.t === "1"; A.render(); };

function myShiftActions(s) {
  const e = me(), T = today();
  if (!s.emp) { if (s.date < T) return; return confirmBox("Pick up this shift?", `${fmtD(s.date)}, ${fmtT(s.start)} to ${fmtT(s.end)} as ${esc(posName(s.pos))}. Your manager will approve it.`, "Send request", () => ACT.pickup({ dataset: { id: s.id } })); }
  if (s.emp !== e.id || s.date < T) return;
  const mates = activeEmps().filter((x) => x.prop === e.prop && x.dept === e.dept && x.id !== e.id && x.status === "active" && x.pay === "hourly");
  modal({
    title: "Change this shift",
    body: `<p><b>${fmtD(s.date)}, ${fmtT(s.start)} – ${fmtT(s.end)}</b><br><span class="muted">${esc(posName(s.pos))}</span></p>
      <div class="field"><label>What would you like to do?</label><select id="sw-t"><option value="swap">Swap with a co-worker</option><option value="drop">Give it away (post as an open shift)</option></select></div>
      <div class="field mt" id="sw-who"><label>Co-worker</label><select id="sw-to">${mates.map((x) => `<option value="${x.id}">${esc(nm(x))} · ${esc(posName(x.pos))}${shiftsOn(x.id, s.date).length ? " (already working)" : ""}</option>`).join("")}</select></div>
      <div class="field mt"><label>Reason (optional)</label><input type="text" id="sw-n" maxlength="120"></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="sw-ok">Send to manager</button>`,
    onMount: (m) => {
      $("#sw-t", m).onchange = (ev) => ($("#sw-who", m).style.display = ev.target.value === "swap" ? "" : "none");
      $("[data-x2]", m).onclick = closeModal;
      $("#sw-ok", m).onclick = () => {
        const t = $("#sw-t", m).value;
        S().swaps.push({ id: uid("w"), type: t, shift: s.id, from: e.id, to: t === "swap" ? $("#sw-to", m).value : null, status: "pending", note: $("#sw-n", m).value, created: today() });
        log(`Asked to ${t === "swap" ? "swap" : "give away"} the shift on ${fmtD(s.date)}`); closeModal(); refresh(); toast("Sent to your manager for approval");
      };
    },
  });
}

ACT.avail = () => {
  const e = me();
  modal({
    title: "My availability",
    body: `<p class="muted">Tell your manager which days you can work. The scheduler warns them before booking you on a day you marked unavailable.</p>
      <table><tbody>${DOW.map((d, i) => `<tr><td><b>${d}</b></td><td><div class="seg" data-i="${i}">${[["any", "Any time"], ["am", "Mornings"], ["pm", "Evenings"], ["off", "Not available"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${e.avail[i] === k ? "on" : ""}">${l}</button>`).join("")}</div></td></tr>`).join("")}</tbody></table>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="av-ok">Save</button>`,
    onMount: (m) => {
      const a = [...e.avail];
      $$(".seg", m).forEach((g) => $$("button", g).forEach((b) => (b.onclick = () => { a[g.dataset.i] = b.dataset.v; $$("button", g).forEach((x) => x.classList.toggle("on", x === b)); })));
      $("[data-x2]", m).onclick = closeModal;
      $("#av-ok", m).onclick = () => { e.avail = a; log("Updated availability"); closeModal(); refresh(); toast("Availability saved"); };
    },
  });
};

Object.assign(A, { liveBoard, costFor, budgetFor, dayCost });
})();
