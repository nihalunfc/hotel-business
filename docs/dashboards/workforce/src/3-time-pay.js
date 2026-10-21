// Time clock, timesheets, payroll and pay stubs.
"use strict";
(() => {
const A = window.WFAPP;
const { ui, save, refresh, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, h1, m0, pct, role, me, isMgr, scope, inScope, rate, activeEmps, typeName, shiftsOn, openPunch, exceptionsFor } = A;
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, toHM, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const S = () => A.S;
const nowHM = () => toHM(nowMin());
const clockStr = () => new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

// ---------- Punch actions ----------
function clockIn(empId) {
  const T = today(), n = nowMin();
  const sh = shiftsOn(empId, T).filter((x) => Math.abs(toMin(x.start) - n) <= 240).sort((a, b) => Math.abs(toMin(a.start) - n) - Math.abs(toMin(b.start) - n))[0];
  S().punches.push({ id: uid("c"), emp: empId, date: T, in: nowHM(), out: null, brk: 0, brkStart: null, shift: sh ? sh.id : null, edited: false, note: "", tips: 0 });
  log(`${nmId(empId)} clocked in`);
  return sh;
}
function clockOut(empId) {
  const c = openPunch(empId); if (!c) return;
  if (c.brkStart) { c.brk += span(c.brkStart, nowHM()); c.brkStart = null; }
  c.out = nowHM(); log(`${nmId(empId)} clocked out`);
}
function breakToggle(empId) {
  const c = openPunch(empId); if (!c) return;
  if (c.brkStart) { c.brk += span(c.brkStart, nowHM()); c.brkStart = null; log(`${nmId(empId)} ended break`); }
  else { c.brkStart = nowHM(); log(`${nmId(empId)} started break`); }
}

// ---------- Time clock ----------
VIEWS.clock = (v) => (role() === "employee" ? clockEmployee(v) : clockManager(v));

function clockCard(empId, kiosk) {
  const e = E(empId), c = openPunch(empId), T = today();
  const sh = shiftsOn(empId, T)[0];
  const worked = c ? punchMin(c) : 0;
  return `<div class="clock-face"><div class="t" data-clock>${clockStr()}</div><div class="d">${fmtDY(T)}</div></div>
    <div style="text-align:center;margin-top:10px">${c ? `<span class="status-chip ${c.brkStart ? "brk" : "in"}">● ${c.brkStart ? "On break since " + fmtT(c.brkStart) : "Clocked in at " + fmtT(c.in)}</span>` : `<span class="status-chip out">○ Not clocked in</span>`}</div>
    <p class="muted" style="text-align:center;margin:10px 0 0;font-size:13.5px">${kiosk ? `<b style="color:var(--ink)">${esc(nm(e))}</b> · ` : ""}${sh ? `Today's shift ${fmtT(sh.start)} – ${fmtT(sh.end)}` : "No shift scheduled today"}${c ? ` · ${h1(worked)} so far` : ""}</p>
    <div class="clock-actions">${c ? `<button class="btn lg" data-act="brk" data-id="${empId}">${c.brkStart ? "End break" : "Start break"}</button><button class="btn lg primary" data-act="cout" data-id="${empId}">Clock out</button>` : `<button class="btn lg primary" style="grid-column:1/-1" data-act="cin" data-id="${empId}">Clock in</button>`}</div>`;
}
ACT.cin = (b) => { const sh = clockIn(b.dataset.id); const late = sh ? nowMin() - toMin(sh.start) : 0; afterPunch(b, `${nmId(b.dataset.id)} clocked in at ${clockStr()}${sh && late > S().settings.graceMin && late < 600 ? ` (${late} min late)` : ""}`); };
ACT.cout = (b) => { clockOut(b.dataset.id); afterPunch(b, `${nmId(b.dataset.id)} clocked out at ${clockStr()}`); };
ACT.brk = (b) => { breakToggle(b.dataset.id); afterPunch(b, openPunch(b.dataset.id)?.brkStart ? "Break started. Enjoy." : "Welcome back"); };
function afterPunch(b, msg) { const inModal = b.closest("#modal"); if (inModal) closeModal(); refresh(); toast(msg); }

function clockEmployee(v) {
  const e = me(), T = today();
  const op = openPunch(e.id);
  const recent = S().punches.filter((c) => c.emp === e.id && c.date < T && c !== op).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  v.innerHTML = `<div class="grid g2">
    <div class="card">${clockCard(e.id)}<p class="muted" style="font-size:12.5px;margin:14px 0 0;text-align:center">In production this checks the hotel's Wi-Fi or a geofence before accepting a punch.</p></div>
    <div class="card"><div class="card-h"><h2>Recent punches</h2><a href="#/timesheets" class="btn sm">My timesheet</a></div>
      <div class="list">${recent.map((c) => { const x = exceptionsFor(e.id, c.date); return `<div class="li"><div class="grow"><b>${fmtD(c.date)}</b><small>${fmtT(c.in)} – ${c.out ? fmtT(c.out) : "missing"} · break ${c.brk} min · ${h1(punchMin(c))}</small></div>${x.length ? `<span class="pill ${x[0].cls}">${esc(x[0].t)}</span>` : ""}<button class="btn sm" data-act="fix" data-id="${c.id}">Fix</button></div>`; }).join("") || `<div class="empty">No punches yet.</div>`}</div></div></div>`;
}

function clockManager(v) {
  const pid = scope();
  const board = A.liveBoard(pid);
  const grp = { in: board.filter((r) => r.ord === 0), brk: board.filter((r) => r.ord === 1), late: board.filter((r) => r.ord === 2), up: board.filter((r) => r.ord === 3), done: board.filter((r) => r.ord === 5) };
  const col = (t, list, cls) => `<div class="card"><div class="card-h"><h3>${t}</h3><span class="pill ${cls}">${list.length}</span></div><div class="list">${list.map((r) => { const e = E(r.s.emp); return `<div class="li">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))}</b><small>${esc(posName(e.pos))} · ${fmtT(r.s.start)}–${fmtT(r.s.end)}${r.c ? ` · in ${fmtT(r.c.in)}` : ""}${r.c && r.c.out ? ` · out ${fmtT(r.c.out)}` : ""}</small></div>${r.ord <= 2 ? `<button class="btn sm" data-act="kiosk-for" data-id="${e.id}">${r.ord === 2 ? "Clock in" : "Punch"}</button>` : ""}</div>`; }).join("") || `<div class="empty">Nobody.</div>`}</div></div>`;
  v.innerHTML = `<div class="ph"><div><h1>Time clock</h1><p>${esc(pid === "all" ? "All hotels" : prop(pid).name)} · live status of today's shifts</p></div><div class="toolbar"><button class="btn primary" data-act="kiosk">Open kiosk mode</button></div></div>
    <div class="grid g4 keep2" style="margin-bottom:16px">
      <div class="kpi ok"><div class="l">Clocked in</div><div class="v">${grp.in.length}</div></div>
      <div class="kpi"><div class="l">On break</div><div class="v">${grp.brk.length}</div></div>
      <div class="kpi ${grp.late.length ? "alert" : ""}"><div class="l">Late or missing</div><div class="v">${grp.late.length}</div></div>
      <div class="kpi"><div class="l">Still to start</div><div class="v">${grp.up.length}</div></div>
    </div>
    <div class="grid g2">${col("Clocked in", grp.in, "good")}${col("Late or not in", grp.late, "bad")}${col("On break", grp.brk, "warn")}${col("Starting later", grp.up, "info")}</div>
    <div class="card mt">${col("Finished today", grp.done, "").replace(/^<div class="card">|<\/div>$/g, "")}</div>`;
}
ACT["kiosk-for"] = (b) => modal({ title: "Punch for " + esc(nmId(b.dataset.id)), body: clockCard(b.dataset.id, true) + `<p class="muted" style="font-size:12.5px;margin-top:12px">A manager punch is recorded as an edit in the audit log.</p>` });
ACT.kiosk = () => {
  let pin = "";
  const draw = (m) => {
    $("#pd", m).innerHTML = [0, 1, 2, 3].map((i) => `<i class="${i < pin.length ? "f" : ""}"></i>`).join("");
  };
  modal({
    title: "Kiosk: enter your PIN",
    body: `<div class="clock-face"><div class="t" data-clock style="font-size:36px">${clockStr()}</div><div class="d">${esc(prop(scope() === "all" ? "p1" : scope()).name)}</div></div>
      <div class="pin-dots" id="pd"></div><div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join("")}</div>
      <p class="muted" style="text-align:center;font-size:12.5px;margin:12px 0 0">Demo: ${esc(nmId(S().personas.employee))} uses PIN ${E(S().personas.employee).pin}. Each PIN is on the person's profile.</p>`,
    onMount: (m) => {
      draw(m);
      const press = (k) => {
        if (k === "⌫") pin = pin.slice(0, -1);
        else if (k === "✓" || pin.length === 4) return;
        else pin += k;
        draw(m);
        if (pin.length === 4) {
          const e = activeEmps().find((x) => x.pin === pin && (scope() === "all" || x.prop === scope()));
          if (!e) { toast("PIN not recognised at this hotel"); pin = ""; setTimeout(() => draw(m), 150); return; }
          $(".mb", m).innerHTML = clockCard(e.id, true);
          $(".mh h2", m).textContent = "Hello, " + e.first;
        }
      };
      $$(".pinpad button", m).forEach((b) => (b.onclick = () => press(b.dataset.k)));
      const kd = (ev) => { if (/^[0-9]$/.test(ev.key)) press(ev.key); if (ev.key === "Backspace") press("⌫"); };
      document.addEventListener("keydown", kd);
      A.setModalClose(() => document.removeEventListener("keydown", kd));
    },
  });
};

