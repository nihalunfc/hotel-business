// Hotel Operations Hub views: guest requests, inspections, logbook, lost & found, inventory, reports, team.
"use strict";

/* ================= Guest requests and incidents ================= */
const reqOf = id => H().requests.find(r => r.id === id);
const OPEN_REQ = ["New", "Acknowledged", "In progress"];
const REQ_SLA = { Request: 30, Complaint: 60, Incident: 120, Compliment: 1440 }; // minutes to resolve
function reqTimer(r) {
  if (!OPEN_REQ.includes(r.status)) return r.resolvedAt ? `Resolved in ${dur(r.resolvedAt - r.createdAt)}` : "";
  const age = Date.now() - r.createdAt;
  const late = r.status === "New" ? age > 10 * MIN : age > REQ_SLA[r.type] * MIN;
  return `<b style="color:${late ? "var(--bad)" : "var(--warn)"}">${r.status === "New" ? "Waiting" : "Open"} ${dur(age)}</b>`;
}
function reqList() {
  const f = U.f, st = f.rqStatus || "open";
  return H().requests.filter(r => (st === "all" || (st === "open" ? OPEN_REQ.includes(r.status) : st === "incidents" ? r.type === "Incident" : !OPEN_REQ.includes(r.status))) &&
    (!f.rqType || r.type === f.rqType) && (!f.rqDept || r.dept === f.rqDept) &&
    (!f.rqText || [r.id, r.title, r.guest, r.room, r.category].join(" ").toLowerCase().includes(f.rqText.toLowerCase())));
}
VIEWS.requests = function () {
  const h = H(), f = U.f, now = Date.now(), st = f.rqStatus || "open";
  const all = h.requests, d7 = all.filter(r => r.createdAt > now - 7 * DAY);
  const acked = d7.filter(r => r.ackAt), res = d7.filter(r => r.resolvedAt);
  const sat = all.filter(r => r.satisfaction && r.createdAt > now - 14 * DAY);
  const list = reqList(), lim = U.limit.rq || 50;
  return `<div class="kpis">
      <a class="kpi ${all.filter(r => r.status === "New").length ? "alert" : ""}" href="#/requests" data-act="seg" data-k="rqStatus" data-v="open"><div class="label">Open now</div><div class="value">${all.filter(r => OPEN_REQ.includes(r.status)).length}</div><div class="sub">${all.filter(r => r.status === "New").length} not acknowledged</div></a>
      <div class="kpi"><div class="label">Avg time to acknowledge</div><div class="value">${acked.length ? dur(acked.reduce((s, r) => s + r.ackAt - r.createdAt, 0) / acked.length) : "–"}</div><div class="sub">last 7 days · target 10 min</div></div>
      <div class="kpi"><div class="label">Avg time to resolve</div><div class="value">${res.length ? dur(res.reduce((s, r) => s + r.resolvedAt - r.createdAt, 0) / res.length) : "–"}</div><div class="sub">last 7 days</div></div>
      <div class="kpi"><div class="label">Complaints, 7 days</div><div class="value">${d7.filter(r => r.type === "Complaint").length}</div><div class="sub">${d7.filter(r => r.type === "Incident").length} incidents · ${d7.filter(r => r.type === "Compliment").length} compliments</div></div>
      <div class="kpi"><div class="label">Guest follow-up score</div><div class="value">${sat.length ? (sat.reduce((s, r) => s + r.satisfaction, 0) / sat.length).toFixed(1) + " / 5" : "–"}</div><div class="sub">${sat.length} follow-up calls, 14 days</div></div>
    </div>
    <div class="filters"><div class="seg">${[["open", "Open"], ["done", "Resolved & closed"], ["incidents", "Incidents"], ["all", "All"]].map(([k, l]) => `<button class="${st === k ? "active" : ""}" data-act="seg" data-k="rqStatus" data-v="${k}">${l}</button>`).join("")}</div></div>
    <div class="filters">
      <input type="search" data-f="rqText" placeholder="Filter by guest, room or ID" value="${esc(f.rqText || "")}" style="width:220px">
      <select data-f="rqType"><option value="">All types</option>${opt(Object.keys(D.REQ_TYPES), f.rqType)}</select>
      <select data-f="rqDept"><option value="">All departments</option>${opt(D.DEPTS, f.rqDept)}</select>
      <span style="flex:1"></span>
      <button class="btn" data-act="rq-csv">⬇ CSV</button>
      <button class="btn primary" data-act="rq-new">＋ Request or incident</button>
    </div>
    <div class="rows">${list.slice(0, lim).map(r => `<div class="row" data-act="nav" data-href="#/requests/${r.id}"><div><div class="t"><span class="id">${r.id}</span>${esc(r.title)}</div>
      <div class="m"><span>🚪 Room ${esc(r.room)}</span><span>${esc(r.guest)}</span><span>${esc(r.dept)}</span><span>👤 ${esc(sname(r.assignee))}</span><span>${esc(when(r.createdAt))}</span><span>${reqTimer(r)}</span></div></div>
      <div class="r">${chip(r.type, TYPE_CHIP[r.type])}${chip(r.status, REQ_CHIP[r.status])}</div></div>`).join("") || `<div class="empty">No guest requests match these filters.</div>`}
      ${list.length > lim ? `<div class="more-row"><button class="btn sm" data-act="more" data-k="rq">Show more (${list.length - lim} left)</button></div>` : ""}</div>`;
};
ACT["rq-new"] = () => openReqForm();
ACT["rq-csv"] = () => csvDownload(`guest-requests-${S.hotel}.csv`, [["ID", "Type", "Category", "Title", "Guest", "Room", "Department", "Status", "Assigned to", "Created", "Acknowledged (min)", "Resolved (min)", "Recovery", "Recovery cost", "Follow-up score"],
  ...reqList().map(r => [r.id, r.type, r.category, r.title, r.guest, r.room, r.dept, r.status, sname(r.assignee), new Date(r.createdAt).toISOString(), r.ackAt ? Math.round((r.ackAt - r.createdAt) / MIN) : "", r.resolvedAt ? Math.round((r.resolvedAt - r.createdAt) / MIN) : "", r.recovery, r.recoveryCost, r.satisfaction || ""])]);
