// Time off, approvals, people, onboarding, reports and settings.
"use strict";
(() => {
const A = window.WFAPP;
const { ui, save, refresh, go, log, modal, closeModal, toast, confirmBox, chart, csv, VIEWS, ACT, $, $$, esc, E, nm, nmId, posName, dept, prop, av, h1, m0, pct, role, me, isMgr, scope, inScope, rate, shiftCost, onLeave, activeEmps, typeName, roleName, shiftsOn, exceptionsFor, pending } = A;
const { addDays, diffDays, dow, weekStart, today, nowMin, toMin, span, fmtD, fmtDs, fmtDY, fmtT, money, DOW, MON, HOLIDAYS, periodStart, payDate, POS, shiftMin, punchMin, payFor, uid } = WF;
const S = () => A.S;
const stPill = (s) => `<span class="pill ${s === "approved" ? "good" : s === "denied" ? "bad" : s === "pending" ? "warn" : ""}">${s}</span>`;
const workdays = (from, to) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) n++; return n; };

// ---------- Time off ----------
VIEWS.timeoff = (v) => (role() === "employee" ? timeoffEmployee(v) : timeoffManager(v));

function calendarHTML(month, filter) {
  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const start = weekStart(first);
  const T = today();
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (i >= 35 && d.slice(0, 7) !== month) break;
    const evs = S().timeoff.filter((t) => t.status !== "denied" && t.status !== "cancelled" && d >= t.from && d <= t.to && filter(E(t.emp)));
    cells += `<div class="cd ${d.slice(0, 7) !== month ? "out" : ""} ${d === T ? "today" : ""}"><div class="dn">${Number(d.slice(8))}</div>${HOLIDAYS[d] ? `<span class="ev hol">${HOLIDAYS[d]}</span>` : ""}${evs.slice(0, 3).map((t) => `<span class="ev ${t.status === "pending" ? "pend" : t.type}" title="${esc(nmId(t.emp))}: ${typeName[t.type]} (${t.status})">${esc(E(t.emp).first)} ${esc(E(t.emp).last[0])}.</span>`).join("")}${evs.length > 3 ? `<span class="ev" style="color:var(--ink-3)">+${evs.length - 3} more</span>` : ""}</div>`;
  }
  return `<div class="card-h"><h2>${MON[mo - 1]} ${y}</h2><div class="seg"><button data-act="mo" data-n="-1" aria-label="Previous month">‹</button><button data-act="mo" data-n="0">Today</button><button data-act="mo" data-n="1" aria-label="Next month">›</button></div></div>
    <div class="cal">${DOW.map((d) => `<div class="dow">${d}</div>`).join("")}${cells}</div>
    <div class="legend"><span><i class="ev vac" style="background:#dcebfb"></i>Vacation</span><span><i style="background:#fde3cf"></i>Sick</span><span><i style="background:var(--violet-soft)"></i>Personal</span><span><i style="border:1px dashed #b88a1b"></i>Asked, not approved</span><span><i style="background:#e7f5ec"></i>Stat holiday</span></div>`;
}
ACT.mo = (b) => { const n = Number(b.dataset.n); if (!n) ui.toMonth = today().slice(0, 7); else { let [y, m] = ui.toMonth.split("-").map(Number); m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.toMonth = `${y}-${String(m).padStart(2, "0")}`; } A.render(); };

function timeoffEmployee(v) {
  const e = me();
  const mine = S().timeoff.filter((t) => t.emp === e.id).sort((a, b) => b.from.localeCompare(a.from));
  v.innerHTML = `<div class="ph"><div><h1>Time off</h1><p>Your balances, requests and who else is off in ${esc(dept(e.dept).name)}.</p></div><button class="btn primary" data-act="req-to">Request time off</button></div>
  <div class="grid g3">${[["vac", "Vacation", "Accrues each pay period"], ["sick", "Sick", "Resets every January"], ["per", "Personal", "Unpaid, for appointments"]].map(([k, l, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${e.bal[k]} h</div><div class="s">${(e.bal[k] / 8).toFixed(1)} days · ${s}</div></div>`).join("")}</div>
  <div class="grid g-main mt"><div class="card">${calendarHTML(ui.toMonth, (x) => x.prop === e.prop && x.dept === e.dept)}</div>
  <div class="card"><h2>My requests</h2><div class="list">${mine.map((t) => `<div class="li"><div class="grow"><b>${typeName[t.type]} · ${fmtDs(t.from)}${t.to !== t.from ? " – " + fmtDs(t.to) : ""}</b><small>${t.hours} h${t.note ? " · " + esc(t.note) : ""}</small></div>${stPill(t.status)}${t.status === "pending" ? `<button class="btn sm" data-act="cancel-to" data-id="${t.id}">Cancel</button>` : ""}</div>`).join("") || `<div class="empty">No requests yet.</div>`}</div></div></div>`;
}
ACT["cancel-to"] = (b) => { const t = S().timeoff.find((x) => x.id === b.dataset.id); t.status = "cancelled"; log(`Cancelled a time-off request for ${fmtDs(t.from)}`); refresh(); toast("Request cancelled"); };
ACT["req-to"] = () => {
  const e = me(), T = today();
  modal({
    title: "Request time off",
    body: `<div class="fields"><div class="field full"><label>Type</label><select id="to-t"><option value="vac">Vacation (${e.bal.vac} h left)</option><option value="sick">Sick (${e.bal.sick} h left)</option><option value="per">Personal (${e.bal.per} h left)</option></select></div>
      <div class="field"><label>From</label><input type="date" id="to-f" value="${addDays(T, 7)}" min="${T}"></div><div class="field"><label>To</label><input type="date" id="to-e" value="${addDays(T, 7)}" min="${T}"></div>
      <div class="field"><label>Hours per day</label><input type="number" id="to-h" value="8" min="1" max="12"></div>
      <div class="field full"><label>Note for your manager</label><input type="text" id="to-n" maxlength="140"></div></div><div id="to-i" class="mt"></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="to-ok">Send request</button>`,
    onMount: (m) => {
      const upd = () => {
        const f = $("#to-f", m).value, t = $("#to-e", m).value, k = $("#to-t", m).value, hpd = Number($("#to-h", m).value) || 8;
        if (!f || !t || t < f) { $("#to-i", m).innerHTML = `<div class="banner warn">The end date must be on or after the start date.</div>`; return; }
        const hours = workdays(f, t) * hpd;
        const sh = S().shifts.filter((s) => s.emp === e.id && s.date >= f && s.date <= t).length;
        const over = hours > e.bal[k];
        $("#to-i", m).innerHTML = `<div class="banner ${over ? "warn" : "info"}" style="display:block">${hours} hours over ${workdays(f, t)} day${workdays(f, t) > 1 ? "s" : ""}.${sh ? ` You have ${sh} shift${sh > 1 ? "s" : ""} then; ${sh > 1 ? "they" : "it"} will be offered to co-workers if approved.` : ""}${over ? `<br><b>This is more than your balance.</b> Your manager can still approve it as unpaid.` : ""}</div>`;
      };
      $$("input,select", m).forEach((x) => x.addEventListener("input", upd)); upd();
      $("[data-x2]", m).onclick = closeModal;
      $("#to-ok", m).onclick = () => {
        const f = $("#to-f", m).value, t = $("#to-e", m).value;
        if (!f || !t || t < f) return toast("Check the dates");
        const r = { id: uid("t"), emp: e.id, type: $("#to-t", m).value, from: f, to: t, hours: workdays(f, t) * (Number($("#to-h", m).value) || 8), status: "pending", note: $("#to-n", m).value.trim(), created: today(), decidedBy: null };
        S().timeoff.push(r); log(`Requested ${typeName[r.type].toLowerCase()} ${fmtDs(f)}–${fmtDs(t)}`); closeModal(); refresh(); toast("Request sent to your manager");
      };
    },
  });
};

function timeoffManager(v) {
  const p = pending();
  const scoped = activeEmps().filter((e) => inScope(e.prop) && e.status === "active");
  const liab = scoped.reduce((a, e) => a + e.bal.vac * A.rate(e), 0);
  const upcoming = S().timeoff.filter((t) => t.status === "approved" && t.to >= today() && inScope(E(t.emp).prop)).sort((a, b) => a.from.localeCompare(b.from));
  v.innerHTML = `<div class="ph"><div><h1>Time off</h1><p>Requests, the team calendar and balances.</p></div><button class="btn" data-act="bal-csv">Export balances</button></div>
  <div class="grid g4 keep2"><div class="kpi ${p.to.length ? "alert" : ""}"><div class="l">Waiting for you</div><div class="v">${p.to.length}</div></div><div class="kpi"><div class="l">Off today</div><div class="v">${upcoming.filter((t) => t.from <= today()).length}</div></div><div class="kpi"><div class="l">Approved, upcoming</div><div class="v">${upcoming.filter((t) => t.from > today()).length}</div></div><div class="kpi"><div class="l">Vacation liability</div><div class="v">${m0(liab)}</div><div class="s">Unused vacation hours × pay rate</div></div></div>
  <div class="grid g-main mt"><div class="card">${calendarHTML(ui.toMonth, (x) => inScope(x.prop) && (ui.dept === "all" || x.dept === ui.dept))}</div>
  <div class="stack"><div class="card"><h2>Requests to decide</h2>${p.to.length ? `<div class="list">${p.to.map((t) => toCard(t)).join("")}</div>` : `<div class="empty">Nothing waiting.</div>`}</div>
  <div class="card"><h2>Coming up</h2><div class="list">${upcoming.slice(0, 6).map((t) => `<div class="li">${av(E(t.emp), "sm")}<div class="grow"><b>${esc(nmId(t.emp))}</b><small>${typeName[t.type]} · ${fmtDs(t.from)}${t.to !== t.from ? "–" + fmtDs(t.to) : ""}</small></div></div>`).join("") || `<div class="empty">Nobody.</div>`}</div></div></div></div>`;
}
function toCard(t) {
  const e = E(t.emp);
  const sh = S().shifts.filter((s) => s.emp === e.id && s.date >= t.from && s.date <= t.to).length;
  const others = S().timeoff.filter((x) => x.id !== t.id && x.status === "approved" && E(x.emp).dept === e.dept && E(x.emp).prop === e.prop && x.from <= t.to && x.to >= t.from).length;
  const over = t.type !== "per" && t.hours > e.bal[t.type];
  return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))} · ${typeName[t.type]}</b><small>${fmtD(t.from)}${t.to !== t.from ? " – " + fmtD(t.to) : ""} · ${t.hours} h</small><small style="white-space:normal">${t.note ? "“" + esc(t.note) + "” · " : ""}${sh} shift${sh === 1 ? "" : "s"} to cover · ${others ? `<b style="color:var(--warn)">${others} other${others > 1 ? "s" : ""} in ${esc(dept(e.dept).name)} off</b>` : "no one else off"}${over ? ` · <b style="color:var(--bad)">over balance (${e.bal[t.type]} h)</b>` : ""}</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="to" data-id="${t.id}">Approve</button><button class="btn sm danger" data-act="deny" data-k="to" data-id="${t.id}">Deny</button></div></div>`;
}
ACT["bal-csv"] = () => { const rows = [["Employee #", "Name", "Hotel", "Department", "Vacation h", "Sick h", "Personal h", "Vacation liability $"]]; activeEmps().filter((e) => inScope(e.prop)).forEach((e) => rows.push([e.no, nm(e), prop(e.prop).short, dept(e.dept).name, e.bal.vac, e.bal.sick, e.bal.per, (e.bal.vac * A.rate(e)).toFixed(2)])); csv("time-off-balances.csv", rows); };