// ---------- Punch correction (employee) ----------
ACT.fix = (b) => {
  const c = S().punches.find((x) => x.id === b.dataset.id);
  const sh = S().shifts.find((x) => x.id === c.shift);
  modal({
    title: "Ask for a punch fix",
    body: `<p><b>${fmtD(c.date)}</b> · in ${fmtT(c.in)}, out ${c.out ? fmtT(c.out) : "missing"}${sh ? ` · scheduled ${fmtT(sh.start)}–${fmtT(sh.end)}` : ""}</p>
      <div class="fields"><div class="field"><label>Which punch?</label><select id="fx-f"><option value="out" ${c.out ? "" : "selected"}>Clock out</option><option value="in">Clock in</option></select></div>
      <div class="field"><label>Correct time</label><input type="time" id="fx-t" value="${c.out || (sh ? sh.end : "")}"></div>
      <div class="field full"><label>Reason</label><input type="text" id="fx-r" maxlength="140" placeholder="e.g. The kiosk was down when I left"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="fx-ok">Send to manager</button>`,
    onMount: (m) => {
      $("#fx-f", m).onchange = (ev) => ($("#fx-t", m).value = ev.target.value === "in" ? c.in : c.out || (sh ? sh.end : ""));
      $("[data-x2]", m).onclick = closeModal;
      $("#fx-ok", m).onclick = () => {
        const f = $("#fx-f", m).value, t = $("#fx-t", m).value, r = $("#fx-r", m).value.trim();
        if (!t) return toast("Enter the correct time"); if (!r) return toast("Add a short reason");
        S().corrections.push({ id: uid("k"), emp: c.emp, punch: c.id, date: c.date, field: f, from: c[f], to: t, reason: r, status: "pending", created: today() });
        log(`Asked for a punch fix on ${fmtD(c.date)}`); closeModal(); refresh(); toast("Sent to your manager");
      };
    },
  });
};