function deptFor(type, category) {
  if (category === "Maintenance") return "Engineering";
  if (["Amenity", "Housekeeping", "Cleanliness"].includes(category)) return "Housekeeping";
  if (["Front Office", "Billing", "Wi-Fi"].includes(category)) return "Front Office";
  return D.REQ_TYPES[type].dept;
}
function openReqForm(pre = {}) {
  const h = H();
  const cats = [...new Set(Object.values(D.REQ_TYPES).flatMap(t => t.items.map(i => i[0])))];
  modal({ title: "New guest request or incident", wide: true, body: `<div class="form" id="rq-form">
      <div class="f full"><label>Type</label><div class="seg" id="rq-type">${Object.keys(D.REQ_TYPES).map(t => `<button type="button" data-v="${t}" class="${(pre.type || "Request") === t ? "active" : ""}">${t}</button>`).join("")}</div></div>
      <div class="f full"><label>What does the guest need? *</label><input type="text" name="title" id="rq-title" list="rq-titles" value="${esc(pre.title || "")}" placeholder="e.g. Extra towels"><datalist id="rq-titles"></datalist></div>
      <div class="f"><label>Room *</label><input type="text" name="room" value="${esc(pre.room || "")}" list="rq-rooms" inputmode="numeric"><datalist id="rq-rooms">${h.rooms.map(r => `<option value="${r.no}">`).join("")}</datalist></div>
      <div class="f"><label>Guest name</label><input type="text" name="guest" placeholder="Last name, first initial"></div>
      <div class="f"><label>Category</label><select name="category" id="rq-cat">${opt(cats, pre.category || "Amenity")}</select></div>
      <div class="f"><label>Department</label><select name="dept" id="rq-dept">${opt(D.DEPTS, pre.dept || "Housekeeping")}</select></div>
      <div class="f"><label>Priority</label><select name="priority">${opt(D.PRIORITIES, "Normal")}</select></div>
      <div class="f"><label>Assign to</label><select name="assignee" id="rq-as"></select></div>
      <div class="f full"><label>Details</label><textarea name="desc" placeholder="Anything the team should know"></textarea></div>
      <div id="rq-inc" class="f full" style="display:none"><div class="form">
        <div class="f"><label>Severity</label><select name="severity">${opt(["Low", "Moderate", "High"], "Moderate")}</select></div>
        <div class="f"><label>Witnesses</label><input type="text" name="witnesses"></div>
        <div class="f check"><input type="checkbox" name="injury" id="rq-inj"><label for="rq-inj" style="font-weight:500">Someone was injured</label></div>
        <div class="f check"><input type="checkbox" name="police" id="rq-pol"><label for="rq-pol" style="font-weight:500">Police or EMS called</label></div></div></div>
      <div class="f full check"><input type="checkbox" name="mkwo" id="rq-wo"><label for="rq-wo" style="font-weight:500">Also create a maintenance work order</label></div>
    </div>`, foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="rq-go">Log it</button>` });
  const box = modalEl();
  let type = pre.type || "Request";
  const sync = () => {
    box.querySelector("#rq-titles").innerHTML = D.REQ_TYPES[type].items.map(i => `<option value="${esc(i[1])}">`).join("");
    box.querySelector("#rq-inc").style.display = type === "Incident" ? "" : "none";
    const dept = box.querySelector("#rq-dept").value;
    box.querySelector("#rq-as").innerHTML = staffOpts(null, s => s.dept === dept, "Department queue");
    box.querySelector("#rq-wo").checked = box.querySelector("#rq-wo").checked || dept === "Engineering";
  };
  box.querySelectorAll("#rq-type button").forEach(b => b.onclick = () => { type = b.dataset.v; box.querySelectorAll("#rq-type button").forEach(x => x.classList.toggle("active", x === b)); sync(); });
  box.querySelector("#rq-title").onchange = e => { const it = Object.entries(D.REQ_TYPES).flatMap(([t, v]) => v.items.map(i => [t, ...i])).find(i => i[2] === e.target.value); if (it) { box.querySelector("#rq-cat").value = it[1]; box.querySelector("#rq-dept").value = deptFor(it[0], it[1]); sync(); } };
  box.querySelector("#rq-cat").onchange = e => { box.querySelector("#rq-dept").value = deptFor(type, e.target.value); sync(); };
  box.querySelector("#rq-dept").onchange = sync;
  sync();
  box.querySelector("#rq-go").onclick = () => {
    const v = readForm(box.querySelector("#rq-form"));
    if (!v.title || !v.room) { toast("Please add what the guest needs and the room."); return; }
    const now = Date.now(), id = nextId("GR");
    const r = { id, type, category: v.category, title: v.title, guest: v.guest || "Guest", room: v.room, dept: v.dept, priority: type === "Incident" || type === "Complaint" ? (v.priority === "Normal" ? "High" : v.priority) : v.priority,
      status: "New", assignee: v.assignee || null, createdBy: me().id, createdAt: now, ackAt: null, resolvedAt: null, recovery: "None", recoveryCost: 0, satisfaction: null, desc: v.desc, notes: [{ t: now, by: me().id, text: "Logged" + (v.assignee ? ", assigned to " + sname(v.assignee) : "") }], woId: null };
    if (type === "Incident") Object.assign(r, { severity: v.severity, injury: v.injury, policeReport: v.police, witnesses: v.witnesses });
    H().requests.unshift(r);
    logActivity(`logged ${type.toLowerCase()} ${id} for room ${r.room}: ${r.title}`, "#/requests/" + id);
    touch(); closeModal(true);
    if (v.mkwo) openWOForm({ title: r.title, location: r.room, priority: "High", source: "Guest request", reqId: id, desc: `Guest request ${id}${r.desc ? ": " + r.desc : ""}` });
    render(); toast(`${id} logged${r.assignee ? " and sent to " + sname(r.assignee) : " to the " + r.dept + " queue"}`);
  };
}
OPENERS.requests = id => openReq(id);
function openReq(id) {
  const r = reqOf(id);
  if (!r) { toast(id + " not found."); return; }
  const manage = can("reqManage") || r.assignee === me().id || r.dept === me().dept;
  let actions = "";
  if (manage) {
    if (r.status === "New") actions = `<button class="btn primary" data-act="rq-st" data-id="${r.id}" data-st="Acknowledged">👍 Acknowledge</button>`;
    else if (r.status === "Acknowledged") actions = `<button class="btn primary" data-act="rq-st" data-id="${r.id}" data-st="In progress">▶ Start</button><button class="btn good" data-act="rq-resolve" data-id="${r.id}">✓ Resolve</button>`;
    else if (r.status === "In progress") actions = `<button class="btn good" data-act="rq-resolve" data-id="${r.id}">✓ Resolve</button>`;
    else if (r.status === "Resolved") actions = `<button class="btn" data-act="rq-st" data-id="${r.id}" data-st="In progress">↺ Reopen</button><button class="btn primary" data-act="rq-close" data-id="${r.id}">📞 Follow up and close</button>`;
    else actions = `<button class="btn" data-act="rq-st" data-id="${r.id}" data-st="In progress">↺ Reopen</button>`;
  }
  recordModal("requests", { title: `<span class="id" style="font-family:'JetBrains Mono',monospace;color:var(--ink-3);font-size:14px">${r.id}</span> ${esc(r.title)}`, wide: true,
    body: `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${chip(r.type, TYPE_CHIP[r.type])}${chip(r.status, REQ_CHIP[r.status])}${priChip(r.priority)}<span style="font-size:13px">${reqTimer(r)}</span></div>
      <dl class="kv"><dt>Guest</dt><dd>${esc(r.guest)} · <a href="#/housekeeping/${r.room}" data-act="nav" data-href="#/housekeeping/${r.room}">Room ${esc(r.room)}</a></dd>
        <dt>Category</dt><dd>${esc(r.category)} · ${esc(r.dept)}</dd>
        <dt>Assigned to</dt><dd>${manage ? `<select id="rq-assign" style="width:auto">${staffOpts(r.assignee, s => s.dept === r.dept || s.role === "gm", "Department queue")}</select>` : esc(sname(r.assignee))}</dd>
        <dt>Logged</dt><dd>${esc(when(r.createdAt))} by ${esc(sname(r.createdBy))}</dd>
        ${r.ackAt ? `<dt>Acknowledged</dt><dd>${esc(when(r.ackAt))} (${dur(r.ackAt - r.createdAt)})</dd>` : ""}
        ${r.resolvedAt ? `<dt>Resolved</dt><dd>${esc(when(r.resolvedAt))} (${dur(r.resolvedAt - r.createdAt)} total)</dd>` : ""}
        ${r.recovery && r.recovery !== "None" ? `<dt>Service recovery</dt><dd>${esc(r.recovery)}${r.recoveryCost ? " · " + money(r.recoveryCost) : ""}</dd>` : ""}
        ${r.satisfaction ? `<dt>Follow-up</dt><dd>${"★".repeat(r.satisfaction)}${"☆".repeat(5 - r.satisfaction)}</dd>` : ""}
        ${r.type === "Incident" ? `<dt>Severity</dt><dd>${esc(r.severity || "–")}</dd><dt>Injury</dt><dd>${r.injury ? "Yes" : "No"}</dd><dt>Police or EMS</dt><dd>${r.policeReport ? "Yes" : "No"}</dd><dt>Witnesses</dt><dd>${esc(r.witnesses || "None recorded")}</dd>` : ""}
        ${r.woId ? `<dt>Work order</dt><dd><a href="#/workorders/${r.woId}" data-act="nav" data-href="#/workorders/${r.woId}">${r.woId}</a> ${(woOf(r.woId) ? chip(woOf(r.woId).status, WO_CHIP[woOf(r.woId).status]) : "")}</dd>` : ""}
      </dl>${r.desc ? `<p style="white-space:pre-wrap">${esc(r.desc)}</p>` : ""}
      <h3 style="font-size:14px">Activity</h3><ul class="feed">${r.notes.slice().reverse().map(n => `<li>${avatar(n.by)}<div><div><b>${esc(n.by ? sname(n.by) : "System")}</b> ${esc(n.text)}</div><div class="w">${esc(when(n.t))}</div></div></li>`).join("")}</ul>
      <div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="rq-note" placeholder="Add a note" style="flex:1"><button class="btn" data-act="rq-note" data-id="${r.id}">Add</button></div>`,
    foot: `${r.type === "Incident" ? `<button class="btn" data-act="rq-print" data-id="${r.id}">🖨️ Incident report</button>` : ""}${!r.woId && role().mods.includes("workorders") ? `<button class="btn" data-act="rq-wo" data-id="${r.id}">🔧 Work order</button>` : ""}<span class="grow"></span>${actions}` });
  const sel = modalEl().querySelector("#rq-assign");
  if (sel) sel.onchange = () => { r.assignee = sel.value || null; r.notes.push({ t: Date.now(), by: me().id, text: r.assignee ? "Assigned to " + sname(r.assignee) : "Returned to queue" }); touch(); openReq(r.id); render(); };
  modalEl().querySelector("#rq-note").addEventListener("keydown", e => { if (e.key === "Enter") ACT["rq-note"]({ dataset: { id: r.id } }); });
}
function setReqStatus(r, st, text) {
  const now = Date.now();
  if (st === "Acknowledged" && !r.ackAt) { r.ackAt = now; if (!r.assignee) r.assignee = me().id; }
  if (st === "In progress" && !r.ackAt) r.ackAt = now;
  if (st === "In progress") r.resolvedAt = null;
  r.status = st;
  r.notes.push({ t: now, by: me().id, text: text || st });
  logActivity(`${st.toLowerCase()} ${r.id}: ${r.title}`, "#/requests/" + r.id);
}
ACT["rq-st"] = el => { const r = reqOf(el.dataset.id); setReqStatus(r, el.dataset.st); touch(); openReq(r.id); render(); };
ACT["rq-note"] = el => { const r = reqOf(el.dataset.id), i = document.getElementById("rq-note"); if (!i.value.trim()) return; r.notes.push({ t: Date.now(), by: me().id, text: i.value.trim() }); touch(); openReq(r.id); };
ACT["rq-wo"] = el => { const r = reqOf(el.dataset.id); closeModal(true); openWOForm({ title: r.title, location: r.room, priority: "High", source: "Guest request", reqId: r.id, desc: "Guest request " + r.id }); };
ACT["rq-resolve"] = el => {
  const r = reqOf(el.dataset.id);
  modal({ title: `Resolve ${r.id}`, body: `<div class="form">
      <div class="f"><label>Service recovery</label><select id="rr-rec">${opt(D.RECOVERY, r.type === "Complaint" ? "Apology" : "None")}</select></div>
      <div class="f"><label>Cost ($)</label><input type="number" id="rr-cost" min="0" value="0"></div>
      <div class="f full"><label>How was it resolved?</label><textarea id="rr-note" placeholder="e.g. Delivered 4 towels, guest happy"></textarea></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn good" id="rr-go">✓ Resolve</button>` });
  modalEl().querySelector("#rr-go").onclick = () => {
    r.recovery = document.getElementById("rr-rec").value; r.recoveryCost = +document.getElementById("rr-cost").value || 0;
    const n = document.getElementById("rr-note").value.trim();
    if (!r.ackAt) r.ackAt = Date.now();
    r.resolvedAt = Date.now();
    setReqStatus(r, "Resolved", "Resolved" + (n ? ": " + n : "") + (r.recovery !== "None" ? ` (${r.recovery})` : ""));
    touch(); closeModal(true); openReq(r.id); render(); toast(`${r.id} resolved in ${dur(r.resolvedAt - r.createdAt)}`);
  };
};
ACT["rq-close"] = el => {
  const r = reqOf(el.dataset.id);
  modal({ title: `Follow up with ${esc(r.guest)}`, body: `<p>Call or message the guest to check they are happy, then record how they rated it.</p>
      <div class="filters" id="rc-stars">${[1, 2, 3, 4, 5].map(n => `<button class="btn" data-v="${n}">${"★".repeat(n)}</button>`).join("")}</div><p class="muted" style="font-size:13px">Or close without a rating.</p>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn" id="rc-skip">Close without rating</button>` });
  const fin = v => { r.satisfaction = v; setReqStatus(r, "Closed", v ? `Guest follow-up: ${v} of 5` : "Closed"); touch(); closeModal(true); openReq(r.id); render(); };
  modalEl().querySelectorAll("#rc-stars button").forEach(b => b.onclick = () => fin(+b.dataset.v));
  modalEl().querySelector("#rc-skip").onclick = () => fin(null);
};
ACT["rq-print"] = el => {
  const r = reqOf(el.dataset.id);
  printDoc("Incident " + r.id, `<h1>Incident report ${r.id}</h1><p class="muted">${esc(hotelInfo().name)}</p><table><tbody>
    <tr><th>What happened</th><td>${esc(r.title)}</td></tr><tr><th>Category</th><td>${esc(r.category)}</td></tr><tr><th>Severity</th><td>${esc(r.severity || "")}</td></tr>
    <tr><th>Guest</th><td>${esc(r.guest)}, room ${esc(r.room)}</td></tr><tr><th>Date and time</th><td>${esc(when(r.createdAt))}</td></tr><tr><th>Reported by</th><td>${esc(sname(r.createdBy))}</td></tr>
    <tr><th>Injury</th><td>${r.injury ? "Yes" : "No"}</td></tr><tr><th>Police or EMS</th><td>${r.policeReport ? "Yes" : "No"}</td></tr><tr><th>Witnesses</th><td>${esc(r.witnesses || "")}</td></tr>
    <tr><th>Details</th><td>${esc(r.desc || "")}</td></tr></tbody></table><h2>Timeline</h2><table><tbody>${r.notes.map(n => `<tr><td style="width:30%">${esc(when(n.t))}</td><td>${esc(n.by ? sname(n.by) : "System")}: ${esc(n.text)}</td></tr>`).join("")}</tbody></table>
    <h2>Sign-off</h2><table><tbody><tr><th style="width:30%">Manager on duty</th><td style="height:30px"></td></tr><tr><th>Date</th><td style="height:30px"></td></tr></tbody></table>`);
};

/* ================= Inspections ================= */
const tplById = id => S.templates.find(t => t.id === id) || S.templates[0];
const passed = x => x.score >= tplById(x.templateId).pass;
VIEWS.inspections = function () {
  const h = H(), tab = U.f.inTab || "overview", now = Date.now();
  const d30 = h.inspections.filter(x => x.at > now - 30 * DAY);
  const head = `<div class="filters"><div class="seg">${[["overview", "Overview"], ["history", "History"], ["templates", "Checklists"]].map(([k, l]) => `<button class="${tab === k ? "active" : ""}" data-act="seg" data-k="inTab" data-v="${k}">${l}</button>`).join("")}</div><span style="flex:1"></span>
    ${can("inspect") ? `<button class="btn" data-act="in-next">Inspect next clean room</button><button class="btn primary" data-act="in-start">＋ Start inspection</button>` : ""}</div>`;
  if (tab === "history") {
    const lim = U.limit.in || 50;
    return head + `<div class="rows">${h.inspections.slice(0, lim).map(x => `<div class="row" data-act="nav" data-href="#/inspections/${x.id}"><div><div class="t"><span class="id">${x.id}</span>${esc(tplById(x.templateId).name)} · ${/^\d+$/.test(x.location) ? "Room " : ""}${esc(x.location)}</div>
      <div class="m"><span>👤 ${esc(sname(x.inspector))}</span>${x.attendant ? `<span>🧹 ${esc(sname(x.attendant))}</span>` : ""}<span>${esc(when(x.at))}</span><span>${x.results.filter(r => r === "fail").length} items failed</span></div></div>
      <div class="r"><span class="chip ${passed(x) ? "green" : "red"}" style="font-size:14px">${x.score}%</span></div></div>`).join("")}
      ${h.inspections.length > lim ? `<div class="more-row"><button class="btn sm" data-act="more" data-k="in">Show more</button></div>` : ""}</div>`;
  }
  if (tab === "templates") {
    return head + `<div class="cols">${S.templates.filter(t => !t.hidden).map(t => `<div class="panel"><div class="ph"><h2>${esc(t.name)}</h2><span class="grow"></span>${chip("Pass at " + t.pass + "%", "blue")}${can("tplEdit") ? `<button class="btn sm" data-act="tpl-edit" data-id="${t.id}">Edit</button>` : ""}</div>
      <ol style="margin:0;padding-left:20px;font-size:13.5px">${t.items.map(([txt, w, c]) => `<li>${esc(txt)}${w > 1 ? ` <span class="muted">×${w}</span>` : ""}${c ? ` <span class="chk"><span class="crit">CRITICAL</span></span>` : ""}</li>`).join("")}</ol></div>`).join("")}</div>
      <p class="muted" style="font-size:13px;margin-top:10px">Weight ×2 counts double. Failing a critical item fails the whole inspection, whatever the score.</p>`;
  }
  const days = dayBuckets(30);
  const trend = days.map(d => { const xs = d30.filter(x => dayKey(x.at) === d); return xs.length ? xs.reduce((s, x) => s + x.score, 0) / xs.length : null; });
  const missed = {};
  d30.forEach(x => { const t = tplById(x.templateId); x.results.forEach((r, i) => { if (r === "fail" && t.items[i]) { const k = t.items[i][0]; missed[k] = (missed[k] || 0) + 1; } }); });
  const byAtt = {};
  d30.filter(x => x.attendant).forEach(x => { (byAtt[x.attendant] = byAtt[x.attendant] || []).push(x.score); });
  const cleanRooms = h.rooms.filter(r => r.hk === "Clean").length;
  return head + `<div class="kpis">
      <div class="kpi"><div class="label">Average score, 30 days</div><div class="value">${d30.length ? Math.round(d30.reduce((s, x) => s + x.score, 0) / d30.length) + "%" : "–"}</div><div class="sub">${d30.length} inspections</div></div>
      <div class="kpi"><div class="label">Pass rate</div><div class="value">${pct(d30.filter(passed).length / (d30.length || 1))}</div><div class="sub">critical fails count as fails</div></div>
      <a class="kpi" href="#/housekeeping" data-act="nav" data-href="#/housekeeping"><div class="label">Waiting for inspection</div><div class="value">${cleanRooms}</div><div class="sub">rooms marked clean</div></a>
      <div class="kpi"><div class="label">Today</div><div class="value">${h.inspections.filter(x => x.at >= dayKey(now)).length}</div><div class="sub">inspections done</div></div>
    </div>
    <div class="cols">
      <div class="panel"><div class="ph"><h2>Average score by day</h2></div>${lineChart(days.map(shortDay), [{ name: "Score", values: trend }], { min0: false, suffix: "%" })}</div>
      <div class="panel"><div class="ph"><h2>Most-missed items</h2></div>${hbars(Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 7), { cls: "amber" })}</div>
      <div class="panel"><div class="ph"><h2>Room scores by attendant</h2></div>${hbars(Object.entries(byAtt).map(([id, s]) => [sname(id), s.reduce((a, b) => a + b, 0) / s.length]).sort((a, b) => b[1] - a[1]), { fmt: v => Math.round(v) + "%", max: 100 })}</div>
      <div class="panel"><div class="ph"><h2>Latest</h2></div><div class="rows">${h.inspections.slice(0, 6).map(x => `<div class="row" data-act="nav" data-href="#/inspections/${x.id}"><div><div class="t">${/^\d+$/.test(x.location) ? "Room " : ""}${esc(x.location)}</div><div class="m">${esc(sname(x.inspector))} · ${esc(ago(x.at))}</div></div><div class="r"><span class="chip ${passed(x) ? "green" : "red"}">${x.score}%</span></div></div>`).join("")}</div></div>
    </div>`;
};
ACT["in-start"] = () => startInspectionPicker();
ACT["in-next"] = () => {
  const r = H().rooms.filter(x => x.hk === "Clean").sort((a, b) => (b.vip || b.rush) - (a.vip || a.rush) || (b.due === "ARR") - (a.due === "ARR"))[0];
  if (!r) { toast("No rooms are waiting for inspection."); return; }
  startInspection("T-ROOM", r.no);
};
function startInspectionPicker() {
  modal({ title: "Start an inspection", body: `<div class="form"><div class="f full"><label>Checklist</label><select id="sp-t">${S.templates.filter(t => !t.hidden).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
      <div class="f full"><label>Room or area</label><input type="text" id="sp-l" list="sp-ll" placeholder="Room number or area"><datalist id="sp-ll">${locationList().map(l => `<option value="${esc(l)}">`).join("")}</datalist></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="sp-go">Start</button>` });
  modalEl().querySelector("#sp-go").onclick = () => {
    const t = document.getElementById("sp-t").value, l = document.getElementById("sp-l").value.trim();
    if (!l) { toast("Choose a room or area."); return; }
    startInspection(t, l);
  };
}
function startInspection(tplId, location) {
  let t = tplById(tplId);
  if (t.hidden) t = S.templates.find(x => !x.hidden && x.id.split("-v")[0] === t.id.split("-v")[0]) || t;
  const room = roomByNo(location);
  const results = t.items.map(() => null), notes = t.items.map(() => ""), mkwo = t.items.map(() => false);
  modal({ title: `${esc(t.name)} · ${room ? "Room " : ""}${esc(location)}`, wide: true,
    body: `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div><div class="score" id="si-score">–</div><div class="muted" style="font-size:13px">Pass at ${t.pass}%</div></div>
      <div style="flex:1;min-width:200px">${room ? `Attendant: <b>${esc(sname(room.att || room.cleanedBy))}</b> · ${hkChip(room.hk)}` : ""}<div class="bar" style="margin-top:8px"><i id="si-bar" style="width:0"></i></div><div class="muted" style="font-size:12.5px;margin-top:4px" id="si-prog">0 of ${t.items.length} checked</div></div>
      <button class="btn sm" id="si-all">Pass all remaining</button></div>
      <div id="si-items">${t.items.map(([txt, w, c], i) => `<div class="chk" data-i="${i}"><span>${esc(txt)}${c ? '<span class="crit">CRITICAL</span>' : ""}</span>
        <span class="pf"><button type="button" class="p" data-v="pass">Pass</button><button type="button" class="f" data-v="fail">Fail</button><button type="button" class="n" data-v="na">N/A</button></span>
        <div class="fx" style="grid-column:1/-1;display:none;gap:8px;flex-wrap:wrap;align-items:center"><input type="text" placeholder="What was wrong?" style="flex:1;min-width:180px"><label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox"> Create work order</label></div></div>`).join("")}</div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="si-go" disabled>Submit inspection</button>` });
  const box = modalEl();
  const upd = () => {
    const done = results.filter(x => x).length;
    box.querySelector("#si-prog").textContent = `${done} of ${t.items.length} checked`;
    box.querySelector("#si-bar").style.width = (done / t.items.length * 100) + "%";
    const s = done ? D.scoreInspection(t, results) : null;
    const critFail = t.items.some((it, i) => it[2] && results[i] === "fail");
    const el = box.querySelector("#si-score");
    el.textContent = s == null ? "–" : s + "%"; el.style.color = s == null ? "" : s >= t.pass ? "var(--good)" : "var(--bad)";
    if (critFail) el.title = "A critical item failed";
    box.querySelector("#si-go").disabled = done < t.items.length;
  };
  box.querySelectorAll("#si-items .chk").forEach(row => {
    const i = +row.dataset.i;
    row.querySelectorAll(".pf button").forEach(b => b.onclick = () => {
      results[i] = b.dataset.v;
      row.querySelectorAll(".pf button").forEach(x => x.classList.toggle("on", x === b));
      row.querySelector(".fx").style.display = b.dataset.v === "fail" ? "flex" : "none";
      upd();
    });
    row.querySelector(".fx input[type=text]").oninput = e => { notes[i] = e.target.value; };
    row.querySelector(".fx input[type=checkbox]").onchange = e => { mkwo[i] = e.target.checked; };
  });
  box.querySelector("#si-all").onclick = () => { box.querySelectorAll("#si-items .chk").forEach(row => { const i = +row.dataset.i; if (!results[i]) row.querySelector(".pf .p").click(); }); };
  box.querySelector("#si-go").onclick = () => {
    const h = H(), now = Date.now(), id = nextId("IN");
    const rec = { id, templateId: t.id, location, inspector: me().id, attendant: room ? (room.att || room.cleanedBy || null) : null, at: now, results: results.slice(), notes: notes.slice() };
    rec.score = D.scoreInspection(t, results);
    h.inspections.unshift(rec);
    const ok = rec.score >= t.pass;
    let msg = `${location} scored ${rec.score}%`;
    if (room && room.hk !== "OOO" && room.hk !== "OOS") {
      if (ok) { room.hk = "Inspected"; room.updatedAt = now; msg += ", room released as inspected"; }
      else { room.hk = "Dirty"; room.note = "Failed inspection: " + t.items.filter((_, i) => results[i] === "fail").map(x => x[0]).join("; ").slice(0, 120); room.updatedAt = now; msg += ", sent back to the attendant"; }
    }
    let woN = 0;
    t.items.forEach(([txt], i) => {
      if (results[i] === "fail" && mkwo[i]) {
        const wid = nextId("WO"); woN++;
        h.workOrders.unshift({ id: wid, title: notes[i] || txt, category: guessCategory(notes[i] + " " + txt) || "Finishes", location, priority: "Normal", status: "Open", assignee: null, createdBy: me().id, createdAt: now, dueAt: now + 48 * HOUR, startedAt: null, completedAt: null, minutes: 0, partsCost: 0, oooRoom: false, source: "Inspection", photo: null, desc: `From inspection ${id}: ${txt}`, notes: [{ t: now, by: me().id, text: "Created from inspection " + id }] });
      }
    });
    if (woN) msg += `, ${woN} work order${woN > 1 ? "s" : ""} created`;
    logActivity(`inspected ${location}, score ${rec.score}%`, "#/inspections/" + id);
    touch(); closeModal(true); render(); toast(msg);
  };
}
OPENERS.inspections = id => {
  const x = H().inspections.find(i => i.id === id);
  if (!x) return;
  const t = tplById(x.templateId);
  recordModal("inspections", { title: `${esc(t.name)} · ${/^\d+$/.test(x.location) ? "Room " : ""}${esc(x.location)}`, wide: true,
    body: `<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px"><div class="score" style="color:${passed(x) ? "var(--good)" : "var(--bad)"}">${x.score}%</div><div>${chip(passed(x) ? "Passed" : "Failed", passed(x) ? "green" : "red")}<div class="muted" style="font-size:13px;margin-top:4px">${esc(when(x.at))} · inspected by ${esc(sname(x.inspector))}${x.attendant ? " · cleaned by " + esc(sname(x.attendant)) : ""}</div></div></div>
      ${t.items.map(([txt, , c], i) => `<div class="chk"><span>${esc(txt)}${c ? '<span class="crit">CRITICAL</span>' : ""}${x.notes && x.notes[i] ? `<div class="muted" style="font-size:12.5px">${esc(x.notes[i])}</div>` : ""}</span>${x.results[i] === "pass" ? chip("Pass", "green") : x.results[i] === "fail" ? chip("Fail", "red") : chip("N/A")}</div>`).join("")}` });
};
ACT["tpl-edit"] = el => {
  const t = S.templates.find(x => x.id === el.dataset.id);
  modal({ title: "Edit checklist: " + esc(t.name), wide: true, body: `<div class="form"><div class="f"><label>Name</label><input type="text" id="te-name" value="${esc(t.name)}"></div><div class="f"><label>Pass mark (%)</label><input type="number" id="te-pass" min="0" max="100" value="${t.pass}"></div></div>
      <p class="muted" style="font-size:13px;margin:10px 0 4px">One item per line. Add <b>| 2</b> for double weight and <b>| critical</b> for a must-pass item.</p>
      <textarea id="te-items" style="min-height:260px;font-family:'JetBrains Mono',monospace;font-size:13px">${esc(t.items.map(([x, w, c]) => x + (w > 1 ? " | " + w : "") + (c ? " | critical" : "")).join("\n"))}</textarea>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="te-go">Save checklist</button>` });
  modalEl().querySelector("#te-go").onclick = () => {
    const items = document.getElementById("te-items").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
      const parts = l.split("|").map(s => s.trim());
      return [parts[0], +(parts.find(p => /^\d+$/.test(p)) || 1), parts.some(p => /^critical$/i.test(p))];
    });
    if (!items.length) { toast("A checklist needs at least one item."); return; }
    // Keep old records readable: only change items for future inspections by saving a new version when items change.
    const changed = JSON.stringify(items) !== JSON.stringify(t.items);
    if (changed) {
      const nt = { id: t.id + "-v" + Date.now().toString(36), name: document.getElementById("te-name").value.trim() || t.name, area: t.area, pass: +document.getElementById("te-pass").value || t.pass, items };
      S.templates = S.templates.map(x => x.id === t.id ? Object.assign({}, x, { retired: true }) : x);
      const idx = S.templates.findIndex(x => x.id === t.id);
      S.templates.splice(idx + 1, 0, nt);
      S.templates.forEach(x => { if (x.retired) x.hidden = true; });
    } else { t.name = document.getElementById("te-name").value.trim() || t.name; t.pass = +document.getElementById("te-pass").value || t.pass; }
    touch(); closeModal(true); render(); toast("Checklist saved");
  };
};

/* ================= Logbook ================= */
function shiftNow() { const h = new Date().getHours(); return h >= 6 && h < 14 ? "AM" : h >= 14 && h < 22 ? "PM" : "Night"; }
VIEWS.logbook = function () {
  const h = H(), f = U.f, m = me(), now = Date.now();
  const range = f.lgRange || "3";
  const list = h.log.filter(e => (range === "all" || e.at > now - +range * DAY) && (!f.lgDept || e.dept === f.lgDept) &&
    (!f.lgUnread || !e.readBy.includes(m.id)) && (!f.lgFollow || e.followUp === "Open") && (!f.lgText || e.text.toLowerCase().includes(f.lgText.toLowerCase())))
    .sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
  const unread = h.log.filter(e => !e.readBy.includes(m.id) && e.at > now - 3 * DAY).length;
  return `<div class="panel" style="margin-bottom:14px"><div class="ph"><h2>New entry</h2><span class="grow"></span><span class="muted" style="font-size:13px">${esc(m.name)} · ${shiftNow()} shift</span></div>
      <textarea id="lg-text" placeholder="What should the next shift know? Use @Name to mention someone."></textarea>
      <div class="filters" style="margin:8px 0 0"><select id="lg-dept">${opt(D.DEPTS, m.dept)}</select><select id="lg-shift">${opt(["AM", "PM", "Night"], shiftNow())}</select>
        <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="lg-imp"> Important</label>
        <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="lg-fu"> Needs follow-up</label>
        <span style="flex:1"></span><button class="btn primary" data-act="lg-post">Post</button></div></div>
    <div class="filters">
      <div class="seg">${[["1", "Today"], ["3", "3 days"], ["7", "7 days"], ["all", "All"]].map(([k, l]) => `<button class="${range === k ? "active" : ""}" data-act="seg" data-k="lgRange" data-v="${k}">${l}</button>`).join("")}</div>
      <select data-f="lgDept"><option value="">All departments</option>${opt(D.DEPTS, f.lgDept)}</select>
      <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" data-f="lgUnread"${f.lgUnread ? " checked" : ""}> Unread (${unread})</label>
      <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" data-f="lgFollow"${f.lgFollow ? " checked" : ""}> Open follow-ups</label>
      <input type="search" data-f="lgText" placeholder="Search entries" value="${esc(f.lgText || "")}" style="width:180px">
      <span style="flex:1"></span>${unread ? `<button class="btn" data-act="lg-readall">Mark all read</button>` : ""}
    </div>
    ${list.map(e => {
      const isUnread = !e.readBy.includes(m.id);
      return `<div class="entry${isUnread ? " unread" : ""}${e.pinned ? " pinned" : ""}"><div class="eh">${avatar(e.author)}<span class="who">${esc(sname(e.author))}</span>${chip(e.dept, "blue")}${chip(e.shift + " shift")}${e.priority === "Important" ? chip("Important", "red") : ""}${e.pinned ? chip("📌 Pinned", "amber") : ""}<span class="when">${esc(when(e.at))}</span></div>
        <div class="body">${esc(e.text).replace(/@([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g, "<b style='color:var(--brand-2)'>@$1</b>")}</div>
        ${e.comments.length ? `<div class="cm">${e.comments.map(c => `<div><b>${esc(sname(c.by))}</b> ${esc(c.text)} <span class="muted" style="font-size:12px">${esc(ago(c.t))}</span></div>`).join("")}</div>` : ""}
        <div class="ef">${e.followUp ? `<button class="btn sm${e.followUp === "Open" ? "" : " good"}" data-act="lg-fu" data-id="${e.id}">${e.followUp === "Open" ? "☐ Follow-up open" : "☑ Followed up"}</button>` : ""}
          ${isUnread ? `<button class="btn sm" data-act="lg-read" data-id="${e.id}">Mark read</button>` : ""}
          ${can("pin") ? `<button class="btn sm ghost" data-act="lg-pin" data-id="${e.id}">${e.pinned ? "Unpin" : "📌 Pin"}</button>` : ""}
          <button class="btn sm ghost" data-act="lg-reply" data-id="${e.id}">💬 Reply</button>
          <span title="${esc(e.readBy.map(sname).join(", "))}">👁 Read by ${e.readBy.length}</span></div></div>`;
    }).join("") || `<div class="panel empty">No log entries match.</div>`}`;
};
function openLogForm() { go("#/logbook"); setTimeout(() => { const t = document.getElementById("lg-text"); if (t) { t.focus(); t.scrollIntoView({ block: "center" }); } }, 50); }
ACT["lg-post"] = () => {
  const text = document.getElementById("lg-text").value.trim();
  if (!text) { toast("Write something first."); return; }
  const fu = document.getElementById("lg-fu").checked;
  const e = { id: nextId("LG"), dept: document.getElementById("lg-dept").value, shift: document.getElementById("lg-shift").value, author: me().id, at: Date.now(), text,
    priority: document.getElementById("lg-imp").checked ? "Important" : "Normal", pinned: false, followUp: fu ? "Open" : "", readBy: [me().id], comments: [] };
  H().log.unshift(e);
  logActivity("posted in the logbook", "#/logbook");
  touch(); render(); toast("Posted to the logbook");
};
const logOf = id => H().log.find(e => e.id === id);
ACT["lg-read"] = el => { const e = logOf(el.dataset.id); if (!e.readBy.includes(me().id)) e.readBy.push(me().id); touch(); render(); };
ACT["lg-readall"] = () => { const id = me().id; H().log.forEach(e => { if (!e.readBy.includes(id)) e.readBy.push(id); }); touch(); render(); toast("All entries marked read"); };
ACT["lg-pin"] = el => { const e = logOf(el.dataset.id); e.pinned = !e.pinned; touch(); render(); };
ACT["lg-fu"] = el => { const e = logOf(el.dataset.id); e.followUp = e.followUp === "Open" ? "Done" : "Open"; e.comments.push({ t: Date.now(), by: me().id, text: e.followUp === "Done" ? "Marked follow-up done" : "Reopened follow-up" }); touch(); render(); };
ACT["lg-reply"] = el => {
  const e = logOf(el.dataset.id);
  modal({ title: "Reply", body: `<p class="muted" style="font-size:13.5px">${esc(e.text.slice(0, 200))}</p><textarea id="lr-t" placeholder="Your reply"></textarea>`, foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="lr-go">Reply</button>` });
  modalEl().querySelector("#lr-go").onclick = () => { const t = document.getElementById("lr-t").value.trim(); if (!t) return; e.comments.push({ t: Date.now(), by: me().id, text: t }); if (!e.readBy.includes(me().id)) e.readBy.push(me().id); touch(); closeModal(true); render(); };
};

/* ================= Lost & found ================= */
const lfOf = id => H().lostFound.find(x => x.id === id);
const retentionDays = x => x.valuable ? 90 : 60;
function lfAgeChip(x) {
  if (x.status !== "Stored") return chip(x.status, x.status === "Claimed" || x.status === "Shipped" ? "green" : "");
  const left = retentionDays(x) - Math.floor((Date.now() - x.foundAt) / DAY);
  return left <= 0 ? chip("Past retention", "red") : chip(left + " days left", left < 10 ? "amber" : "blue");
}
VIEWS.lostfound = function () {
  const h = H(), f = U.f, st = f.lfStatus || "Stored";
  const list = h.lostFound.filter(x => (st === "all" || (st === "returned" ? ["Claimed", "Shipped"].includes(x.status) : st === "closed" ? ["Donated", "Disposed"].includes(x.status) : x.status === st)) &&
    (!f.lfCat || x.category === f.lfCat) && (!f.lfText || [x.id, x.item, x.location, x.guest].join(" ").toLowerCase().includes(f.lfText.toLowerCase())));
  const stored = h.lostFound.filter(x => x.status === "Stored");
  const d30 = h.lostFound.filter(x => x.foundAt > Date.now() - 30 * DAY);
  return `<div class="kpis">
      <div class="kpi"><div class="label">In storage</div><div class="value">${stored.length}</div><div class="sub">${stored.filter(x => x.valuable).length} valuables in the safe</div></div>
      <div class="kpi ${stored.filter(x => (Date.now() - x.foundAt) / DAY > retentionDays(x)).length ? "alert" : ""}"><div class="label">Past retention</div><div class="value">${stored.filter(x => (Date.now() - x.foundAt) / DAY > retentionDays(x)).length}</div><div class="sub">ready to donate or dispose</div></div>
      <div class="kpi"><div class="label">Returned, 30 days</div><div class="value">${d30.filter(x => ["Claimed", "Shipped"].includes(x.status)).length}</div><div class="sub">of ${d30.length} items found</div></div>
    </div>
    <div class="filters"><div class="seg">${[["Stored", "In storage"], ["returned", "Returned"], ["closed", "Donated or disposed"], ["all", "All"]].map(([k, l]) => `<button class="${st === k ? "active" : ""}" data-act="seg" data-k="lfStatus" data-v="${k}">${l}</button>`).join("")}</div>
      <select data-f="lfCat"><option value="">All categories</option>${opt([...new Set(h.lostFound.map(x => x.category))], f.lfCat)}</select>
      <input type="search" data-f="lfText" placeholder="Search item, room, guest" value="${esc(f.lfText || "")}" style="width:200px">
      <span style="flex:1"></span><button class="btn primary" data-act="lf-new">＋ Found item</button></div>
    <div class="rows">${list.map(x => `<div class="row" data-act="nav" data-href="#/lostfound/${x.id}"><div><div class="t"><span class="id">${x.id}</span>${esc(x.item)} ${x.valuable ? chip("Valuable", "purple") : ""}</div>
      <div class="m"><span>📍 ${esc(x.location)}</span><span>Found ${esc(when(x.foundAt))} by ${esc(sname(x.foundBy))}</span><span>📦 ${esc(x.bin)}</span>${x.guest ? `<span>👤 ${esc(x.guest)}</span>` : ""}</div></div><div class="r">${lfAgeChip(x)}</div></div>`).join("") || `<div class="empty">No items here.</div>`}</div>`;
};
ACT["lf-new"] = () => openLFForm();
function openLFForm(pre = {}) {
  const h = H();
  modal({ title: "Log a found item", body: `<div class="form" id="lf-form">
      <div class="f full"><label>Item *</label><input type="text" name="item" placeholder="e.g. Black phone charger"></div>
      <div class="f"><label>Category</label><select name="category">${opt(["Electronics", "Clothing", "Jewellery", "Documents", "Personal", "Toys", "Other"], "Personal")}</select></div>
      <div class="f"><label>Where found *</label><input type="text" name="location" value="${esc(pre.location || "")}" list="lf-locs"><datalist id="lf-locs">${[...h.rooms.map(r => "Room " + r.no), ...D.AREAS].map(l => `<option value="${esc(l)}">`).join("")}</datalist></div>
      <div class="f"><label>Found by</label><select name="foundBy">${staffOpts(me().id, null, "")}</select></div>
      <div class="f"><label>Storage bin</label><input type="text" name="bin" value="Bin ${"ABCDEF"[Math.floor(Math.random() * 6)]}${1 + Math.floor(Math.random() * 9)}"></div>
      <div class="f full check"><input type="checkbox" name="valuable" id="lf-val"><label for="lf-val" style="font-weight:500">Valuable (store in the safe, keep 90 days)</label></div>
      <div class="f full"><label>Notes</label><input type="text" name="notes" placeholder="Colour, brand, contents"></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="lf-go">Save item</button>` });
  modalEl().querySelector("[name=category]").onchange = e => { modalEl().querySelector("#lf-val").checked = ["Electronics", "Jewellery", "Documents"].includes(e.target.value); };
  modalEl().querySelector("#lf-go").onclick = () => {
    const v = readForm(modalEl().querySelector("#lf-form"));
    if (!v.item || !v.location) { toast("Please add the item and where it was found."); return; }
    const x = { id: nextId("LF"), item: v.item, category: v.category, location: v.location, foundBy: v.foundBy || me().id, foundAt: Date.now(), status: "Stored", bin: v.bin, valuable: v.valuable, guest: "", contact: "", tracking: "", closedAt: null, notes: v.notes };
    H().lostFound.unshift(x);
    logActivity(`logged found item ${x.id}: ${x.item}`, "#/lostfound/" + x.id);
    touch(); closeModal(true); render(); toast(`${x.id} saved in ${x.bin}`);
  };
}
OPENERS.lostfound = id => {
  const x = lfOf(id);
  if (!x) return;
  recordModal("lostfound", { title: `<span class="id" style="font-family:'JetBrains Mono',monospace;color:var(--ink-3);font-size:14px">${x.id}</span> ${esc(x.item)}`,
    body: `<div style="display:flex;gap:8px;margin-bottom:12px">${lfAgeChip(x)}${x.valuable ? chip("Valuable", "purple") : ""}${chip(x.category)}</div>
      <dl class="kv"><dt>Found</dt><dd>${esc(when(x.foundAt))} at ${esc(x.location)}</dd><dt>Found by</dt><dd>${esc(sname(x.foundBy))}</dd><dt>Stored in</dt><dd>${esc(x.bin)}</dd>
      <dt>Keep until</dt><dd>${esc(dateOnly(x.foundAt + retentionDays(x) * DAY))} (${retentionDays(x)} days)</dd>
      ${x.guest ? `<dt>Returned to</dt><dd>${esc(x.guest)}${x.contact ? " · " + esc(x.contact) : ""}</dd>` : ""}${x.tracking ? `<dt>Tracking</dt><dd>${esc(x.tracking)}</dd>` : ""}
      ${x.closedAt ? `<dt>Closed</dt><dd>${esc(when(x.closedAt))}</dd>` : ""}${x.notes ? `<dt>Notes</dt><dd>${esc(x.notes)}</dd>` : ""}</dl>`,
    foot: `<button class="btn" data-act="lf-label" data-id="${x.id}">🏷️ Print label</button><span class="grow"></span>${x.status === "Stored" ? `<button class="btn" data-act="lf-close" data-id="${x.id}" data-st="Disposed">Dispose</button><button class="btn" data-act="lf-close" data-id="${x.id}" data-st="Donated">Donate</button><button class="btn primary" data-act="lf-return" data-id="${x.id}">Return to guest</button>` : `<button class="btn" data-act="lf-close" data-id="${x.id}" data-st="Stored">Back to storage</button>`}` });
};
ACT["lf-close"] = el => {
  const x = lfOf(el.dataset.id), st = el.dataset.st;
  const fin = () => { x.status = st; x.closedAt = st === "Stored" ? null : Date.now(); logActivity(`${st.toLowerCase()} ${x.id}: ${x.item}`, "#/lostfound/" + x.id); touch(); closeModal(true); OPENERS.lostfound(x.id); render(); };
  const early = st !== "Stored" && (Date.now() - x.foundAt) / DAY < retentionDays(x);
  if (early) { closeModal(true); confirmBox(`${x.item} is still inside its ${retentionDays(x)}-day retention period. ${st} it anyway?`, fin, st); } else fin();
};
ACT["lf-return"] = el => {
  const x = lfOf(el.dataset.id);
  modal({ title: "Return " + esc(x.item), body: `<div class="form" id="lr-form">
      <div class="f"><label>Guest name *</label><input type="text" name="guest"></div><div class="f"><label>Phone or email</label><input type="text" name="contact"></div>
      <div class="f"><label>How</label><select name="how" id="lr-how">${opt([["Claimed", "Picked up in person"], ["Shipped", "Shipped to guest"]], "Claimed")}</select></div>
      <div class="f"><label>Tracking number</label><input type="text" name="tracking" placeholder="If shipped"></div>
      <div class="f full check"><input type="checkbox" name="id" id="lr-id"><label for="lr-id" style="font-weight:500">Photo ID checked and matches the guest</label></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="lr-go2">Return item</button>` });
  modalEl().querySelector("#lr-go2").onclick = () => {
    const v = readForm(modalEl().querySelector("#lr-form"));
    if (!v.guest) { toast("Enter the guest's name."); return; }
    if (v.how === "Claimed" && !v.id) { toast("Check the guest's photo ID before releasing the item."); return; }
    Object.assign(x, { status: v.how, guest: v.guest, contact: v.contact, tracking: v.tracking, closedAt: Date.now() });
    logActivity(`returned ${x.id} (${x.item}) to ${x.guest}`, "#/lostfound/" + x.id);
    touch(); closeModal(true); render(); toast(`${x.item} returned to ${x.guest}`);
  };
};
ACT["lf-label"] = el => { const x = lfOf(el.dataset.id); printDoc(x.id, `<div style="border:2px dashed #18212b;padding:16px;max-width:360px"><h1>${x.id}</h1><p><b>${esc(x.item)}</b></p><p>Found: ${esc(when(x.foundAt))}<br>Where: ${esc(x.location)}<br>By: ${esc(sname(x.foundBy))}<br>Bin: ${esc(x.bin)}<br>Keep until: ${esc(dateOnly(x.foundAt + retentionDays(x) * DAY))}</p></div>`); };

/* ================= Inventory ================= */
const invOf = id => H().inventory.find(i => i.id === id);
const invStatus = i => i.onHand === 0 ? chip("Out", "red") : i.onHand <= i.reorder ? chip("Low", "amber") : i.onHand < i.par * 0.6 ? chip("Below par", "blue") : chip("OK", "green");
VIEWS.inventory = function () {
  const h = H(), f = U.f, tab = f.ivTab || "stock", edit = can("invEdit");
  const cats = [...new Set(h.inventory.map(i => i.category))];
  const items = h.inventory.filter(i => !f.ivCat || i.category === f.ivCat);
  const value = h.inventory.reduce((s, i) => s + i.onHand * i.cost, 0);
  const low = h.inventory.filter(i => i.onHand <= i.reorder);
  const head = `<div class="kpis">
      <div class="kpi"><div class="label">Stock value</div><div class="value">${money(value)}</div><div class="sub">${h.inventory.length} items tracked</div></div>
      <a class="kpi ${low.length ? "alert" : "ok"}" href="#/inventory" data-act="seg" data-k="ivTab" data-v="reorder"><div class="label">To reorder</div><div class="value">${low.length}</div><div class="sub">${money(low.reduce((s, i) => s + (i.par - i.onHand) * i.cost, 0))} to bring to par</div></a>
      <div class="kpi"><div class="label">Used, 14 days</div><div class="value">${money(h.invTx.filter(t => t.qty < 0 && t.t > Date.now() - 14 * DAY).reduce((s, t) => s - t.qty * ((invOf(t.itemId) || {}).cost || 0), 0))}</div><div class="sub">issued, damaged or used on work orders</div></div>
    </div>
    <div class="filters"><div class="seg">${[["stock", "Stock"], ["reorder", `Reorder (${low.length})`], ["count", "Stock count"], ["history", "History"]].map(([k, l]) => `<button class="${tab === k ? "active" : ""}" data-act="seg" data-k="ivTab" data-v="${k}">${l}</button>`).join("")}</div>
      ${tab === "stock" || tab === "count" ? `<select data-f="ivCat"><option value="">All categories</option>${opt(cats, f.ivCat)}</select>` : ""}<span style="flex:1"></span>
      ${tab === "stock" ? `<button class="btn" data-act="iv-csv">⬇ CSV</button>${edit ? `<button class="btn primary" data-act="iv-new">＋ Item</button>` : ""}` : ""}</div>`;
  if (tab === "reorder") {
    const bySup = {};
    low.forEach(i => (bySup[i.supplier] = bySup[i.supplier] || []).push(i));
    return head + (Object.keys(bySup).length ? Object.entries(bySup).map(([sup, list]) => `<div class="panel"><div class="ph"><h2>${esc(sup)}</h2><span class="grow"></span><b>${money(list.reduce((s, i) => s + (i.par - i.onHand) * i.cost, 0), 2)}</b>
      <button class="btn sm" data-act="iv-po" data-sup="${esc(sup)}">🖨️ Purchase order</button>${edit ? `<button class="btn sm good" data-act="iv-recv" data-sup="${esc(sup)}">✓ Mark received</button>` : ""}</div>
      <div class="tblw"><table><thead><tr><th>Item</th><th>Unit</th><th class="num">On hand</th><th class="num">Par</th><th class="num">Order</th><th class="num">Cost</th></tr></thead><tbody>${list.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td class="num">${i.onHand}</td><td class="num">${i.par}</td><td class="num"><b>${i.par - i.onHand}</b></td><td class="num">${money((i.par - i.onHand) * i.cost, 2)}</td></tr>`).join("")}</tbody></table></div></div>`).join("") : `<div class="panel empty">Everything is above its reorder point. 🎉</div>`);
  }
  if (tab === "count") {
    return head + `<div class="panel"><p class="muted" style="font-size:13.5px;margin-top:0">Type what is on the shelf. Differences are saved as count adjustments.</p>
      <div class="tblw"><table><thead><tr><th>Item</th><th>Location</th><th class="num">System</th><th class="num">Counted</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.name)} <span class="muted" style="font-size:12px">${esc(i.unit)}</span></td><td>${esc(i.location)}</td><td class="num">${i.onHand}</td><td class="num"><input type="number" min="0" class="cnt-in" data-id="${i.id}" value="${i.onHand}"${edit ? "" : " disabled"}></td></tr>`).join("")}</tbody></table></div>
      ${edit ? `<div style="margin-top:12px;text-align:right"><button class="btn primary" data-act="iv-count">Save count</button></div>` : ""}</div>`;
  }
  if (tab === "history") {
    return head + `<div class="tblw"><table><thead><tr><th>When</th><th>Item</th><th class="num">Qty</th><th>Reason</th><th>By</th></tr></thead><tbody>${h.invTx.slice(0, 80).map(t => `<tr><td>${esc(when(t.t))}</td><td>${esc((invOf(t.itemId) || {}).name || "")}</td><td class="num" style="color:${t.qty > 0 ? "var(--good)" : "var(--bad)"}">${t.qty > 0 ? "+" : ""}${t.qty}</td><td>${esc(t.reason)}</td><td>${esc(sname(t.by))}</td></tr>`).join("")}</tbody></table></div>`;
  }
  return head + `<div class="tblw"><table><thead><tr><th>Item</th><th>Category</th><th>Location</th><th class="num">On hand</th><th class="num">Par</th><th class="num">Reorder at</th><th>Status</th><th class="num">Value</th></tr></thead><tbody>
    ${items.map(i => `<tr class="${i.onHand <= i.reorder ? "low" : ""}" style="cursor:pointer" data-act="iv-adj" data-id="${i.id}" tabindex="0"><td><b>${esc(i.name)}</b><div class="muted" style="font-size:12px">${esc(i.unit)} · ${esc(i.supplier)}</div></td><td>${esc(i.category)}</td><td>${esc(i.location)}</td><td class="num"><b>${i.onHand}</b></td><td class="num">${i.par}</td><td class="num">${i.reorder}</td><td>${invStatus(i)}</td><td class="num">${money(i.onHand * i.cost)}</td></tr>`).join("")}</tbody></table></div>`;
};
ACT["iv-csv"] = () => csvDownload(`inventory-${S.hotel}.csv`, [["Item", "Category", "Unit", "Location", "On hand", "Par", "Reorder at", "Unit cost", "Value", "Supplier"], ...H().inventory.map(i => [i.name, i.category, i.unit, i.location, i.onHand, i.par, i.reorder, i.cost, (i.onHand * i.cost).toFixed(2), i.supplier])]);
ACT["iv-adj"] = el => {
  const i = invOf(el.dataset.id);
  if (!can("invEdit")) { toast("Your role can view stock but not change it."); return; }
  modal({ title: esc(i.name), body: `<p class="muted" style="font-size:13.5px">${i.onHand} ${esc(i.unit)} on hand · par ${i.par} · reorder at ${i.reorder}</p><div class="form">
      <div class="f"><label>Movement</label><select id="ia-k">${opt([["recv", "Receive (+)"], ["issue", "Issue to floor (−)"], ["damaged", "Damaged or lost (−)"]], "issue")}</select></div>
      <div class="f"><label>Quantity</label><input type="number" id="ia-q" min="1" value="1"></div>
      <div class="f"><label>Par level</label><input type="number" id="ia-par" min="0" value="${i.par}"></div><div class="f"><label>Reorder point</label><input type="number" id="ia-ro" min="0" value="${i.reorder}"></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="ia-go">Save</button>` });
  modalEl().querySelector("#ia-go").onclick = () => {
    const k = document.getElementById("ia-k").value, q = Math.max(0, +document.getElementById("ia-q").value || 0);
    i.par = Math.max(0, +document.getElementById("ia-par").value || 0); i.reorder = Math.max(0, +document.getElementById("ia-ro").value || 0);
    if (q) {
      const delta = k === "recv" ? q : -Math.min(q, i.onHand);
      i.onHand += delta;
      H().invTx.unshift({ t: Date.now(), itemId: i.id, qty: delta, by: me().id, reason: k === "recv" ? "Received" : k === "issue" ? "Issued to floor" : "Damaged" });
    }
    touch(); closeModal(true); render(); toast(`${i.name}: ${i.onHand} on hand`);
  };
};
ACT["iv-count"] = () => {
  const h = H(), now = Date.now(); let n = 0;
  document.querySelectorAll(".cnt-in").forEach(inp => {
    const i = invOf(inp.dataset.id), v = Math.max(0, Math.round(+inp.value));
    if (isNaN(v)) return;
    i.lastCount = now;
    if (v !== i.onHand) { h.invTx.unshift({ t: now, itemId: i.id, qty: v - i.onHand, by: me().id, reason: "Count adjustment" }); i.onHand = v; n++; }
  });
  logActivity("saved a stock count", "#/inventory"); touch(); U.f.ivTab = "stock"; render(); toast(n ? `Count saved, ${n} items adjusted` : "Count saved, no differences");
};
ACT["iv-recv"] = el => {
  const h = H(), sup = el.dataset.sup, now = Date.now();
  const list = h.inventory.filter(i => i.supplier === sup && i.onHand <= i.reorder);
  list.forEach(i => { const q = i.par - i.onHand; i.onHand = i.par; h.invTx.unshift({ t: now, itemId: i.id, qty: q, by: me().id, reason: "Received from " + sup }); });
  logActivity(`received order from ${sup}`, "#/inventory"); touch(); render(); toast(`${list.length} items received from ${sup}`);
};
ACT["iv-po"] = el => {
  const sup = el.dataset.sup, list = H().inventory.filter(i => i.supplier === sup && i.onHand <= i.reorder);
  printDoc("Purchase order", `<h1>Purchase order</h1><p>To: <b>${esc(sup)}</b><br>From: ${esc(hotelInfo().name)}<br>Requested by: ${esc(me().name)}</p>
    <table><thead><tr><th>Item</th><th>Unit</th><th>Qty</th><th>Unit cost</th><th>Total</th></tr></thead><tbody>${list.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td>${i.par - i.onHand}</td><td>${money(i.cost, 2)}</td><td>${money((i.par - i.onHand) * i.cost, 2)}</td></tr>`).join("")}
    <tr><th colspan="4">Total</th><th>${money(list.reduce((s, i) => s + (i.par - i.onHand) * i.cost, 0), 2)}</th></tr></tbody></table><h2>Approved by</h2><p style="border-bottom:1px solid #999;height:30px;width:260px"></p>`);
};
ACT["iv-new"] = () => {
  modal({ title: "New stock item", body: `<div class="form" id="in-form"><div class="f full"><label>Item *</label><input type="text" name="name"></div>
    <div class="f"><label>Category</label><select name="category">${opt([...new Set(H().inventory.map(i => i.category))], "Guest amenities")}</select></div><div class="f"><label>Unit</label><input type="text" name="unit" value="each"></div>
    <div class="f"><label>On hand</label><input type="number" name="onHand" value="0"></div><div class="f"><label>Par</label><input type="number" name="par" value="50"></div>
    <div class="f"><label>Reorder at</label><input type="number" name="reorder" value="10"></div><div class="f"><label>Unit cost ($)</label><input type="number" name="cost" step="0.01" value="1"></div>
    <div class="f"><label>Supplier</label><input type="text" name="supplier" list="in-sup"><datalist id="in-sup">${[...new Set(H().inventory.map(i => i.supplier))].map(s => `<option value="${esc(s)}">`).join("")}</datalist></div><div class="f"><label>Location</label><input type="text" name="location" value="Housekeeping store"></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="in-go">Add item</button>` });
  modalEl().querySelector("#in-go").onclick = () => {
    const v = readForm(modalEl().querySelector("#in-form"));
    if (!v.name) { toast("Name the item."); return; }
    H().inventory.push({ id: S.hotel + "-I" + Date.now().toString(36), name: v.name, category: v.category, unit: v.unit || "each", par: +v.par || 0, reorder: +v.reorder || 0, onHand: +v.onHand || 0, cost: +v.cost || 0, supplier: v.supplier || "–", location: v.location, lastCount: Date.now() });
    touch(); closeModal(true); render(); toast("Item added");
  };
};

/* ================= Reports ================= */
VIEWS.reports = function () {
  const h = H(), days = +(U.f.rpDays || 14), now = Date.now(), from = dayKey(now) - (days - 1) * DAY;
  const B = dayBuckets(days), L = B.map(shortDay);
  const wos = h.workOrders.filter(w => w.createdAt >= from), done = h.workOrders.filter(w => w.completedAt && w.completedAt >= from);
  const reqs = h.requests.filter(r => r.createdAt >= from), ins = h.inspections.filter(x => x.at >= from);
  const byCat = {}; wos.forEach(w => { byCat[w.category] = (byCat[w.category] || 0) + 1; });
  const pri = D.PRIORITIES.map(p => { const xs = done.filter(w => w.priority === p); return [p + ` (target ${D.DUE_HOURS[p]}h)`, xs.length ? xs.reduce((s, w) => s + (w.completedAt - w.createdAt), 0) / xs.length / HOUR : 0, xs.length && xs.reduce((s, w) => s + (w.completedAt - w.createdAt), 0) / xs.length / HOUR > D.DUE_HOURS[p] ? "amber" : "blue"]; });
  const reqCat = {}; reqs.forEach(r => { reqCat[r.category] = (reqCat[r.category] || 0) + 1; });
  const ackTrend = B.map(d => { const xs = reqs.filter(r => dayKey(r.createdAt) === d && r.ackAt); return xs.length ? xs.reduce((s, r) => s + (r.ackAt - r.createdAt), 0) / xs.length / MIN : null; });
  const inTrend = B.map(d => { const xs = ins.filter(x => dayKey(x.at) === d); return xs.length ? xs.reduce((s, x) => s + x.score, 0) / xs.length : null; });
  const repeat = {}; wos.filter(w => roomByNo(w.location)).forEach(w => { repeat[w.location] = (repeat[w.location] || 0) + 1; });
  const repeatRooms = Object.entries(repeat).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const recovery = reqs.reduce((s, r) => s + (r.recoveryCost || 0), 0);
  const labour = done.reduce((s, w) => s + w.minutes / 60 * LABOUR_RATE + w.partsCost, 0);
  const cleaned = {}; h.rooms.filter(r => (r.hk === "Clean" || r.hk === "Inspected") && r.att).forEach(r => { cleaned[r.att] = (cleaned[r.att] || 0) + 1; });
  return `<div class="filters"><div class="seg">${[["7", "7 days"], ["14", "14 days"], ["30", "30 days"]].map(([k, l]) => `<button class="${String(days) === k ? "active" : ""}" data-act="seg" data-k="rpDays" data-v="${k}">${l}</button>`).join("")}</div>
      <span class="muted" style="font-size:13px">${esc(shortDay(from))} to ${esc(shortDay(now))} · ${esc(hotelInfo().name)}</span><span style="flex:1"></span>
      <button class="btn" data-act="rp-csv">⬇ Work orders CSV</button><button class="btn" data-act="rq-csv">⬇ Requests CSV</button><button class="btn" onclick="window.print()">🖨️ Print</button></div>
    <div class="kpis">
      <div class="kpi"><div class="label">Work orders</div><div class="value">${wos.length}</div><div class="sub">${done.length} completed · ${pct(done.filter(w => w.completedAt <= w.dueAt).length / (done.length || 1))} on time</div></div>
      <div class="kpi"><div class="label">Maintenance cost</div><div class="value">${money(labour)}</div><div class="sub">labour and parts on completed work</div></div>
      <div class="kpi"><div class="label">Guest requests</div><div class="value">${reqs.length}</div><div class="sub">${reqs.filter(r => r.type === "Complaint").length} complaints · ${reqs.filter(r => r.type === "Incident").length} incidents</div></div>
      <div class="kpi"><div class="label">Service recovery</div><div class="value">${money(recovery)}</div><div class="sub">credits and amenities given</div></div>
      <div class="kpi"><div class="label">Inspection average</div><div class="value">${ins.length ? Math.round(ins.reduce((s, x) => s + x.score, 0) / ins.length) + "%" : "–"}</div><div class="sub">${ins.length} inspections · ${pct(ins.filter(passed).length / (ins.length || 1))} passed</div></div>
    </div>
    <div class="cols">
      <div class="panel"><div class="ph"><h2>Work orders created and completed</h2></div>${barChart(L, [{ name: "Created", values: B.map(d => wos.filter(w => dayKey(w.createdAt) === d).length) }, { name: "Completed", values: B.map(d => done.filter(w => dayKey(w.completedAt) === d).length), color: COLORS[2] }])}</div>
      <div class="panel"><div class="ph"><h2>Work orders by category</h2></div>${hbars(Object.entries(byCat).sort((a, b) => b[1] - a[1]))}</div>
      <div class="panel"><div class="ph"><h2>Average hours to complete, by priority</h2></div>${hbars(pri, { fmt: v => v ? v.toFixed(1) + "h" : "–" })}<p class="muted" style="font-size:12.5px;margin:8px 0 0">Amber bars are slower than target.</p></div>
      <div class="panel"><div class="ph"><h2>Guest requests per day</h2></div>${barChart(L, Object.keys(D.REQ_TYPES).map((t, j) => ({ name: t, values: B.map(d => reqs.filter(r => r.type === t && dayKey(r.createdAt) === d).length), color: COLORS[j] })), { stacked: true })}</div>
      <div class="panel"><div class="ph"><h2>Minutes to acknowledge a request</h2></div>${lineChart(L, [{ name: "Minutes", values: ackTrend, color: COLORS[1] }])}</div>
      <div class="panel"><div class="ph"><h2>Requests by category</h2></div>${hbars(Object.entries(reqCat).sort((a, b) => b[1] - a[1]).slice(0, 8), { cls: "amber" })}</div>
      <div class="panel"><div class="ph"><h2>Inspection score by day</h2></div>${lineChart(L, [{ name: "Average score", values: inTrend, color: COLORS[2] }], { min0: false, suffix: "%" })}</div>
      <div class="panel"><div class="ph"><h2>Rooms with repeat issues</h2></div>${repeatRooms.length ? `<div class="rows">${repeatRooms.map(([no, n]) => `<div class="row" data-act="nav" data-href="#/housekeeping/${no}"><div><div class="t">Room ${no}</div><div class="m">${esc([...new Set(wos.filter(w => w.location === no).map(w => w.category))].join(", "))}</div></div><div class="r"><b>${n} work orders</b></div></div>`).join("")}</div><p class="muted" style="font-size:12.5px;margin:8px 0 0">Two or more work orders in the period. Worth a deeper look or a capital fix.</p>` : `<div class="empty">No repeat rooms in this period.</div>`}</div>
      <div class="panel"><div class="ph"><h2>Rooms cleaned today, by attendant</h2></div>${hbars(Object.entries(cleaned).map(([id, n]) => [sname(id), n]).sort((a, b) => b[1] - a[1]), { cls: "" })}</div>
      <div class="panel"><div class="ph"><h2>Response time compared with last period</h2></div>${(() => {
        const prev = h.requests.filter(r => r.createdAt >= from - days * DAY && r.createdAt < from && r.ackAt);
        const cur = reqs.filter(r => r.ackAt);
        const a = cur.length ? cur.reduce((s, r) => s + r.ackAt - r.createdAt, 0) / cur.length : null, b = prev.length ? prev.reduce((s, r) => s + r.ackAt - r.createdAt, 0) / prev.length : null;
        const w1 = done.length ? done.reduce((s, w) => s + w.completedAt - w.createdAt, 0) / done.length : null;
        const pd = h.workOrders.filter(w => w.completedAt && w.completedAt >= from - days * DAY && w.completedAt < from);
        const w0 = pd.length ? pd.reduce((s, w) => s + w.completedAt - w.createdAt, 0) / pd.length : null;
        const row = (l, x, y) => `<tr><td>${l}</td><td class="num">${dur(x)}</td><td class="num">${y == null ? "–" : dur(y)}</td><td class="num">${x != null && y != null ? `<span class="delta ${x <= y ? "up" : "down"}">${x <= y ? "▼" : "▲"} ${Math.abs(Math.round((x / y - 1) * 100))}%</span>` : "–"}</td></tr>`;
        return `<div class="tblw"><table><thead><tr><th>Measure</th><th class="num">This period</th><th class="num">Previous</th><th class="num">Change</th></tr></thead><tbody>${row("Request acknowledged", a, b)}${row("Work order completed", w1, w0)}</tbody></table></div><p class="muted" style="font-size:12.5px;margin:8px 0 0">Green means faster than the previous ${days} days.</p>`;
      })()}</div>
    </div>`;
};
ACT["rp-csv"] = () => { const keep = U.f.woStatus; U.f.woStatus = "all"; ACT["wo-csv"](); U.f.woStatus = keep; };

/* ================= Team & roles ================= */
VIEWS.team = function () {
  const h = H(), edit = can("teamEdit");
  const depts = S.role === "gm" ? D.DEPTS : [me().dept];
  const list = h.staff.filter(s => depts.includes(s.dept));
  const roles = Object.entries(D.ROLES);
  const mods = Object.keys(MODS);
  return `<div class="cols c21"><div class="panel"><div class="ph"><h2>Team at ${esc(hotelInfo().name)}</h2><span class="grow"></span>${edit ? `<button class="btn primary sm" data-act="tm-new">＋ Team member</button>` : ""}</div>
      <div class="tblw"><table><thead><tr><th>Name</th><th>Role</th><th class="num">Open WOs</th><th class="num">Rooms today</th><th>Status</th></tr></thead><tbody>${list.map(s => `<tr><td><div style="display:flex;gap:8px;align-items:center">${avatar(s.id)}<b>${esc(s.name)}</b></div></td><td>${esc(D.ROLES[s.role].name)}<div class="muted" style="font-size:12px">${esc(s.dept)}</div></td>
        <td class="num">${h.workOrders.filter(w => w.assignee === s.id && w.status !== "Completed").length || ""}</td><td class="num">${h.rooms.filter(r => r.att === s.id).length || ""}</td>
        <td>${edit && s.id !== me().id ? `<button class="btn sm${s.active ? "" : " bad"}" data-act="tm-toggle" data-id="${s.id}">${s.active ? "Active" : "Inactive"}</button>` : chip(s.active ? "Active" : "Inactive", s.active ? "green" : "")}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="panel"><div class="ph"><h2>What each role sees</h2></div><p class="muted" style="font-size:13px;margin-top:0">Each person only sees the modules their job needs. Switch role on the left to try it.</p>
      <div class="tblw"><table style="font-size:12.5px"><thead><tr><th>Module</th>${roles.map(([k, r]) => `<th title="${esc(r.name)}" style="text-align:center">${esc(r.name.split(" ").map(w => w[0]).join(""))}</th>`).join("")}</tr></thead><tbody>${mods.map(m => `<tr><td>${MODS[m].ic} ${esc(MODS[m].name)}</td>${roles.map(([, r]) => `<td style="text-align:center">${r.mods.includes(m) ? "✓" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${roles.map(([, r]) => `${r.name.split(" ").map(w => w[0]).join("")} = ${esc(r.name)}`).join(" · ")}</p></div></div>`;
};
ACT["tm-toggle"] = el => { const s = staff(el.dataset.id); s.active = !s.active; touch(); render(); toast(`${s.name} is now ${s.active ? "active" : "inactive"}`); };
ACT["tm-new"] = () => {
  const allowed = S.role === "gm" ? Object.entries(D.ROLES) : Object.entries(D.ROLES).filter(([, r]) => r.dept === me().dept);
  modal({ title: "Add team member", body: `<div class="form" id="tm-form"><div class="f full"><label>Full name *</label><input type="text" name="name"></div><div class="f full"><label>Role</label><select name="role">${opt(allowed.map(([k, r]) => [k, r.name]), allowed[0][0])}</select></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="tm-go">Add</button>` });
  modalEl().querySelector("#tm-go").onclick = () => {
    const v = readForm(modalEl().querySelector("#tm-form"));
    if (!v.name) { toast("Enter a name."); return; }
    const h = H();
    h.staff.push({ id: S.hotel + "-S" + (h.staff.length + 1) + "x" + Date.now().toString(36), name: v.name, role: v.role, dept: D.ROLES[v.role].dept, active: true });
    touch(); closeModal(true); render(); toast(v.name + " added");
  };
};

boot();