// ---------- Approvals ----------
function decide(k, id, ok) {
  const by = S().me.emp;
  if (k === "to") {
    const t = S().timeoff.find((x) => x.id === id); const e = E(t.emp);
    t.status = ok ? "approved" : "denied"; t.decidedBy = by;
    if (ok) {
      if (t.type !== "per") e.bal[t.type] = Math.max(0, e.bal[t.type] - t.hours);
      let n = 0; S().shifts.forEach((s) => { if (s.emp === e.id && s.date >= t.from && s.date <= t.to && s.date >= today()) { s.emp = null; n++; } });
      log(`Approved ${nm(e)}'s ${typeName[t.type].toLowerCase()} ${fmtDs(t.from)}–${fmtDs(t.to)}${n ? `; ${n} shifts posted as open` : ""}`);
      return n ? `Approved. ${n} shift${n > 1 ? "s are" : " is"} now open for others.` : "Approved";
    }
    log(`Denied ${nm(e)}'s ${typeName[t.type].toLowerCase()} request`); return "Request denied";
  }
  if (k === "sw") {
    const w = S().swaps.find((x) => x.id === id); const s = S().shifts.find((x) => x.id === w.shift);
    w.status = ok ? "approved" : "denied";
    if (ok && s) { if (w.type === "drop") s.emp = null; else s.emp = w.to; if (w.type === "pickup") S().swaps.filter((x) => x.shift === s.id && x.id !== w.id && x.status === "pending").forEach((x) => (x.status = "denied")); }
    log(`${ok ? "Approved" : "Denied"} ${w.type} of the ${s ? fmtD(s.date) : ""} shift`); return ok ? "Shift updated" : "Request denied";
  }
  const c = S().corrections.find((x) => x.id === id);
  c.status = ok ? "approved" : "denied";
  if (ok) { const p = S().punches.find((x) => x.id === c.punch); if (p) { p[c.field] = c.to; p.edited = true; p.note = `Fix approved by ${nm(me())}: ${c.reason}`; } delete S().tsApproved[A.tsKey(c.emp, periodStart(c.date))]; }
  log(`${ok ? "Approved" : "Denied"} ${nmId(c.emp)}'s punch fix for ${fmtD(c.date)}`); return ok ? "Punch corrected" : "Request denied";
}
ACT.appr = (b) => { const m = decide(b.dataset.k, b.dataset.id, true); refresh(); toast(m); };
ACT.deny = (b) => { const m = decide(b.dataset.k, b.dataset.id, false); refresh(); toast(m); };