// ---------- Timesheets ----------
const periods = () => { const cur = periodStart(today()); return [addDays(cur, -14), cur]; };
const pLabel = (ps) => `${fmtDs(ps)} – ${fmtDY(addDays(ps, 13))}`;
const tsKey = (empId, ps) => empId + "|" + ps;
function periodExc(empId, ps) { const T = today(); const out = []; for (let d = ps; d <= addDays(ps, 13) && d < T; d = addDays(d, 1)) exceptionsFor(empId, d).forEach((x) => out.push({ d, ...x })); return out; }
A.periodExc = periodExc;

VIEWS.timesheets = (v) => {
  if (role() === "employee") return timesheetDetail(v, S().me.emp, ui.period);
  const ps = ui.period, pe = addDays(ps, 13);
  const locked = S().payruns[ps]?.status === "finalized";
  const emps = activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe && (ui.dept === "all" || e.dept === ui.dept) && (!ui.tsQ || nm(e).toLowerCase().includes(ui.tsQ.toLowerCase())));
  const rows = emps.map((e) => { const p = payFor(S(), e, ps); const x = periodExc(e.id, ps); return { e, p, x, ok: !!S().tsApproved[tsKey(e.id, ps)] }; });
  const showOnly = ui.tsShow || "all";
  const vis = rows.filter((r) => showOnly === "all" || (showOnly === "exc" && r.x.length) || (showOnly === "todo" && !r.ok));
  const tot = rows.reduce((a, r) => ({ reg: a.reg + r.p.reg, ot: a.ot + r.p.ot, hol: a.hol + r.p.hol }), { reg: 0, ot: 0, hol: 0 });
  const approved = rows.filter((r) => r.ok).length;
  const clean = rows.filter((r) => !r.ok && !r.x.length).length;
  v.innerHTML = `<div class="ph"><div><h1>Timesheets</h1><p>Pay period ${pLabel(ps)} · ${locked ? `<span class="pill good">Paid, locked</span>` : ps === periodStart(today()) ? `<span class="pill info">Open</span>` : `<span class="pill warn">Closed, waiting for payroll</span>`}</p></div>
    <div class="toolbar"><select id="ts-p" aria-label="Pay period">${periods().map((p) => `<option value="${p}" ${p === ps ? "selected" : ""}>${pLabel(p)}</option>`).join("")}</select>
    <select id="ts-d" aria-label="Department"><option value="all">All departments</option>${S().depts.map((d) => `<option value="${d.id}" ${ui.dept === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
    <input type="search" id="ts-q" placeholder="Search name" value="${esc(ui.tsQ)}" style="width:150px"></div></div>
  <div class="grid g4 keep2" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Regular hours</div><div class="v">${h1(tot.reg)}</div></div>
    <div class="kpi ${tot.ot ? "alert" : ""}"><div class="l">Overtime hours</div><div class="v">${h1(tot.ot)}</div><div class="s">Over ${S().settings.otWeekly} h a week, paid at 1.5×</div></div>
    <div class="kpi"><div class="l">Holiday hours worked</div><div class="v">${h1(tot.hol)}</div><div class="s">Paid at 1.5× plus holiday pay</div></div>
    <div class="kpi ${approved === rows.length ? "ok" : ""}"><div class="l">Approved</div><div class="v">${approved} / ${rows.length}</div><div class="bar"><i class="good" style="width:${(approved / Math.max(1, rows.length)) * 100}%"></i></div></div>
  </div>
  <div class="card">
    <div class="card-h"><div class="seg"><button data-act="ts-show" data-s="all" class="${showOnly === "all" ? "on" : ""}">Everyone</button><button data-act="ts-show" data-s="exc" class="${showOnly === "exc" ? "on" : ""}">With exceptions</button><button data-act="ts-show" data-s="todo" class="${showOnly === "todo" ? "on" : ""}">Not approved</button></div>
    <div class="toolbar">${locked ? "" : `<button class="btn good" data-act="ts-bulk" ${clean ? "" : "disabled"}>Approve ${clean} without exceptions</button>`}<button class="btn" data-act="ts-csv">Export CSV</button></div></div>
    <div class="tw"><table><thead><tr><th>Employee</th><th class="hide-sm">Department</th><th class="n">Regular</th><th class="n">Overtime</th><th class="n hide-sm">Holiday</th><th class="n hide-sm">Time off</th><th>Exceptions</th><th>Status</th></tr></thead><tbody>
    ${vis.map((r) => `<tr class="click" data-act="ts-open" data-id="${r.e.id}"><td><b>${esc(nm(r.e))}</b><br><small>${esc(posName(r.e.pos))}${r.e.pay === "salary" ? " · salaried" : ""}</small></td><td class="hide-sm"><span class="dot" style="background:${dept(r.e.dept).color}"></span>${esc(dept(r.e.dept).name)}</td><td class="n">${(r.p.reg / 60).toFixed(2)}</td><td class="n" style="${r.p.ot ? "color:var(--bad);font-weight:600" : ""}">${(r.p.ot / 60).toFixed(2)}</td><td class="n hide-sm">${(r.p.hol / 60).toFixed(2)}</td><td class="n hide-sm">${r.p.ptoHrs ? r.p.ptoHrs.toFixed(2) : "–"}</td><td>${r.x.length ? `<span class="pill ${r.x.some((x) => x.cls === "bad") ? "bad" : "warn"}">${r.x.length}</span>` : `<span class="muted">–</span>`}</td><td>${r.ok ? `<span class="pill good">Approved</span>` : `<span class="pill">Pending</span>`}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No timesheets match.</td></tr>`}
    </tbody></table></div></div>`;
  $("#ts-p").onchange = (e) => { ui.period = e.target.value; A.render(); };
  $("#ts-d").onchange = (e) => { ui.dept = e.target.value; A.render(); };
  $("#ts-q").oninput = (e) => { ui.tsQ = e.target.value; clearTimeout(ui._t); ui._t = setTimeout(() => { A.render(); const q = $("#ts-q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
};
ACT["ts-show"] = (b) => { ui.tsShow = b.dataset.s; A.render(); };
ACT["ts-bulk"] = () => {
  const ps = ui.period, pe = addDays(ps, 13); let n = 0;
  activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe && (ui.dept === "all" || e.dept === ui.dept)).forEach((e) => { if (!S().tsApproved[tsKey(e.id, ps)] && !periodExc(e.id, ps).length) { S().tsApproved[tsKey(e.id, ps)] = { by: S().me.emp, at: today() }; n++; } });
  log(`Approved ${n} timesheets for ${pLabel(ps)}`); refresh(); toast(`${n} timesheets approved`);
};
ACT["ts-csv"] = () => {
  const ps = ui.period;
  const rows = [["Employee #", "Name", "Hotel", "Department", "Position", "Regular h", "Overtime h", "Holiday h", "Time off h", "Exceptions", "Approved"]];
  activeEmps().filter((e) => inScope(e.prop) && e.hire <= addDays(ps, 13)).forEach((e) => { const p = payFor(S(), e, ps); rows.push([e.no, nm(e), prop(e.prop).short, dept(e.dept).name, posName(e.pos), (p.reg / 60).toFixed(2), (p.ot / 60).toFixed(2), (p.hol / 60).toFixed(2), p.ptoHrs, periodExc(e.id, ps).length, S().tsApproved[tsKey(e.id, ps)] ? "Yes" : "No"]); });
  csv(`timesheets-${ps}.csv`, rows);
};
ACT["ts-open"] = (b) => { const id = b.dataset.id; modal({ title: esc(nmId(id)) + " · timesheet", wide: true, body: `<div id="tsd"></div>`, onMount: (m) => timesheetDetail($("#tsd", m), id, ui.period, true) }); };

function timesheetDetail(v, empId, ps, inModal) {
  const e = E(empId), T = today(), mgr = isMgr();
  const locked = S().payruns[ps]?.status === "finalized";
  const p = payFor(S(), e, ps);
  const days = [...Array(14)].map((_, i) => addDays(ps, i));
  const ok = S().tsApproved[tsKey(empId, ps)];
  const canEdit = mgr && !locked;
  const head = inModal ? "" : `<div class="ph"><div><h1>My timesheet</h1><p>Pay period ${pLabel(ps)}</p></div><div class="toolbar"><select id="ts-p" aria-label="Pay period">${periods().map((x) => `<option value="${x}" ${x === ps ? "selected" : ""}>${pLabel(x)}</option>`).join("")}</select></div></div>`;
  v.innerHTML = `${head}
  ${inModal ? `<div class="toolbar" style="justify-content:space-between;margin-bottom:12px"><span>${esc(posName(e.pos))} · ${esc(prop(e.prop).short)} · ${pLabel(ps)}</span>${ok ? `<span class="pill good">Approved ${fmtDs(ok.at)}</span>` : `<span class="pill">Not approved</span>`}</div>` : ""}
  <div class="grid g4 keep2" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Regular</div><div class="v">${h1(p.reg)}</div></div>
    <div class="kpi ${p.ot ? "alert" : ""}"><div class="l">Overtime</div><div class="v">${h1(p.ot)}</div></div>
    <div class="kpi"><div class="l">Holiday worked</div><div class="v">${h1(p.hol)}</div></div>
    <div class="kpi"><div class="l">Paid time off</div><div class="v">${p.ptoHrs} h</div></div>
  </div>
  <div class="tw"><table><thead><tr><th>Day</th><th>Scheduled</th><th>In</th><th>Out</th><th class="n">Break</th><th class="n">Hours</th><th>Notes</th>${!mgr ? "<th></th>" : ""}</tr></thead><tbody>
  ${days.map((d) => {
    const pu = S().punches.filter((c) => c.emp === empId && c.date === d);
    const sh = shiftsOn(empId, d);
    const lv = onLeaveAny(empId, d);
    const x = d <= T ? exceptionsFor(empId, d) : [];
    const sched = sh.map((s) => `${fmtT(s.start)}–${fmtT(s.end)}`).join(", ") || (lv ? typeName[lv.type] : `<span class="muted">Off</span>`);
    const wk = d === addDays(ps, 7) ? ` style="border-top:2px solid var(--line-2)"` : "";
    if (!pu.length) return `<tr${wk}><td class="nowrap"><b>${fmtD(d)}</b>${HOLIDAYS[d] ? `<br><small style="color:var(--good)">${HOLIDAYS[d]}</small>` : ""}</td><td class="nowrap">${sched}</td><td>–</td><td>–</td><td class="n">–</td><td class="n">${lv ? "8.00" : "–"}</td><td>${x.map((y) => `<span class="pill ${y.cls}">${esc(y.t)}</span>`).join(" ")}${lv ? `<span class="pill violet">${typeName[lv.type]}</span>` : ""}${canEdit && d <= T && !lv ? ` <button class="btn sm" data-act="add-punch" data-emp="${empId}" data-d="${d}">+ Punch</button>` : ""}</td>${!mgr ? "<td></td>" : ""}</tr>`;
    return pu.map((c, i) => `<tr${i ? "" : wk}><td class="nowrap">${i ? "" : `<b>${fmtD(d)}</b>${HOLIDAYS[d] ? `<br><small style="color:var(--good)">${HOLIDAYS[d]}</small>` : ""}`}</td><td class="nowrap">${i ? "" : sched}</td>
      <td>${canEdit ? `<input type="time" value="${c.in}" data-pe="in" data-id="${c.id}" style="width:118px">` : fmtT(c.in)}</td>
      <td>${canEdit ? `<input type="time" value="${c.out || ""}" data-pe="out" data-id="${c.id}" style="width:118px">` : c.out ? fmtT(c.out) : c.date === T ? `<span class="pill good">In now</span>` : `<span class="pill bad">Missing</span>`}</td>
      <td class="n">${canEdit ? `<input type="number" min="0" max="180" value="${c.brk}" data-pe="brk" data-id="${c.id}" style="width:70px">` : c.brk + "m"}</td>
      <td class="n"><b>${(punchMin(c) / 60).toFixed(2)}</b></td>
      <td>${x.map((y) => `<span class="pill ${y.cls}">${esc(y.t)}</span>`).join(" ")}${c.edited ? ` <span class="pill info" title="${esc(c.note)}">Edited</span>` : ""}${c.tips ? ` <small>Tips ${money(c.tips)}</small>` : ""}</td>
      ${!mgr ? `<td>${d < T ? `<button class="btn sm" data-act="fix" data-id="${c.id}">Fix</button>` : ""}</td>` : ""}</tr>`).join("");
  }).join("")}
  </tbody><tfoot><tr><td colspan="5">Total</td><td class="n">${((p.reg + p.ot + p.hol) / 60).toFixed(2)}</td><td colspan="${mgr ? 1 : 2}"></td></tr></tfoot></table></div>
  ${mgr ? `<div class="toolbar" style="justify-content:flex-end;margin-top:14px">${locked ? `<span class="muted">This period has been paid and is locked.</span>` : ok ? `<button class="btn" data-act="ts-unapprove" data-id="${empId}">Remove approval</button>` : `<button class="btn good" data-act="ts-approve" data-id="${empId}">Approve timesheet</button>`}</div>` : `<p class="muted" style="font-size:13px;margin-top:12px">${ok ? "Your manager approved this timesheet." : "Your manager approves timesheets at the end of the pay period. Spot a mistake? Use Fix to ask for a correction."}</p>`}`;
  const tp = $("#ts-p", v); if (tp) tp.onchange = (ev) => { ui.period = ev.target.value; A.render(); };
  $$("[data-pe]", v).forEach((inp) => (inp.onchange = () => {
    const c = S().punches.find((x) => x.id === inp.dataset.id);
    const f = inp.dataset.pe, old = c[f];
    c[f] = f === "brk" ? Math.max(0, Number(inp.value) || 0) : inp.value || null;
    c.edited = true; c.note = `Edited by ${nm(me())} on ${fmtDs(today())}`;
    delete S().tsApproved[tsKey(empId, ps)];
    log(`Edited ${nm(e)}'s ${f === "brk" ? "break" : "punch " + f} on ${fmtD(c.date)}: ${old ?? "blank"} → ${c[f] ?? "blank"}`);
    save(); timesheetDetail(v, empId, ps, inModal); toast("Punch updated");
  }));
  const ap = $("[data-act=ts-approve]", v), un = $("[data-act=ts-unapprove]", v);
  if (ap) ap.onclick = (ev) => { ev.stopPropagation(); S().tsApproved[tsKey(empId, ps)] = { by: S().me.emp, at: today() }; log(`Approved ${nm(e)}'s timesheet for ${pLabel(ps)}`); save(); if (inModal) { closeModal(); A.render(); } else timesheetDetail(v, empId, ps, inModal); toast("Timesheet approved"); };
  if (un) un.onclick = (ev) => { ev.stopPropagation(); delete S().tsApproved[tsKey(empId, ps)]; log(`Removed approval of ${nm(e)}'s timesheet`); save(); timesheetDetail(v, empId, ps, inModal); };
  $$("[data-act=add-punch]", v).forEach((b) => (b.onclick = (ev) => {
    ev.stopPropagation();
    const d = b.dataset.d, sh = shiftsOn(empId, d)[0];
    S().punches.push({ id: uid("c"), emp: empId, date: d, in: sh ? sh.start : "09:00", out: sh ? sh.end : "17:00", brk: sh ? sh.brk : 30, brkStart: null, shift: sh ? sh.id : null, edited: true, note: `Added by ${nm(me())}`, tips: 0 });
    delete S().tsApproved[tsKey(empId, ps)];
    log(`Added a punch for ${nm(e)} on ${fmtD(d)}`); save(); timesheetDetail(v, empId, ps, inModal);
  }));
}
function onLeaveAny(empId, d) { return S().timeoff.find((t) => t.emp === empId && t.status === "approved" && d >= t.from && d <= t.to); }