VIEWS.approvals = (v) => {
  const p = pending(), tab = ui.apprTab;
  const tabs = [["all", "All", p.n], ["to", "Time off", p.to.length], ["sw", "Shift changes", p.sw.length], ["co", "Punch fixes", p.co.length]];
  const swCard = (w) => { const s = S().shifts.find((x) => x.id === w.shift); const e = E(w.type === "pickup" ? w.to : w.from); const warn = s && w.to ? A.shiftWarnings({ ...s, emp: w.to }) : [];
    return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))} · ${w.type === "swap" ? "Swap with " + esc(nmId(w.to)) : w.type === "pickup" ? "Pick up an open shift" : "Give away a shift"}</b><small>${s ? `${fmtD(s.date)} · ${fmtT(s.start)}–${fmtT(s.end)} · ${esc(posName(s.pos))}` : "Shift removed"}${w.note ? " · “" + esc(w.note) + "”" : ""}</small>${warn.length ? `<small style="color:var(--warn);white-space:normal">⚠️ ${esc(warn.join(". "))}</small>` : ""}</div><div class="act"><button class="btn sm good" data-act="appr" data-k="sw" data-id="${w.id}">Approve</button><button class="btn sm danger" data-act="deny" data-k="sw" data-id="${w.id}">Deny</button></div></div>`; };
  const coCard = (c) => { const e = E(c.emp); const pu = S().punches.find((x) => x.id === c.punch);
    return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${av(e, "sm")}<div class="grow"><b>${esc(nm(e))} · Punch fix</b><small>${fmtD(c.date)} · clock ${c.field} ${c.from ? fmtT(c.from) : "missing"} → <b>${fmtT(c.to)}</b>${pu ? ` · punched in ${fmtT(pu.in)}` : ""}</small><small style="white-space:normal">“${esc(c.reason)}”</small></div><div class="act"><button class="btn sm good" data-act="appr" data-k="co" data-id="${c.id}">Approve</button><button class="btn sm danger" data-act="deny" data-k="co" data-id="${c.id}">Deny</button></div></div>`; };
  const sect = (t, list, f) => list.length ? `<div class="card"><h2>${t}</h2><div class="list">${list.map(f).join("")}</div></div>` : "";
  const recent = [...S().timeoff, ...S().swaps, ...S().corrections].filter((x) => x.status === "approved" || x.status === "denied").length;
  v.innerHTML = `<div class="ph"><div><h1>Approvals</h1><p>Everything waiting for a decision at ${esc(scope() === "all" ? "all hotels" : prop(scope()).short)}. Employees see the result right away.</p></div></div>
    <div class="tabs" style="margin-top:0">${tabs.map(([k, l, n]) => `<button data-act="atab" data-t="${k}" class="${tab === k ? "on" : ""}">${l} ${n ? `<span class="pill warn">${n}</span>` : ""}</button>`).join("")}</div>
    <div class="stack">${(tab === "all" || tab === "to") ? sect("Time off", p.to, toCard) : ""}${(tab === "all" || tab === "sw") ? sect("Shift swaps and pick-ups", p.sw, swCard) : ""}${(tab === "all" || tab === "co") ? sect("Punch corrections", p.co, coCard) : ""}
    ${(tab === "all" ? p.n : tab === "to" ? p.to.length : tab === "sw" ? p.sw.length : p.co.length) ? "" : `<div class="card empty">🎉 You're all caught up. ${recent} decisions made so far.</div>`}</div>`;
};
ACT.atab = (b) => { ui.apprTab = b.dataset.t; A.render(); };

// ---------- People ----------
VIEWS.people = (v, args) => {
  if (args && args[0]) return VIEWS.person(v, args);
  const q = ui.peopleQ.toLowerCase();
  const list = S().emps.filter((e) => inScope(e.prop) && (ui.peopleDept === "all" || e.dept === ui.peopleDept) && (ui.peopleStatus === "all" || e.status === ui.peopleStatus) && (!q || (nm(e) + " " + posName(e.pos) + " " + e.no).toLowerCase().includes(q)))
    .sort((a, b) => a.last.localeCompare(b.last));
  const all = S().emps.filter((e) => inScope(e.prop) && e.status !== "terminated");
  v.innerHTML = `<div class="ph"><div><h1>People</h1><p>${all.length} people at ${esc(scope() === "all" ? "all hotels" : prop(scope()).short)} · ${all.filter((e) => e.type === "FT").length} full time · ${all.filter((e) => e.type === "PT").length} part time</p></div>
    <div class="toolbar"><button class="btn primary" data-act="new-emp">+ Add new hire</button><button class="btn" data-act="ppl-csv">Export</button></div></div>
  <div class="card"><div class="toolbar" style="margin-bottom:12px"><input type="search" id="pq" placeholder="Search name, job or number" value="${esc(ui.peopleQ)}" style="flex:1;min-width:180px">
    <select id="pd" aria-label="Department"><option value="all">All departments</option>${S().depts.map((d) => `<option value="${d.id}" ${ui.peopleDept === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
    <select id="pst" aria-label="Status">${[["active", "Active"], ["onboarding", "Onboarding"], ["terminated", "Former"], ["all", "Everyone"]].map(([k, l]) => `<option value="${k}" ${ui.peopleStatus === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="tw"><table><thead><tr><th>Name</th><th class="hide-sm">Department</th><th class="hide-sm">Hotel</th><th class="hide-sm">Type</th><th class="hide-sm">Hired</th><th>Status</th></tr></thead><tbody>
  ${list.map((e) => `<tr class="click" data-act="open-person" data-id="${e.id}"><td><div style="display:flex;gap:10px;align-items:center">${av(e)}<span><b>${esc(nm(e))}</b><br><small>${esc(posName(e.pos))} · #${e.no}</small></span></div></td><td class="hide-sm"><span class="dot" style="background:${dept(e.dept).color}"></span>${esc(dept(e.dept).name)}</td><td class="hide-sm">${esc(prop(e.prop).short)}</td><td class="hide-sm">${e.type === "FT" ? "Full time" : "Part time"}</td><td class="hide-sm nowrap">${fmtDY(e.hire)}</td><td>${statusPill(e)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No one matches.</td></tr>`}
  </tbody></table></div></div>`;
  const rerender = () => { A.render(); const x = $("#pq"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
  $("#pq").oninput = (e) => { ui.peopleQ = e.target.value; clearTimeout(ui._p); ui._p = setTimeout(rerender, 250); };
  $("#pd").onchange = (e) => { ui.peopleDept = e.target.value; A.render(); };
  $("#pst").onchange = (e) => { ui.peopleStatus = e.target.value; A.render(); };
};
const statusPill = (e) => `<span class="pill ${e.status === "active" ? "good" : e.status === "onboarding" ? "info" : ""}">${e.status === "active" ? "Active" : e.status === "onboarding" ? "Onboarding" : "Former"}</span>`;
ACT["open-person"] = (b) => { if (!isMgr()) return; closeModal(); go("#/people/" + b.dataset.id); };
ACT["ppl-csv"] = () => { const rows = [["Employee #", "First", "Last", "Hotel", "Department", "Position", "Type", "Pay type", "Rate", "Hire date", "Status", "Email", "Phone"]]; S().emps.filter((e) => inScope(e.prop)).forEach((e) => rows.push([e.no, e.first, e.last, prop(e.prop).short, dept(e.dept).name, posName(e.pos), e.type, e.pay, e.wage, e.hire, e.status, e.email, e.phone])); csv("people.csv", rows); };

VIEWS.person = (v, args) => {
  const e = E(args[0]); if (!e) { v.innerHTML = `<div class="empty">Not found. <a href="#/people">Back to people</a></div>`; return; }
  const self = role() === "employee";
  const tab = ui.pTab || "overview";
  const T = today();
  const yrs = (diffDays(e.hire, T) / 365.25);
  const up = S().shifts.filter((s) => s.emp === e.id && s.date >= T && s.date <= addDays(T, 13)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const ps = periodStart(T);
  const pay = payFor(S(), e, ps);
  const exc = A.periodExc(e.id, ps);
  const tabs = [["overview", "Overview"], ["job", "Job and pay"], ["time", "Time off"], ["certs", "Certifications"], ["sched", "Schedule"]];
  const body = {
    overview: `<div class="grid g2"><div class="card"><h3>Contact</h3><dl class="kv"><dt>Email</dt><dd>${esc(e.email)}</dd><dt>Phone</dt><dd>${esc(e.phone)}</dd><dt>Address</dt><dd>${esc(e.address || "Not provided")}</dd><dt>Birthday</dt><dd>${MON[Number(e.birthday.slice(0, 2)) - 1]} ${Number(e.birthday.slice(3))}</dd></dl></div>
      <div class="card"><h3>Emergency contact</h3><dl class="kv"><dt>Name</dt><dd>${esc(e.emergency.name || "Not provided")}</dd><dt>Relationship</dt><dd>${esc(e.emergency.rel || "–")}</dd><dt>Phone</dt><dd>${esc(e.emergency.phone || "–")}</dd></dl></div>
      <div class="card"><h3>This pay period</h3><dl class="kv"><dt>Hours worked</dt><dd>${h1(pay.reg + pay.ot + pay.hol)}</dd><dt>Overtime</dt><dd>${h1(pay.ot)}</dd><dt>Exceptions</dt><dd>${exc.length ? exc.map((x) => `<span class="pill ${x.cls}">${fmtDs(x.d)} ${esc(x.t)}</span>`).join(" ") : "None"}</dd></dl>${isMgr() ? `<button class="btn sm mt" data-act="ts-open" data-id="${e.id}">Open timesheet</button>` : ""}</div>
      <div class="card"><h3>Availability</h3><dl class="kv">${DOW.map((d, i) => `<dt>${d}</dt><dd>${{ any: "Any time", am: "Mornings", pm: "Evenings", off: "Not available" }[e.avail[i]]}</dd>`).join("")}</dl>${self ? `<button class="btn sm mt" data-act="avail">Change</button>` : ""}</div></div>`,
    job: `<div class="grid g2"><div class="card"><h3>Job</h3><dl class="kv"><dt>Position</dt><dd>${esc(posName(e.pos))}</dd><dt>Department</dt><dd>${esc(dept(e.dept).name)}</dd><dt>Hotel</dt><dd>${esc(prop(e.prop).name)}</dd><dt>Employment</dt><dd>${e.type === "FT" ? "Full time" : "Part time"}${e.union ? " · unionized" : ""}</dd><dt>Hire date</dt><dd>${fmtDY(e.hire)} (${yrs >= 1 ? yrs.toFixed(1) + " years" : Math.max(0, Math.round(yrs * 12)) + " months"})</dd><dt>Employee #</dt><dd>${e.no}</dd>${isMgr() ? `<dt>Time clock PIN</dt><dd>${e.pin}</dd>` : ""}</dl></div>
      <div class="card"><h3>Pay</h3><dl class="kv"><dt>Pay type</dt><dd>${e.pay === "salary" ? "Salary" : "Hourly"}</dd><dt>Rate</dt><dd>${e.pay === "salary" ? money(e.wage, 0) + " a year" : money(e.wage) + " an hour"}</dd><dt>Pay frequency</dt><dd>Every two weeks</dd><dt>Overtime</dt><dd>${e.pay === "salary" ? "Exempt (manager)" : `After ${S().settings.otWeekly} h a week at 1.5×`}</dd>${e.type === "PT" ? `<dt>Vacation pay</dt><dd>${S().settings.vacPayPct}% on each cheque</dd>` : ""}<dt>Benefits</dt><dd>${e.type === "FT" ? "Health and dental" : "Not eligible"}</dd></dl></div></div>`,
    time: `<div class="grid g3">${[["vac", "Vacation"], ["sick", "Sick"], ["per", "Personal"]].map(([k, l]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${e.bal[k]} h</div></div>`).join("")}</div>
      <div class="card mt"><h3>History</h3><div class="list">${S().timeoff.filter((t) => t.emp === e.id).sort((a, b) => b.from.localeCompare(a.from)).map((t) => `<div class="li"><div class="grow"><b>${typeName[t.type]} · ${fmtDs(t.from)}${t.to !== t.from ? " – " + fmtDs(t.to) : ""}</b><small>${t.hours} h${t.note ? " · " + esc(t.note) : ""}</small></div>${stPill(t.status)}</div>`).join("") || `<div class="empty">No time off yet.</div>`}</div>${isMgr() ? `<button class="btn sm mt" data-act="adj-bal" data-id="${e.id}">Adjust balances</button>` : ""}</div>`,
    certs: `<div class="card"><div class="card-h"><h3>Certifications and training</h3>${isMgr() ? `<button class="btn sm" data-act="add-cert" data-id="${e.id}">+ Add</button>` : ""}</div><div class="tw"><table><thead><tr><th>Name</th><th>Expires</th><th>Status</th></tr></thead><tbody>${e.certs.map((c) => { const dd = diffDays(T, c.exp); return `<tr><td>${esc(c.name)}</td><td>${fmtDY(c.exp)}</td><td><span class="pill ${dd < 0 ? "bad" : dd < 45 ? "warn" : "good"}">${dd < 0 ? "Expired" : dd < 45 ? "Due in " + dd + " days" : "Valid"}</span></td></tr>`; }).join("") || `<tr><td colspan="3" class="empty">None on file.</td></tr>`}</tbody></table></div></div>`,
    sched: `<div class="card"><h3>Next two weeks</h3><div class="list">${up.map((s) => `<div class="li"><div class="grow"><b>${fmtD(s.date)} · ${fmtT(s.start)}–${fmtT(s.end)}</b><small>${esc(posName(s.pos))} · ${h1(shiftMin(s))}</small></div></div>`).join("") || `<div class="empty">No upcoming shifts.</div>`}</div></div>`,
  };
  v.innerHTML = `${self ? "" : `<p style="margin:0 0 10px"><a href="#/people">← People</a></p>`}
  <div class="card"><div class="prof-head">${av(e, "lg")}<div class="grow"><h1 style="margin:0">${esc(nm(e))}</h1><div class="muted">${esc(posName(e.pos))} · ${esc(dept(e.dept).name)} · ${esc(prop(e.prop).short)}</div><div style="margin-top:6px">${statusPill(e)} <span class="pill">${e.type === "FT" ? "Full time" : "Part time"}</span></div></div>
    <div class="toolbar">${self ? `<button class="btn" data-act="edit-emp" data-id="${e.id}">Edit my details</button>` : `<button class="btn" data-act="edit-emp" data-id="${e.id}">Edit</button>${e.status !== "terminated" ? `<button class="btn" data-act="change-pay" data-id="${e.id}">Change job or pay</button><button class="btn danger" data-act="term" data-id="${e.id}">End employment</button>` : `<button class="btn" data-act="rehire" data-id="${e.id}">Rehire</button>`}`}</div></div>
  <div class="tabs">${tabs.map(([k, l]) => `<button data-act="ptab" data-t="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
  ${body[tab]}</div>`;
};
ACT.ptab = (b) => { ui.pTab = b.dataset.t; A.render(); };
ACT["edit-emp"] = (b) => {
  const e = E(b.dataset.id), self = role() === "employee";
  modal({
    title: self ? "Edit my details" : "Edit " + esc(nm(e)),
    body: `<div class="fields">${self ? "" : `<div class="field"><label>First name</label><input type="text" id="ee-f" value="${esc(e.first)}"></div><div class="field"><label>Last name</label><input type="text" id="ee-l" value="${esc(e.last)}"></div>`}
      <div class="field"><label>Email</label><input type="email" id="ee-e" value="${esc(e.email)}"></div><div class="field"><label>Phone</label><input type="tel" id="ee-p" value="${esc(e.phone)}"></div>
      <div class="field full"><label>Address</label><input type="text" id="ee-a" value="${esc(e.address)}"></div>
      <div class="field"><label>Emergency contact</label><input type="text" id="ee-en" value="${esc(e.emergency.name)}"></div><div class="field"><label>Relationship</label><input type="text" id="ee-er" value="${esc(e.emergency.rel)}"></div><div class="field"><label>Their phone</label><input type="tel" id="ee-ep" value="${esc(e.emergency.phone)}"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="ee-ok">Save</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#ee-ok", m).onclick = () => {
      if (!self) { e.first = $("#ee-f", m).value.trim() || e.first; e.last = $("#ee-l", m).value.trim() || e.last; }
      e.email = $("#ee-e", m).value.trim(); e.phone = $("#ee-p", m).value.trim(); e.address = $("#ee-a", m).value.trim();
      e.emergency = { name: $("#ee-en", m).value.trim(), rel: $("#ee-er", m).value.trim(), phone: $("#ee-ep", m).value.trim() };
      log(`Updated personal details for ${nm(e)}`); closeModal(); refresh(); toast("Saved"); }; },
  });
};
ACT["change-pay"] = (b) => {
  const e = E(b.dataset.id);
  modal({
    title: "Change job or pay",
    body: `<div class="fields"><div class="field"><label>Hotel</label><select id="cp-h">${S().props.map((p) => `<option value="${p.id}" ${p.id === e.prop ? "selected" : ""}>${esc(p.short)}</option>`).join("")}</select></div>
      <div class="field"><label>Position</label><select id="cp-p">${Object.entries(POS).map(([k, p]) => `<option value="${k}" ${k === e.pos ? "selected" : ""}>${esc(p.name)} (${esc(dept(p.dept).name)})</option>`).join("")}</select></div>
      <div class="field"><label>Employment</label><select id="cp-t"><option value="FT" ${e.type === "FT" ? "selected" : ""}>Full time</option><option value="PT" ${e.type === "PT" ? "selected" : ""}>Part time</option></select></div>
      <div class="field"><label>Pay type</label><select id="cp-pt"><option value="hourly" ${e.pay === "hourly" ? "selected" : ""}>Hourly</option><option value="salary" ${e.pay === "salary" ? "selected" : ""}>Salary</option></select></div>
      <div class="field"><label id="cp-rl">${e.pay === "salary" ? "Annual salary" : "Hourly rate"}</label><input type="number" id="cp-r" step="0.25" min="0" value="${e.wage}"></div>
      <div class="field"><label>Effective</label><input type="date" id="cp-d" value="${today()}"></div></div><div id="cp-i" class="mt"></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="cp-ok">Save change</button>`,
    onMount: (m) => {
      const upd = () => { $("#cp-rl", m).textContent = $("#cp-pt", m).value === "salary" ? "Annual salary" : "Hourly rate"; const r = Number($("#cp-r", m).value); const ch = e.pay === $("#cp-pt", m).value && e.wage ? (r / e.wage - 1) * 100 : null; $("#cp-i", m).innerHTML = ch != null && Math.abs(ch) > 0.01 ? `<div class="banner ${ch > 15 ? "warn" : "info"}">That is a ${ch > 0 ? "raise" : "cut"} of ${Math.abs(ch).toFixed(1)}%.${ch > 15 ? " Raises over 15% need a second approval in production." : ""}</div>` : ""; };
      $$("input,select", m).forEach((x) => x.addEventListener("input", upd)); upd();
      $("[data-x2]", m).onclick = closeModal;
      $("#cp-ok", m).onclick = () => {
        const old = `${posName(e.pos)}, ${e.pay === "salary" ? money(e.wage, 0) : money(e.wage) + "/h"}`;
        e.prop = $("#cp-h", m).value; e.pos = $("#cp-p", m).value; e.dept = POS[e.pos].dept; e.type = $("#cp-t", m).value; e.pay = $("#cp-pt", m).value; e.wage = Number($("#cp-r", m).value) || e.wage; e.maxShifts = e.type === "FT" ? 5 : 3;
        log(`Changed ${nm(e)} from ${old} to ${posName(e.pos)}, ${e.pay === "salary" ? money(e.wage, 0) : money(e.wage) + "/h"} effective ${fmtDs($("#cp-d", m).value)}`); closeModal(); refresh(); toast("Job and pay updated");
      };
    },
  });
};
ACT.term = (b) => {
  const e = E(b.dataset.id);
  modal({
    title: "End employment for " + esc(nm(e)),
    body: `<div class="fields"><div class="field"><label>Last day worked</label><input type="date" id="tm-d" value="${today()}"></div><div class="field"><label>Reason</label><select id="tm-r"><option>Resigned</option><option>End of seasonal contract</option><option>Dismissed</option><option>Retired</option></select></div></div>
      <div class="banner warn mt" style="display:block">Future shifts become open shifts. A full system would also create the Record of Employment and pay out ${e.bal.vac} h of vacation (${money(e.bal.vac * A.rate(e))}).</div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn danger" id="tm-ok">End employment</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#tm-ok", m).onclick = () => {
      const d = $("#tm-d", m).value || today(); e.status = "terminated"; e.termDate = d; e.termReason = $("#tm-r", m).value;
      let n = 0; S().shifts.forEach((s) => { if (s.emp === e.id && s.date > d) { s.emp = null; n++; } });
      log(`Ended employment for ${nm(e)} (${e.termReason}); ${n} shifts posted as open`); closeModal(); refresh(); toast(`Done. ${n} shifts are now open.`); }; },
  });
};
ACT.rehire = (b) => { const e = E(b.dataset.id); e.status = "active"; delete e.termDate; log(`Rehired ${nm(e)}`); refresh(); toast("Rehired"); };
ACT["add-cert"] = (b) => {
  const e = E(b.dataset.id);
  modal({ title: "Add a certification", body: `<div class="fields"><div class="field full"><label>Name</label><input type="text" id="ac-n" list="ac-l"><datalist id="ac-l"><option>Smart Serve</option><option>Food Handler Certificate</option><option>Standard First Aid & CPR</option><option>WHMIS training</option><option>Working at heights</option><option>Cash handling</option></datalist></div><div class="field"><label>Expires</label><input type="date" id="ac-d" value="${addDays(today(), 365 * 3)}"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="ac-ok">Add</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#ac-ok", m).onclick = () => { const n = $("#ac-n", m).value.trim(); if (!n) return toast("Enter a name"); e.certs.push({ name: n, exp: $("#ac-d", m).value }); log(`Added ${n} for ${nm(e)}`); closeModal(); refresh(); }; } });
};
ACT["adj-bal"] = (b) => {
  const e = E(b.dataset.id);
  modal({ title: "Adjust balances", body: `<div class="fields">${[["vac", "Vacation"], ["sick", "Sick"], ["per", "Personal"]].map(([k, l]) => `<div class="field"><label>${l} (hours)</label><input type="number" id="ab-${k}" value="${e.bal[k]}" min="0"></div>`).join("")}<div class="field full"><label>Reason</label><input type="text" id="ab-r" placeholder="e.g. Carry-over approved by GM"></div></div>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="ab-ok">Save</button>`,
    onMount: (m) => { $("[data-x2]", m).onclick = closeModal; $("#ab-ok", m).onclick = () => { ["vac", "sick", "per"].forEach((k) => (e.bal[k] = Math.max(0, Number($("#ab-" + k, m).value) || 0))); log(`Adjusted ${nm(e)}'s balances: ${$("#ab-r", m).value || "no reason given"}`); closeModal(); refresh(); toast("Balances updated"); }; } });
};

// New hire
ACT["new-emp"] = () => {
  const T = today();
  modal({
    title: "Add a new hire",
    body: `<div class="fields"><div class="field"><label>First name</label><input type="text" id="nh-f"></div><div class="field"><label>Last name</label><input type="text" id="nh-l"></div>
      <div class="field"><label>Hotel</label><select id="nh-h">${S().props.filter((p) => inScope(p.id)).map((p) => `<option value="${p.id}">${esc(p.short)}</option>`).join("")}</select></div>
      <div class="field"><label>Position</label><select id="nh-p">${Object.entries(POS).filter(([, p]) => p.wage).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Employment</label><select id="nh-t"><option value="FT">Full time</option><option value="PT">Part time</option></select></div>
      <div class="field"><label>Hourly rate</label><input type="number" id="nh-r" step="0.25"></div>
      <div class="field"><label>Start date</label><input type="date" id="nh-d" value="${addDays(T, 14)}"></div>
      <div class="field"><label>Personal email</label><input type="email" id="nh-e" placeholder="for the welcome email"></div></div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Saving creates the profile, a time-clock PIN and an onboarding checklist. In production the new hire gets an email to fill in their own forms.</p>`,
    foot: `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="nh-ok">Create and start onboarding</button>`,
    onMount: (m) => {
      const setR = () => ($("#nh-r", m).value = POS[$("#nh-p", m).value].wage); setR();
      $("#nh-p", m).onchange = setR;
      $("[data-x2]", m).onclick = closeModal;
      $("#nh-ok", m).onclick = () => {
        const f = $("#nh-f", m).value.trim(), l = $("#nh-l", m).value.trim();
        if (!f || !l) return toast("Enter a first and last name");
        const pos = $("#nh-p", m).value, no = Math.max(...S().emps.map((x) => x.no)) + 1;
        const e = { id: "e" + no, no, first: f, last: l, prop: $("#nh-h", m).value, dept: POS[pos].dept, pos, type: $("#nh-t", m).value, pay: "hourly", wage: Number($("#nh-r", m).value) || POS[pos].wage, hire: $("#nh-d", m).value || addDays(T, 14), status: "onboarding",
          birthday: "01-01", email: $("#nh-e", m).value.trim() || `${f}.${l}`.toLowerCase().replace(/[^a-z.]/g, "") + "@maplelake.example", phone: "", pin: String(1000 + ((no * 7919) % 9000)).slice(0, 4), maxShifts: $("#nh-t", m).value === "FT" ? 5 : 3, avail: [0, 1, 2, 3, 4, 5, 6].map(() => "any"),
          bal: { vac: 0, sick: 0, per: 0 }, certs: [], emergency: { name: "", rel: "", phone: "" }, address: "", union: false };
        S().emps.push(e);
        S().onboarding[e.id] = { started: T, tasks: onboardingTasks(e) };
        log(`Added new hire ${nm(e)} as ${posName(pos)}`); closeModal(); save(); go("#/onboarding"); toast(`${f} added. Onboarding has started.`);
      };
    },
  });
};
function onboardingTasks(e) {
  const t = ["Offer letter signed", "Personal details and SIN", "TD1 federal and Ontario tax forms", "Direct deposit details", "Emergency contact", "Uniform and name badge issued", "Locker and key card", "PMS and email accounts created", "Health and safety awareness training", "WHMIS training", "Department orientation shift", "Buddy assigned", "30-day check-in"];
  if (e.dept === "fb") t.splice(9, 0, "Smart Serve uploaded"); if (e.dept === "kt") t.splice(9, 0, "Food Handler Certificate uploaded");
  return t.map((x) => ({ t: x, done: false, owner: /letter|PMS|Uniform|Locker|Buddy|check-in|orientation/.test(x) ? "Manager" : /SIN|TD1|Direct|Emergency|uploaded/.test(x) ? "Employee" : "HR" }));
}

// ---------- Onboarding ----------
VIEWS.onboarding = (v) => {
  const list = S().emps.filter((e) => e.status === "onboarding" && inScope(e.prop) && S().onboarding[e.id]);
  const recent = S().emps.filter((e) => e.status === "active" && inScope(e.prop) && S().onboarding[e.id]);
  const card = (e) => { const ob = S().onboarding[e.id]; const done = ob.tasks.filter((t) => t.done).length; const n = ob.tasks.length; const dd = diffDays(today(), e.hire);
    return `<div class="card" style="cursor:pointer" data-act="ob-open" data-id="${e.id}"><div style="display:flex;gap:12px;align-items:center">${av(e)}<div style="flex:1;min-width:0"><b>${esc(nm(e))}</b><div class="muted" style="font-size:13px">${esc(posName(e.pos))} · ${esc(prop(e.prop).short)}</div></div><span class="pill ${dd < 0 ? "warn" : "info"}">${dd > 0 ? "Starts in " + dd + " days" : dd === 0 ? "Starts today" : "Started " + fmtDs(e.hire)}</span></div>
      <div class="bar" style="margin-top:14px"><i class="${done === n ? "good" : ""}" style="width:${(done / n) * 100}%"></i></div><div class="muted" style="font-size:12.5px;margin-top:6px">${done} of ${n} steps done${done < n ? ` · next: ${esc(ob.tasks.find((t) => !t.done).t)}` : " · ready to activate"}</div></div>`; };
  v.innerHTML = `<div class="ph"><div><h1>Onboarding</h1><p>New hires and their checklists. HR, the manager and the new hire each own their steps.</p></div><button class="btn primary" data-act="new-emp">+ Add new hire</button></div>
    ${list.length ? `<div class="grid g3">${list.map(card).join("")}</div>` : `<div class="card empty">No one is onboarding right now.</div>`}
    ${recent.length ? `<h2 class="mt">Recently completed</h2><div class="grid g3">${recent.map(card).join("")}</div>` : ""}`;
};
ACT["ob-open"] = (b) => {
  const e = E(b.dataset.id), ob = S().onboarding[e.id];
  const draw = (m) => {
    const done = ob.tasks.filter((t) => t.done).length;
    $(".mb", m).innerHTML = `<p class="muted">${esc(posName(e.pos))} · ${esc(prop(e.prop).short)} · starts ${fmtDY(e.hire)}</p><div class="bar"><i class="${done === ob.tasks.length ? "good" : ""}" style="width:${(done / ob.tasks.length) * 100}%"></i></div>
      ${["HR", "Manager", "Employee"].map((o) => `<h3 class="mt">${o === "Employee" ? "New hire" : o}</h3>${ob.tasks.map((t, i) => (t.owner === o ? `<label class="chk" style="display:flex;padding:6px 0"><input type="checkbox" data-i="${i}" ${t.done ? "checked" : ""}> <span ${t.done ? 'style="text-decoration:line-through;color:var(--ink-3)"' : ""}>${esc(t.t)}</span></label>` : "")).join("")}`).join("")}`;
    $$("input[type=checkbox]", m).forEach((c) => (c.onchange = () => { ob.tasks[c.dataset.i].done = c.checked; log(`${c.checked ? "Completed" : "Reopened"} "${ob.tasks[c.dataset.i].t}" for ${nm(e)}`); save(); draw(m); }));
    const btn = $("#ob-act", m); if (btn) btn.disabled = e.status !== "onboarding" || done < ob.tasks.length;
  };
  modal({ title: "Onboarding · " + esc(nm(e)), body: "", foot: `<button class="btn" data-x2>Close</button>${e.status === "onboarding" ? `<button class="btn good" id="ob-act">Mark as active employee</button>` : ""}`,
    onMount: (m) => { draw(m); A.setModalClose(() => A.render()); $("[data-x2]", m).onclick = closeModal;
      const btn = $("#ob-act", m); if (btn) btn.onclick = () => { e.status = "active"; e.bal = { vac: 0, sick: 24, per: 8 }; log(`Activated ${nm(e)} after onboarding`); closeModal(); toast(`${e.first} is now active and can be scheduled`); }; } });
};

// ---------- Reports ----------
const RANGES = { wk: "This week", lwk: "Last week", pp: "This pay period", lpp: "Last pay period", d28: "Last 28 days" };
function range(k) {
  const T = today(), ws = weekStart(T), ps = periodStart(T);
  return { wk: [ws, addDays(ws, 6)], lwk: [addDays(ws, -7), addDays(ws, -1)], pp: [ps, addDays(ps, 13)], lpp: [addDays(ps, -14), addDays(ps, -1)], d28: [addDays(T, -27), T] }[k];
}
VIEWS.reports = (v) => {
  const [from, to] = range(ui.repRange), T = today(), pid = scope();
  const props = S().props.filter((p) => inScope(p.id));
  const emps = activeEmps().filter((e) => inScope(e.prop));
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  // Actual cost for past days, scheduled for future days
  const dayActual = (d, filter = () => true) => {
    if (d < T) return S().punches.filter((c) => c.date === d && filter(E(c.emp))).reduce((a, c) => { const e = E(c.emp); return a + (punchMin(c) / 60) * A.rate(e); }, 0);
    return S().shifts.filter((s) => s.date === d && s.emp && filter(E(s.emp))).reduce((a, s) => a + shiftCost(s), 0);
  };
  const inP = (e) => e && inScope(e.prop);
  const sched = days.map((d) => S().shifts.filter((s) => s.date === d && inScope(s.prop)).reduce((a, s) => a + shiftCost(s), 0));
  const actual = days.map((d) => dayActual(d, inP));
  const budget = days.map((d) => props.reduce((a, p) => a + (S().budget[p.id][d] || 0), 0));
  const occRooms = days.map((d) => props.reduce((a, p) => a + p.rooms * (S().forecast[p.id][d] || 0), 0));
  const cpor = actual.map((x, i) => x / Math.max(1, occRooms[i]));
  const byDept = S().depts.map((dp) => ({ dp, cost: days.reduce((a, d) => a + dayActual(d, (e) => inP(e) && e.dept === dp.id), 0), hrs: days.reduce((a, d) => a + (d < T ? S().punches.filter((c) => c.date === d && inP(E(c.emp)) && E(c.emp).dept === dp.id).reduce((b, c) => b + punchMin(c), 0) : S().shifts.filter((s) => s.date === d && s.emp && inScope(s.prop) && s.dept === dp.id).reduce((b, s) => b + shiftMin(s), 0)), 0) }));
  // Overtime by person (weeks fully inside the range)
  const ot = emps.filter((e) => e.pay === "hourly").map((e) => {
    let m = 0; for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) { const wm = S().punches.filter((c) => c.emp === e.id && c.date >= ws && c.date <= addDays(ws, 6) && !HOLIDAYS[c.date]).reduce((a, c) => a + punchMin(c), 0); m += Math.max(0, wm - S().settings.otWeekly * 60); }
    return { e, m, cost: (m / 60) * e.wage * 1.5 };
  }).filter((x) => x.m > 0).sort((a, b) => b.m - a.m);
  const excBy = S().depts.map((dp) => { const c = { late: 0, missed: 0, noshow: 0, nobreak: 0, early: 0, unsched: 0 }; emps.filter((e) => e.dept === dp.id).forEach((e) => days.forEach((d) => { if (d < T) exceptionsFor(e.id, d).forEach((x) => c[x.k]++); })); return { dp, c }; });
  const head = S().depts.map((dp) => ({ dp, ft: emps.filter((e) => e.dept === dp.id && e.type === "FT" && e.status === "active").length, pt: emps.filter((e) => e.dept === dp.id && e.type === "PT" && e.status === "active").length, ob: emps.filter((e) => e.dept === dp.id && e.status === "onboarding").length }));
  const terms = S().emps.filter((e) => e.status === "terminated" && inScope(e.prop)).length;
  const totAct = actual.reduce((a, b) => a + b, 0), totBud = budget.reduce((a, b) => a + b, 0);
  const totHrs = byDept.reduce((a, b) => a + b.hrs, 0);
  const totOcc = occRooms.reduce((a, b) => a + b, 0);
  v.innerHTML = `<div class="ph"><div><h1>Reports</h1><p>${esc(pid === "all" ? "All hotels" : prop(pid).name)} · ${fmtDs(from)} – ${fmtDY(to)}. Past days use actual punches; future days use the schedule.</p></div>
    <div class="toolbar"><select id="rr" aria-label="Date range">${Object.entries(RANGES).map(([k, l]) => `<option value="${k}" ${ui.repRange === k ? "selected" : ""}>${l}</option>`).join("")}</select><button class="btn" onclick="window.print()">Print</button></div></div>
  <div class="grid g4 keep2">
    <div class="kpi ${totAct > totBud ? "alert" : "ok"}"><div class="l">Labour cost vs budget</div><div class="v">${m0(totAct)}</div><div class="s">Budget ${m0(totBud)} · ${totAct > totBud ? "+" : "−"}${pct(Math.abs(totAct / Math.max(1, totBud) - 1), 1)}</div></div>
    <div class="kpi"><div class="l">Labour hours</div><div class="v">${Math.round(totHrs / 60).toLocaleString("en-CA")}</div><div class="s">${(totHrs / 60 / Math.max(1, totOcc)).toFixed(2)} h per occupied room</div></div>
    <div class="kpi"><div class="l">Cost per occupied room</div><div class="v">${money(totAct / Math.max(1, totOcc))}</div><div class="s">Target ${money(props.reduce((a, p) => a + S().settings.cpor[p.id] * p.rooms, 0) / props.reduce((a, p) => a + p.rooms, 0))}</div></div>
    <div class="kpi ${ot.length ? "alert" : ""}"><div class="l">Overtime cost</div><div class="v">${m0(ot.reduce((a, x) => a + x.cost, 0))}</div><div class="s">${ot.length} people · ${h1(ot.reduce((a, x) => a + x.m, 0))}</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><div class="card-h"><h2>Labour cost by day</h2><button class="btn sm" data-act="rep-csv" data-r="daily">CSV</button></div><div class="chart"><canvas id="r1"></canvas></div></div>
    <div class="card"><div class="card-h"><h2>Cost per occupied room</h2><span class="muted" style="font-size:13px">Lower is better</span></div><div class="chart"><canvas id="r2"></canvas></div></div>
    <div class="card"><div class="card-h"><h2>Cost and hours by department</h2><button class="btn sm" data-act="rep-csv" data-r="dept">CSV</button></div><div class="chart sm"><canvas id="r3"></canvas></div>
      <div class="tw"><table><thead><tr><th>Department</th><th class="n">Hours</th><th class="n">Cost</th><th class="n">Share</th></tr></thead><tbody>${byDept.filter((x) => x.hrs).map((x) => `<tr><td><span class="dot" style="background:${x.dp.color}"></span>${esc(x.dp.name)}</td><td class="n">${Math.round(x.hrs / 60)}</td><td class="n">${m0(x.cost)}</td><td class="n">${pct(x.cost / Math.max(1, totAct))}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h2>Attendance exceptions</h2><button class="btn sm" data-act="rep-csv" data-r="exc">CSV</button></div><div class="chart sm"><canvas id="r4"></canvas></div>
      <p class="muted" style="font-size:13px;margin:10px 0 0">Late means more than ${S().settings.graceMin} minutes after the shift start.</p></div>
    <div class="card"><div class="card-h"><h2>Overtime by person</h2><button class="btn sm" data-act="rep-csv" data-r="ot">CSV</button></div>
      <div class="tw"><table><thead><tr><th>Employee</th><th class="hide-sm">Department</th><th class="n">OT hours</th><th class="n">OT cost</th></tr></thead><tbody>${ot.slice(0, 10).map((x) => `<tr class="click" data-act="open-person" data-id="${x.e.id}"><td>${esc(nm(x.e))}<br><small>${esc(prop(x.e.prop).short)}</small></td><td class="hide-sm">${esc(dept(x.e.dept).name)}</td><td class="n">${(x.m / 60).toFixed(1)}</td><td class="n">${money(x.cost)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No overtime in this range.</td></tr>`}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h2>Headcount</h2><button class="btn sm" data-act="rep-csv" data-r="head">CSV</button></div>
      <div class="tw"><table><thead><tr><th>Department</th><th class="n">Full time</th><th class="n">Part time</th><th class="n">Onboarding</th></tr></thead><tbody>${head.map((x) => `<tr><td><span class="dot" style="background:${x.dp.color}"></span>${esc(x.dp.name)}</td><td class="n">${x.ft}</td><td class="n">${x.pt}</td><td class="n">${x.ob || "–"}</td></tr>`).join("")}</tbody><tfoot><tr><td>Total</td><td class="n">${head.reduce((a, x) => a + x.ft, 0)}</td><td class="n">${head.reduce((a, x) => a + x.pt, 0)}</td><td class="n">${head.reduce((a, x) => a + x.ob, 0)}</td></tr></tfoot></table></div>
      <p class="muted" style="font-size:13px;margin:10px 0 0">${terms} former employee${terms === 1 ? "" : "s"} on file.</p></div>
  </div>`;
  $("#rr").onchange = (e) => { ui.repRange = e.target.value; A.render(); };
  const labels = days.map((d) => (days.length > 14 ? fmtDs(d) : DOW[dow(d)] + " " + d.slice(8)));
  const money0 = { ticks: { callback: (x) => "$" + (x >= 1000 ? (x / 1000).toFixed(1) + "k" : x) }, grid: { color: "#eef1f4" } };
  chart($("#r1"), { type: "bar", data: { labels, datasets: [{ label: "Actual (past) / scheduled (future)", data: actual.map(Math.round), backgroundColor: days.map((d) => (d < T ? "#2a78d6" : "#9cc3ee")), borderRadius: 4, order: 2 }, { label: "Budget", type: "line", data: budget, borderColor: "#eb6834", pointRadius: 2, tension: 0.25, order: 1 }] }, options: { scales: { y: money0, x: { grid: { display: false } } } } });
  chart($("#r2"), { type: "line", data: { labels, datasets: [{ label: "Cost per occupied room", data: cpor.map((x) => Math.round(x * 100) / 100), borderColor: "#1f4e79", backgroundColor: "rgba(42,120,214,.12)", fill: true, tension: 0.3, pointRadius: 2 }, { label: "Target", data: days.map(() => props.reduce((a, p) => a + S().settings.cpor[p.id] * p.rooms, 0) / props.reduce((a, p) => a + p.rooms, 0)), borderColor: "#1baf7a", borderDash: [5, 4], pointRadius: 0 }] }, options: { scales: { y: { ticks: { callback: (x) => "$" + x }, grid: { color: "#eef1f4" } }, x: { grid: { display: false } } } } });
  const bd = byDept.filter((x) => x.hrs);
  chart($("#r3"), { type: "bar", data: { labels: bd.map((x) => x.dp.name), datasets: [{ label: "Cost", data: bd.map((x) => Math.round(x.cost)), backgroundColor: bd.map((x) => x.dp.color), borderRadius: 4 }] }, options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: money0, y: { grid: { display: false } } } } });
  const ek = [["late", "Late", "#eda100"], ["missed", "Missed punch", "#b42318"], ["noshow", "No-show", "#7a1d14"], ["nobreak", "No meal break", "#8b5cf6"], ["early", "Left early", "#2a78d6"]];
  chart($("#r4"), { type: "bar", data: { labels: excBy.map((x) => x.dp.name), datasets: ek.map(([k, l, c]) => ({ label: l, data: excBy.map((x) => x.c[k]), backgroundColor: c, borderRadius: 3 })) }, options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 }, grid: { color: "#eef1f4" } } } } });
  A._rep = { days, sched, actual, budget, occRooms, byDept, ot, excBy, head };
};
ACT["rep-csv"] = (b) => {
  const r = A._rep; const k = b.dataset.r;
  if (k === "daily") csv("labour-by-day.csv", [["Date", "Actual or scheduled cost", "Scheduled cost", "Budget", "Occupied rooms (forecast)", "Cost per occupied room"], ...r.days.map((d, i) => [d, r.actual[i].toFixed(2), r.sched[i].toFixed(2), r.budget[i], r.occRooms[i].toFixed(0), (r.actual[i] / Math.max(1, r.occRooms[i])).toFixed(2)])]);
  if (k === "dept") csv("labour-by-department.csv", [["Department", "Hours", "Cost"], ...r.byDept.map((x) => [x.dp.name, (x.hrs / 60).toFixed(1), x.cost.toFixed(2)])]);
  if (k === "ot") csv("overtime.csv", [["Employee #", "Name", "Hotel", "Department", "OT hours", "OT cost"], ...r.ot.map((x) => [x.e.no, nm(x.e), prop(x.e.prop).short, dept(x.e.dept).name, (x.m / 60).toFixed(2), x.cost.toFixed(2)])]);
  if (k === "exc") csv("attendance-exceptions.csv", [["Department", "Late", "Missed punch", "No-show", "No meal break", "Left early", "Unscheduled"], ...r.excBy.map((x) => [x.dp.name, x.c.late, x.c.missed, x.c.noshow, x.c.nobreak, x.c.early, x.c.unsched])]);
  if (k === "head") csv("headcount.csv", [["Department", "Full time", "Part time", "Onboarding"], ...r.head.map((x) => [x.dp.name, x.ft, x.pt, x.ob])]);
};

// ---------- Settings ----------
VIEWS.settings = (v) => {
  const st = S().settings, hr = role() === "hr";
  v.innerHTML = `<div class="ph"><div><h1>Settings</h1><p>Pay rules, hotels and the audit trail.${hr ? "" : " Pay rules can be changed by HR."}</p></div></div>
  <div class="grid g2">
    <div class="card"><h2>Pay and attendance rules</h2><div class="fields mt">
      <div class="field"><label>Weekly overtime after (hours)</label><input type="number" id="st-ot" value="${st.otWeekly}" min="35" max="60" ${hr ? "" : "disabled"}><small>Ontario's default is 44</small></div>
      <div class="field"><label>Late after (minutes)</label><input type="number" id="st-g" value="${st.graceMin}" min="0" max="30" ${hr ? "" : "disabled"}></div>
      <div class="field"><label>Meal break required after (hours)</label><input type="number" id="st-b" value="${st.breakAfterHrs}" min="3" max="8" ${hr ? "" : "disabled"}></div>
      <div class="field"><label>Part-time vacation pay (%)</label><input type="number" id="st-v" value="${st.vacPayPct}" min="4" max="10" step="0.5" ${hr ? "" : "disabled"}></div>
      ${S().props.map((p) => `<div class="field"><label>${esc(p.short)} labour target per occupied room ($)</label><input type="number" data-cpor="${p.id}" value="${st.cpor[p.id]}" min="10" max="120" ${hr ? "" : "disabled"}></div>`).join("")}
    </div>${hr ? `<button class="btn primary mt" data-act="st-save">Save rules</button>` : ""}</div>
    <div class="card"><h2>Hotels</h2><div class="tw"><table><thead><tr><th>Hotel</th><th class="n">Rooms</th><th class="n">Staff</th></tr></thead><tbody>${S().props.map((p) => `<tr><td>${esc(p.name)}<br><small>${esc(p.city)}, Ontario</small></td><td class="n">${p.rooms}</td><td class="n">${activeEmps().filter((e) => e.prop === p.id).length}</td></tr>`).join("")}</tbody></table></div>
      <h3 class="mt">Demo data</h3><p class="muted" style="font-size:13.5px">Everything is stored only in this browser. Reset to start again with a fresh, current sample.</p>
      <div class="toolbar"><button class="btn danger" data-act="reset">Reset demo data</button><button class="btn" data-act="export-json">Download all data (JSON)</button></div></div>
    <div class="card" style="grid-column:1/-1"><div class="card-h"><h2>Audit trail</h2><span class="muted" style="font-size:13px">Every change, who made it and when</span></div>
      <div class="tw" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${S().audit.slice(0, 150).map((a) => `<tr><td class="nowrap">${new Date(a.at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td class="nowrap">${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card" style="grid-column:1/-1"><h2>About this demo</h2>
      <p>This is a working prototype of a hotel workforce system: scheduling with labour budgets, a time clock and kiosk, timesheets with exception handling, a bi-weekly payroll preview, time off, people records, onboarding, approvals and reports, for managers, employees and HR. It runs entirely in the browser on fictional data.</p>
      <p style="margin:0"><b>For a production version:</b> a server and database with single sign-on and role-based access per hotel; CRA payroll tables and a bank deposit file; Record of Employment and T4 slips; geofenced mobile punches and wall-mounted kiosks; push and SMS notifications; integration with the PMS for live occupancy forecasts; union rules and seniority; and full audit logging and backups.</p></div>
  </div>`;
};
ACT["st-save"] = () => {
  const st = S().settings;
  st.otWeekly = Number($("#st-ot").value) || 44; st.graceMin = Number($("#st-g").value) || 0; st.breakAfterHrs = Number($("#st-b").value) || 5; st.vacPayPct = Number($("#st-v").value) || 4;
  $$("[data-cpor]").forEach((i) => (st.cpor[i.dataset.cpor] = Number(i.value) || st.cpor[i.dataset.cpor]));
  S().props.forEach((p) => Object.keys(S().forecast[p.id]).forEach((d) => (S().budget[p.id][d] = Math.round(p.rooms * S().forecast[p.id][d] * st.cpor[p.id]))));
  log("Changed pay and attendance rules"); refresh(); toast("Rules saved. Pay and budgets are recalculated.");
};
ACT.reset = () => confirmBox("Reset demo data?", "This replaces everything in this browser with a fresh sample company. Your changes will be lost.", "Reset", A.resetDemo, true);
ACT["export-json"] = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S(), null, 1)], { type: "application/json" })); a.download = "workforce-demo-data.json"; document.body.appendChild(a); a.click(); a.remove(); };

A.render();
})();