// ---------- Payroll ----------
VIEWS.payroll = (v) => {
  const ps = ui.period, pe = addDays(ps, 13), T = today();
  const run = S().payruns[ps];
  const locked = run?.status === "finalized";
  const emps = activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe && (e.status === "active" || S().punches.some((c) => c.emp === e.id && c.date >= ps && c.date <= pe)));
  const rows = emps.map((e) => ({ e, p: payFor(S(), e, ps), ok: !!S().tsApproved[tsKey(e.id, ps)] }));
  const sum = (k) => rows.reduce((a, r) => a + r.p[k], 0);
  const approved = rows.filter((r) => r.ok).length;
  const closed = pe < T;
  const step = locked ? 4 : approved < rows.length ? 1 : 2;
  const byDept = S().depts.map((d) => { const rr = rows.filter((r) => r.e.dept === d.id); return { d, n: rr.length, gross: rr.reduce((a, r) => a + r.p.gross, 0), ot: rr.reduce((a, r) => a + r.p.otPay, 0), er: rr.reduce((a, r) => a + r.p.employer, 0) }; }).filter((x) => x.n);
  v.innerHTML = `<div class="ph"><div><h1>Payroll</h1><p>${esc(scope() === "all" ? "All hotels" : prop(scope()).name)} · bi-weekly · period ${pLabel(ps)} · pay date ${fmtDY(payDate(ps))}</p></div>
    <div class="toolbar"><select id="pr-p" aria-label="Pay period">${periods().map((p) => `<option value="${p}" ${p === ps ? "selected" : ""}>${pLabel(p)}</option>`).join("")}</select><button class="btn" data-act="pr-csv">Export register</button>${locked ? "" : `<button class="btn primary" data-act="pr-final" ${closed ? "" : "disabled title='The period is still open'"}>Finalize pay run</button>`}</div></div>
  <div class="steps"><div class="${step > 1 ? "done" : "cur"}"><b>Step 1</b>Timesheets approved ${approved}/${rows.length}</div><div class="${step > 2 ? "done" : step === 2 ? "cur" : ""}"><b>Step 2</b>Review the register</div><div class="${locked ? "done" : ""}"><b>Step 3</b>Finalize ${locked ? fmtDs(run.at) : ""}</div><div class="${locked ? "done" : ""}"><b>Step 4</b>Deposit ${fmtDs(payDate(ps))}</div></div>
  ${!closed ? `<div class="banner info" style="margin-bottom:14px"><span>This period is still open, so the figures are a running estimate up to today. You can finalize after ${fmtDY(pe)}.</span></div>` : ""}
  ${!locked && closed && approved < rows.length ? `<div class="banner warn" style="margin-bottom:14px"><span>${rows.length - approved} timesheets still need approval before you finalize.</span><a class="btn sm" href="#/timesheets">Go to timesheets</a></div>` : ""}
  <div class="grid g4 keep2">
    <div class="kpi"><div class="l">Gross pay</div><div class="v">${m0(sum("gross"))}</div><div class="s">${rows.length} employees</div></div>
    <div class="kpi"><div class="l">Net pay (deposits)</div><div class="v">${m0(sum("net"))}</div><div class="s">After ${m0(sum("ded"))} deductions</div></div>
    <div class="kpi"><div class="l">Employer cost on top</div><div class="v">${m0(sum("employer"))}</div><div class="s">CPP, EI, EHT and WSIB</div></div>
    <div class="kpi ${sum("otPay") ? "alert" : ""}"><div class="l">Overtime pay</div><div class="v">${m0(sum("otPay"))}</div><div class="s">${pct(sum("otPay") / Math.max(1, sum("gross")), 1)} of gross</div></div>
  </div>
  <div class="stack mt">
    <div class="card"><div class="card-h"><h2>Pay register</h2><span class="muted" style="font-size:13px">Select a row for the pay stub</span></div>
      <div class="tw"><table><thead><tr><th>Employee</th><th class="n hide-sm">Hours</th><th class="n hide-sm">OT h</th><th class="n">Gross</th><th class="n hide-sm">CPP</th><th class="n hide-sm">EI</th><th class="n hide-sm">Tax</th><th class="n hide-sm">Other</th><th class="n">Net</th><th class="hide-sm"></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-act="stub" data-id="${r.e.id}" data-ps="${ps}"><td><b>${esc(nm(r.e))}</b><br><small>${esc(posName(r.e.pos))} · ${r.e.pay === "salary" ? "salary" : money(r.e.wage) + "/h"}</small></td><td class="n hide-sm">${r.e.pay === "salary" ? "–" : ((r.p.reg + r.p.ot + r.p.hol) / 60).toFixed(1)}</td><td class="n hide-sm">${r.p.ot ? (r.p.ot / 60).toFixed(1) : "–"}</td><td class="n">${money(r.p.gross)}</td><td class="n hide-sm">${money(r.p.cpp)}</td><td class="n hide-sm">${money(r.p.ei)}</td><td class="n hide-sm">${money(r.p.tax)}</td><td class="n hide-sm">${money(r.p.ben + r.p.union)}</td><td class="n"><b>${money(r.p.net)}</b></td><td class="hide-sm">${r.ok ? "" : `<span class="pill warn" title="Timesheet not approved">!</span>`}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td class="n hide-sm"></td><td class="n hide-sm">${(sum("ot") / 60).toFixed(1)}</td><td class="n">${money(sum("gross"))}</td><td class="n hide-sm">${money(sum("cpp"))}</td><td class="n hide-sm">${money(sum("ei"))}</td><td class="n hide-sm">${money(sum("tax"))}</td><td class="n hide-sm">${money(sum("ben") + sum("union"))}</td><td class="n">${money(sum("net"))}</td><td class="hide-sm"></td></tr></tfoot></table></div></div>
    <div class="grid g2">
      <div class="card"><h2>By department</h2><div class="chart sm"><canvas id="pr-ch"></canvas></div>
        <div class="tw"><table><thead><tr><th>Department</th><th class="n">Gross</th><th class="n">OT</th></tr></thead><tbody>${byDept.map((x) => `<tr><td><span class="dot" style="background:${x.d.color}"></span>${esc(x.d.name)}</td><td class="n">${m0(x.gross)}</td><td class="n">${m0(x.ot)}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="card"><h3>Remittances due</h3><dl class="kv"><dt>CPP (employee + employer)</dt><dd>${money(sum("cpp") * 2)}</dd><dt>EI (employee + employer)</dt><dd>${money(sum("ei") * 2.4)}</dd><dt>Income tax withheld</dt><dd>${money(sum("tax"))}</dd><dt>Union dues</dt><dd>${money(sum("union"))}</dd></dl>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">Deductions use simplified 2026 rates for the demo. A production system would use the CRA payroll tables and send a bank deposit file.</p></div>
    </div>
  </div>`;
  $("#pr-p").onchange = (e) => { ui.period = e.target.value; A.render(); };
  chart($("#pr-ch"), { type: "doughnut", data: { labels: byDept.map((x) => x.d.name), datasets: [{ data: byDept.map((x) => Math.round(x.gross)), backgroundColor: byDept.map((x) => x.d.color), borderWidth: 0 }] }, options: { cutout: "62%", plugins: { legend: { position: "right" }, tooltip: { callbacks: { label: (c) => `${c.label}: ${m0(c.raw)}` } } } } });
};
ACT["pr-final"] = () => {
  const ps = ui.period, pe = addDays(ps, 13);
  const emps = activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe);
  const un = emps.filter((e) => !S().tsApproved[tsKey(e.id, ps)]).length;
  confirmBox("Finalize this pay run?", `${un ? `<b>${un} timesheets are not approved.</b> They will be paid as recorded. ` : ""}This locks every timesheet in ${pLabel(ps)}, releases pay stubs to employees and schedules deposits for ${fmtDY(payDate(ps))}.`, "Finalize", () => {
    S().payruns[ps] = { status: "finalized", at: today(), by: S().me.emp };
    emps.forEach((e) => { if (!S().tsApproved[tsKey(e.id, ps)]) S().tsApproved[tsKey(e.id, ps)] = { by: S().me.emp, at: today(), auto: true }; });
    log(`Finalized the pay run for ${pLabel(ps)}`); refresh(); toast("Pay run finalized. Stubs released.");
  });
};
ACT["pr-csv"] = () => {
  const ps = ui.period, pe = addDays(ps, 13);
  const rows = [["Employee #", "Name", "Hotel", "Department", "Pay type", "Rate", "Regular h", "OT h", "Holiday h", "Regular $", "OT $", "Holiday $", "Time off $", "Vacation pay $", "Tips $", "Salary $", "Gross", "CPP", "EI", "Income tax", "Benefits", "Union", "Net", "Employer cost"]];
  activeEmps().filter((e) => inScope(e.prop) && e.hire <= pe).forEach((e) => { const p = payFor(S(), e, ps); rows.push([e.no, nm(e), prop(e.prop).short, dept(e.dept).name, e.pay, e.wage, (p.reg / 60).toFixed(2), (p.ot / 60).toFixed(2), (p.hol / 60).toFixed(2), p.regPay.toFixed(2), p.otPay.toFixed(2), (p.holPremPay + p.holPay).toFixed(2), p.ptoPay.toFixed(2), p.vacPay.toFixed(2), p.tips.toFixed(2), p.salary.toFixed(2), p.gross.toFixed(2), p.cpp.toFixed(2), p.ei.toFixed(2), p.tax.toFixed(2), p.ben.toFixed(2), p.union.toFixed(2), p.net.toFixed(2), p.employer.toFixed(2)]); });
  csv(`pay-register-${ps}.csv`, rows);
};

function stubHTML(e, ps) {
  const p = payFor(S(), e, ps);
  const line = (l, h, r, a) => (a ? `<tr><td>${l}</td><td class="n">${h ?? ""}</td><td class="n">${r ?? ""}</td><td class="n">${money(a)}</td></tr>` : "");
  const final = S().payruns[ps]?.status === "finalized";
  return `<div class="stub"><div class="stub-h"><div><b>${esc(S().company)}</b><small>${esc(prop(e.prop).name)}</small></div><div style="text-align:right"><b>${final ? "Pay statement" : "Estimate (period still open)"}</b><small>Period ${pLabel(ps)} · paid ${fmtDY(payDate(ps))}</small></div></div>
    <div class="stub-b"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px"><div><b>${esc(nm(e))}</b><br><small>#${e.no} · ${esc(posName(e.pos))} · ${esc(dept(e.dept).name)}</small></div><div style="text-align:right"><small>Net pay</small><div class="net">${money(p.net)}</div></div></div>
    <div class="tw"><table><thead><tr><th>Earnings</th><th class="n">Hours</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>
      ${line("Salary", null, null, p.salary)}${line("Regular", (p.reg / 60).toFixed(2), money(e.wage), p.regPay)}${line("Overtime 1.5×", (p.ot / 60).toFixed(2), money(e.wage * 1.5), p.otPay)}${line("Holiday worked 1.5×", (p.hol / 60).toFixed(2), money(e.wage * 1.5), p.holPremPay)}${line("Public holiday pay", null, null, p.holPay)}${line("Paid time off", p.ptoHrs.toFixed(2), money(e.wage), p.ptoPay)}${line(`Vacation pay ${S().settings.vacPayPct}%`, null, null, p.vacPay)}${line("Tips declared", null, null, p.tips)}
      </tbody><tfoot><tr><td colspan="3">Gross pay</td><td class="n">${money(p.gross)}</td></tr></tfoot></table></div>
    <div class="tw mt"><table><thead><tr><th>Deductions</th><th class="n">Amount</th></tr></thead><tbody>
      <tr><td>CPP contributions</td><td class="n">${money(p.cpp)}</td></tr><tr><td>EI premiums</td><td class="n">${money(p.ei)}</td></tr><tr><td>Income tax (federal + Ontario)</td><td class="n">${money(p.tax)}</td></tr>${p.ben ? `<tr><td>Health and dental</td><td class="n">${money(p.ben)}</td></tr>` : ""}${p.union ? `<tr><td>Union dues</td><td class="n">${money(p.union)}</td></tr>` : ""}
      </tbody><tfoot><tr><td>Total deductions</td><td class="n">${money(p.ded)}</td></tr></tfoot></table></div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Balances: vacation ${e.bal.vac} h · sick ${e.bal.sick} h · personal ${e.bal.per} h. Demo deductions use simplified rates.</p></div></div>`;
}
ACT.stub = (b) => { const e = E(b.dataset.id); modal({ title: "Pay stub", wide: true, body: stubHTML(e, b.dataset.ps), foot: `<button class="btn" onclick="window.print()">Print</button><button class="btn primary" data-x2>Close</button>`, onMount: (m) => ($("[data-x2]", m).onclick = closeModal) }); };

// ---------- Employee pay ----------
VIEWS.pay = (v) => {
  const e = me(), cur = periodStart(today());
  const list = [cur, addDays(cur, -14)];
  const finals = Object.keys(S().payruns).filter((k) => S().payruns[k].status === "finalized").sort().reverse();
  const ytd = finals.reduce((a, ps) => { const p = payFor(S(), e, ps); return { g: a.g + p.gross, n: a.n + p.net }; }, { g: 0, n: 0 });
  const sel = ui.payPs && list.includes(ui.payPs) ? ui.payPs : finals[0] || cur;
  v.innerHTML = `<div class="ph"><div><h1>Pay</h1><p>Bi-weekly · direct deposit to the account ending 4821</p></div></div>
  <div class="grid g-main"><div class="card" id="stub-box">${stubHTML(e, sel)}</div>
  <div class="stack"><div class="card"><h2>Pay statements</h2><div class="list">${list.map((ps) => { const p = payFor(S(), e, ps); const f = S().payruns[ps]?.status === "finalized"; return `<div class="li" style="cursor:pointer" data-act="pay-sel" data-ps="${ps}"><div class="grow"><b>${fmtDY(payDate(ps))}</b><small>${pLabel(ps)}</small></div><span class="pill ${f ? "good" : "info"}">${f ? "Paid" : "Estimate"}</span><b>${money(p.net, 0)}</b></div>`; }).join("")}</div></div>
  <div class="card"><h3>Shown in this demo</h3><dl class="kv"><dt>Gross paid</dt><dd>${money(ytd.g)}</dd><dt>Net paid</dt><dd>${money(ytd.n)}</dd></dl><p class="muted" style="font-size:12.5px;margin:10px 0 0">Year-end tax slips (T4) appear here in a full version.</p></div></div></div>`;
};
ACT["pay-sel"] = (b) => { ui.payPs = b.dataset.ps; A.render(); };

Object.assign(A, { clockIn, clockOut, tsKey, pLabel, periods, stubHTML });
})();
