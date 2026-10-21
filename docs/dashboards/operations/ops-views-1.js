// Hotel Operations Hub views: housekeeping, my rooms, work orders, preventive maintenance, assets.
"use strict";

/* ================= Housekeeping ================= */
const SERVICE_LABEL = r => r.due === "DEP" ? "Departure" : r.due === "ARR" ? (r.occ === "OCC" ? "Stayover" : "Arrival") : r.occ === "OCC" ? "Stayover" : "Vacant";
const occShort = r => r.due === "DEP" ? "Due out" : r.due === "ARR" ? "Arrival" : r.occ === "OCC" ? "Stayover" : "Vacant";
const firstName = id => (staff(id) || { name: "" }).name.split(" ")[0];
const roomByNo = no => H().rooms.find(r => r.no === String(no));

function filterRooms() {
  const f = U.f;
  return H().rooms.filter(r =>
    (!f.hkFloor || String(r.floor) === f.hkFloor) &&
    (!f.hkStatus || f.hkStatus === "all" || (f.hkStatus === "OOO" ? (r.hk === "OOO" || r.hk === "OOS") : r.hk === f.hkStatus)) &&
    (!f.hkOcc || f.hkOcc === "all" || (f.hkOcc === "DEP" && r.due === "DEP") || (f.hkOcc === "ARR" && r.due === "ARR") || (f.hkOcc === "SO" && r.occ === "OCC" && r.due !== "DEP") || (f.hkOcc === "VAC" && r.occ === "VAC")) &&
    (!f.hkAtt || (f.hkAtt === "none" ? !r.att : r.att === f.hkAtt)) &&
    (!f.hkFlag || (f.hkFlag === "vip" && r.vip) || (f.hkFlag === "rush" && r.rush) || (f.hkFlag === "dnd" && r.dnd)));
}
function roomTile(r) {
  const flags = (r.vip ? "⭐" : "") + (r.rush ? "⚡" : "") + (r.dnd ? "🚫" : "") + (r.pmDone ? "" : "");
  return `<button class="room ${r.hk}${U.sel.has(r.no) ? " sel" : ""}" data-act="room" data-no="${r.no}" title="Room ${r.no}: ${esc(D.HK_LABEL[r.hk])}, ${esc(occShort(r))}${r.att ? ", " + esc(sname(r.att)) : ""}">
    <span class="fl">${flags}</span><b>${r.no}</b><span class="o">${esc(occShort(r))}</span><span class="a">${r.att ? esc(firstName(r.att)) : "&nbsp;"}</span></button>`;
}
VIEWS.housekeeping = function () {
  const h = H(), f = U.f, tab = f.hkTab || "board";
  const rooms = filterRooms();
  const all = h.rooms;
  const cnt = s => all.filter(r => s === "OOO" ? (r.hk === "OOO" || r.hk === "OOS") : r.hk === s).length;
  const floors = [...new Set(all.map(r => r.floor))];
  const ras = h.staff.filter(s => s.role === "ra" && s.active);
  const edit = can("hkEdit");
  const statusSeg = [["all", "All", all.length], ["Dirty", "Dirty", cnt("Dirty")], ["Cleaning", "In progress", cnt("Cleaning")], ["Clean", "Clean", cnt("Clean")], ["Inspected", "Inspected", cnt("Inspected")], ["OOO", "Out of order", cnt("OOO")]];
  const cur = f.hkStatus || "all";
  let body = "";
  if (tab === "board") {
    body = floors.map(fl => {
      const list = rooms.filter(r => r.floor === fl);
      return list.length ? `<div class="floor"><h3>Floor ${fl} · ${list.filter(r => r.hk === "Clean" || r.hk === "Inspected").length}/${list.length} ready</h3><div class="rgrid">${list.map(roomTile).join("")}</div></div>` : "";
    }).join("") || `<div class="empty">No rooms match these filters.</div>`;
  } else if (tab === "list") {
    const lim = U.limit.hk || 60;
    body = `<div class="rows">${rooms.slice(0, lim).map(r => `<div class="row" data-act="room" data-no="${r.no}"><div><div class="t">Room ${r.no} <span style="font-weight:400;color:var(--ink-3)">· ${esc(r.type)}</span> ${r.vip ? chip("VIP", "purple") : ""} ${r.rush ? chip("Rush", "amber") : ""} ${r.dnd ? chip("DND", "dark") : ""}</div><div class="m"><span>${esc(occShort(r))}</span><span>${esc(sname(r.att))}</span>${r.note ? `<span>📝 ${esc(r.note)}</span>` : ""}<span>Updated ${esc(ago(r.updatedAt))}</span></div></div><div class="r">${hkChip(r.hk)}</div></div>`).join("") || `<div class="empty">No rooms match these filters.</div>`}
      ${rooms.length > lim ? `<div class="more-row"><button class="btn sm" data-act="more" data-k="hk">Show more (${rooms.length - lim} left)</button></div>` : ""}</div>`;
  } else {
    const unassigned = all.filter(r => (r.hk === "Dirty" || r.hk === "Cleaning") && !r.att);
    body = `<div class="filters">${can("hkEdit") && S.role !== "ra" ? `<button class="btn primary" data-act="hk-auto">⚖️ Auto-assign remaining rooms</button>` : ""}<button class="btn" data-act="hk-print">🖨️ Print assignment sheets</button>
      <span class="muted" style="font-size:13px">Credits: departure ${D.SERVICE_MIN.DEP} min, stayover ${D.SERVICE_MIN.SO} min, vacant touch-up ${D.SERVICE_MIN.VAC} min.</span></div>
      ${unassigned.length ? `<div class="panel" style="border-color:#f4dcb1;background:var(--warn-soft)"><b>${unassigned.length} rooms need cleaning but have no attendant:</b> ${unassigned.map(r => r.no).join(", ")}</div>` : ""}
      <div class="cols c3" style="margin-top:14px">${ras.map(s => {
        const mine = all.filter(r => r.att === s.id).sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true }));
        const done = mine.filter(r => r.hk === "Clean" || r.hk === "Inspected");
        const left = mine.filter(r => r.hk === "Dirty" || r.hk === "Cleaning");
        const mins = left.reduce((a, r) => a + D.serviceMinutes(r), 0);
        return `<div class="panel"><div class="ph">${avatar(s.id)}<div><h2>${esc(s.name)}</h2><div class="muted" style="font-size:12.5px">${mine.length} rooms · ${done.length} done · about ${dur(mins * MIN)} left</div></div></div>
          <div class="bar" style="margin-bottom:10px"><i style="width:${mine.length ? done.length / mine.length * 100 : 0}%"></i></div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">${mine.map(r => `<button class="st-chip ${r.hk}" style="border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:700" data-act="room" data-no="${r.no}" title="${esc(SERVICE_LABEL(r))}">${r.no}${r.due === "DEP" ? "·D" : ""}</button>`).join("") || `<span class="muted">No rooms assigned.</span>`}</div></div>`;
      }).join("")}</div>`;
  }
  const selBar = U.selecting ? `<div class="bulkbar"><b>${U.sel.size} selected</b>
      <select id="bulk-st">${opt([["", "Set status…"], ...D.HK_STATUSES.filter(s => s !== "OOO").map(s => [s, D.HK_LABEL[s]])], "")}</select>
      ${S.role !== "ra" ? `<select id="bulk-att"><option value="">Assign to…</option><option value="none">Unassign</option>${ras.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>` : ""}
      <button class="btn sm" data-act="hk-bulk-apply"${U.sel.size ? "" : " disabled"}>Apply</button><button class="btn sm" data-act="hk-sel-all">Select shown</button><button class="btn sm" data-act="hk-sel-done">Done</button></div>` : "";
  return `<div class="filters">
      <div class="seg">${[["board", "Board"], ["assign", "Assignments"], ["list", "List"]].map(([k, l]) => `<button class="${tab === k ? "active" : ""}" data-act="seg" data-k="hkTab" data-v="${k}">${l}</button>`).join("")}</div>
      <span class="grow" style="flex:1"></span>
      ${edit && tab !== "assign" ? `<button class="btn${U.selecting ? " primary" : ""}" data-act="hk-select">☑️ ${U.selecting ? "Selecting" : "Select rooms"}</button>` : ""}
    </div>
    ${tab !== "assign" ? `<div class="filters">
      <div class="seg">${statusSeg.map(([k, l, n]) => `<button class="${cur === k ? "active" : ""}" data-act="seg" data-k="hkStatus" data-v="${k}">${l}<span class="n">${n}</span></button>`).join("")}</div>
      <select data-f="hkFloor" aria-label="Floor"><option value="">All floors</option>${floors.map(x => `<option value="${x}"${String(x) === f.hkFloor ? " selected" : ""}>Floor ${x}</option>`).join("")}</select>
      <select data-f="hkOcc" aria-label="Occupancy">${opt([["all", "All occupancy"], ["DEP", "Due outs"], ["ARR", "Arrivals"], ["SO", "Stayovers"], ["VAC", "Vacant"]], f.hkOcc || "all")}</select>
      <select data-f="hkAtt" aria-label="Attendant"><option value="">All attendants</option><option value="none"${f.hkAtt === "none" ? " selected" : ""}>Unassigned</option>${ras.map(s => `<option value="${s.id}"${f.hkAtt === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
      <select data-f="hkFlag" aria-label="Flags">${opt([["", "Any flag"], ["vip", "⭐ VIP"], ["rush", "⚡ Rush"], ["dnd", "🚫 Do not disturb"]], f.hkFlag || "")}</select>
    </div>
    <div class="hk-legend">${["Dirty", "Cleaning", "Clean", "Inspected", "OOO"].map(s => `<span><i class="${s}"></i>${D.HK_LABEL[s]}</span>`).join("")}<span>⭐ VIP</span><span>⚡ Rush</span><span>🚫 DND</span><span>Showing ${rooms.length} of ${all.length}</span></div>` : ""}
    ${body}${selBar}`;
};
ACT["hk-select"] = () => { U.selecting = !U.selecting; U.sel.clear(); render(); };
ACT["hk-sel-done"] = () => { U.selecting = false; U.sel.clear(); render(); };
ACT["hk-sel-all"] = () => { filterRooms().forEach(r => U.sel.add(r.no)); render(); };
ACT["room"] = el => {
  const no = el.dataset.no;
  if (U.selecting && route().mod === "housekeeping") { U.sel.has(no) ? U.sel.delete(no) : U.sel.add(no); render(); return; }
  go("#/housekeeping/" + no);
};
ACT["hk-bulk-apply"] = () => {
  const st = document.getElementById("bulk-st").value, attEl = document.getElementById("bulk-att"), att = attEl ? attEl.value : "";
  if (!st && !att) { toast("Choose a status or an attendant first."); return; }
  const snap = [...U.sel].map(no => { const r = roomByNo(no); return [r, r.hk, r.att]; });
  snap.forEach(([r]) => { if (st && r.hk !== "OOO") setRoomStatus(r, st, true); if (att) r.att = att === "none" ? null : att; });
  logActivity(`updated ${snap.length} rooms${st ? " to " + D.HK_LABEL[st].toLowerCase() : ""}${att ? (att === "none" ? ", unassigned" : ", assigned to " + sname(att)) : ""}`, "#/housekeeping");
  touch(); U.sel.clear(); render();
  toast(`Updated ${snap.length} rooms`, () => { snap.forEach(([r, hk, a]) => { r.hk = hk; r.att = a; }); touch(); render(); });
};
ACT["hk-auto"] = () => {
  const h = H();
  const ras = h.staff.filter(s => s.role === "ra" && s.active).map(s => s.id);
  const snap = h.rooms.map(r => r.att);
  D.autoAssign(h.rooms, ras);
  logActivity("auto-assigned the remaining rooms across " + ras.length + " attendants", "#/housekeeping");
  touch(); render();
  toast("Rooms re-balanced across " + ras.length + " attendants", () => { h.rooms.forEach((r, i) => { r.att = snap[i]; }); touch(); render(); });
};
ACT["hk-print"] = () => {
  const h = H();
  const html = h.staff.filter(s => s.role === "ra" && s.active).map(s => {
    const mine = h.rooms.filter(r => r.att === s.id).sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true }));
    if (!mine.length) return "";
    return `<div class="pb"><h1>${esc(s.name)}</h1><p class="muted">${esc(dateOnly(Date.now()))} · ${mine.length} rooms · ${mine.reduce((a, r) => a + D.serviceMinutes(r), 0)} credit minutes</p>
      <table><thead><tr><th>Room</th><th>Type</th><th>Service</th><th>Status</th><th>Flags</th><th>Notes</th><th>Time in</th><th>Time out</th></tr></thead><tbody>${mine.map(r => `<tr><td><b>${r.no}</b></td><td>${esc(r.type)}</td><td>${esc(SERVICE_LABEL(r))}</td><td>${esc(D.HK_LABEL[r.hk])}</td><td>${r.vip ? "VIP " : ""}${r.rush ? "Rush " : ""}${r.dnd ? "DND" : ""}</td><td>${esc(r.note)}</td><td></td><td></td></tr>`).join("")}</tbody></table></div>`;
  }).join("");
  printDoc("Housekeeping assignment sheets", html || "<p>No assignments.</p>");
};

function setRoomStatus(r, st, quiet) {
  if (r.hk === st) return;
  const prev = r.hk;
  r.hk = st; r.updatedAt = Date.now();
  if (st === "Clean") r.cleanedBy = r.att || me().id;
  if (st === "Dirty" && (prev === "OOO" || prev === "OOS")) r.note = "";
  if (!quiet) logActivity(`marked room ${r.no} ${D.HK_LABEL[st].toLowerCase()}`, "#/housekeeping/" + r.no);
}
OPENERS.housekeeping = no => openRoom(no);
OPENERS.myrooms = no => openRoom(no);
function openRoom(no) {
  const r = roomByNo(no);
  if (!r) { toast("Room " + no + " not found."); return; }
  const h = H(), edit = can("hkEdit"), mgr = ["gm", "eh"].includes(S.role);
  const wos = h.workOrders.filter(w => w.location === r.no).slice(0, 5);
  const ins = h.inspections.filter(x => x.location === r.no).slice(0, 3);
  const reqs = h.requests.filter(x => x.room === r.no).slice(0, 3);
  const allowed = s => edit && (mgr || ["Dirty", "Cleaning", "Clean"].includes(s)) && s !== "OOO";
  const ras = h.staff.filter(s => s.role === "ra" && s.active);
  recordModal(route().mod === "myrooms" ? "myrooms" : "housekeeping", {
    title: `Room ${r.no} <span style="font-weight:500;color:var(--ink-3);font-size:15px">· ${esc(r.type)}</span>`, wide: true,
    body: `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${hkChip(r.hk)} ${chip(D.OCC_LABEL[r.occ])} ${r.due ? chip(D.DUE_LABEL[r.due], "blue") : ""} ${r.vip ? chip("VIP", "purple") : ""} ${r.rush ? chip("Rush", "amber") : ""} ${r.dnd ? chip("Do not disturb", "dark") : ""}</div>
      <div class="ph" style="margin-bottom:6px"><b>Set status</b></div>
      <div class="filters">${D.HK_STATUSES.map(s => `<button class="btn sm${r.hk === s ? " primary" : ""}" data-act="room-st" data-no="${r.no}" data-st="${s}"${s === "OOO" ? (edit || S.role === "ce" ? "" : " disabled") : allowed(s) ? "" : " disabled"}>${esc(D.HK_LABEL[s])}</button>`).join("")}</div>
      ${!edit ? `<p class="muted" style="font-size:13px">Your role can view room status. Housekeeping updates it.</p>` : ""}
      <div class="form" style="margin:12px 0">
        <div class="f"><label>Attendant</label><select id="rm-att"${mgr ? "" : " disabled"}><option value="">Unassigned</option>${ras.map(s => `<option value="${s.id}"${r.att === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div class="f"><label>Today</label><input type="text" value="${esc(SERVICE_LABEL(r))} · ${D.SERVICE_MIN[r.due === "DEP" ? "DEP" : r.occ === "OCC" ? "SO" : "VAC"]} credit min" disabled></div>
        <div class="f full"><label>Room note</label><input type="text" id="rm-note" value="${esc(r.note)}" placeholder="e.g. Guest requested extra pillows, feather-free"></div>
        <div class="f full check" style="flex-wrap:wrap;gap:16px">
          <label class="check" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rm-dnd"${r.dnd ? " checked" : ""}> Do not disturb</label>
          <label class="check" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rm-vip"${r.vip ? " checked" : ""}${mgr || S.role === "fd" ? "" : " disabled"}> VIP</label>
          <label class="check" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rm-rush"${r.rush ? " checked" : ""}${mgr || S.role === "fd" ? "" : " disabled"}> Rush (guest waiting)</label>
        </div>
      </div>
      <div class="filters">
        ${can("inspect") ? `<button class="btn" data-act="room-inspect" data-no="${r.no}">✅ Inspect room</button>` : ""}
        <button class="btn" data-act="room-wo" data-no="${r.no}">🔧 Report an issue</button>
        ${role().mods.includes("requests") ? `<button class="btn" data-act="room-req" data-no="${r.no}">🛎️ Guest request</button>` : ""}
        <button class="btn" data-act="room-lf" data-no="${r.no}">🧳 Found item</button>
      </div>
      <div class="cols c3" style="margin-top:6px">
        <div><h3 style="font-size:14px">Work orders</h3>${wos.length ? wos.map(w => `<div style="font-size:13px;margin-bottom:4px"><a href="#/workorders/${w.id}" data-act="nav" data-href="#/workorders/${w.id}">${w.id}</a> ${esc(w.title)} ${chip(w.status, WO_CHIP[w.status])}</div>`).join("") : `<div class="muted" style="font-size:13px">None</div>`}</div>
        <div><h3 style="font-size:14px">Inspections</h3>${ins.length ? ins.map(x => `<div style="font-size:13px;margin-bottom:4px">${esc(when(x.at))} · <b style="color:${x.score >= tplById(x.templateId).pass ? "var(--good)" : "var(--bad)"}">${x.score}%</b></div>`).join("") : `<div class="muted" style="font-size:13px">None</div>`}</div>
        <div><h3 style="font-size:14px">Guest requests</h3>${reqs.length ? reqs.map(x => `<div style="font-size:13px;margin-bottom:4px">${esc(x.title)} ${chip(x.status, REQ_CHIP[x.status])}</div>`).join("") : `<div class="muted" style="font-size:13px">None</div>`}</div>
      </div>
      <p class="muted" style="font-size:12.5px;margin:12px 0 0">Last updated ${esc(ago(r.updatedAt))}. Quarterly room PM: ${r.pmDone ? "done this cycle" : "not yet done this cycle"}.</p>`,
    foot: `<button class="btn" data-act="close-modal">Close</button><button class="btn primary" data-act="room-save" data-no="${r.no}">Save</button>`,
  });
}
ACT["room-st"] = el => {
  const r = roomByNo(el.dataset.no), st = el.dataset.st;
  if (st === "OOO") { closeModal(true); openWOForm({ location: r.no, oooRoom: true, priority: "High" }); return; }
  setRoomStatus(r, st); touch(); openRoom(r.no); render();
  toast(`Room ${r.no} is now ${D.HK_LABEL[st].toLowerCase()}`);
};
ACT["room-save"] = el => {
  const r = roomByNo(el.dataset.no);
  const att = document.getElementById("rm-att").value || null;
  if (att !== r.att) logActivity(`assigned room ${r.no} to ${sname(att)}`, "#/housekeeping/" + r.no);
  r.att = att; r.note = document.getElementById("rm-note").value.trim();
  r.dnd = document.getElementById("rm-dnd").checked; r.vip = document.getElementById("rm-vip").checked; r.rush = document.getElementById("rm-rush").checked;
  r.updatedAt = Date.now(); touch(); closeModal(); render(); toast(`Room ${r.no} saved`);
};
ACT["room-inspect"] = el => { closeModal(true); startInspection("T-ROOM", el.dataset.no); };
ACT["room-wo"] = el => { closeModal(true); openWOForm({ location: el.dataset.no }); };
ACT["room-req"] = el => { closeModal(true); openReqForm({ room: el.dataset.no }); };
ACT["room-lf"] = el => { closeModal(true); openLFForm({ location: "Room " + el.dataset.no }); };

/* ================= My rooms (room attendant) ================= */
VIEWS.myrooms = function () {
  const h = H(), m = me();
  const mine = h.rooms.filter(r => r.att === m.id);
  const order = r => (r.rush ? 0 : r.vip && r.due === "ARR" ? 1 : r.due === "DEP" ? 2 : 3);
  const left = mine.filter(r => r.hk === "Dirty" || r.hk === "Cleaning").sort((a, b) => (a.hk === "Cleaning" ? -1 : 0) - (b.hk === "Cleaning" ? -1 : 0) || order(a) - order(b) || a.no.localeCompare(b.no, undefined, { numeric: true }));
  const done = mine.filter(r => r.hk === "Clean" || r.hk === "Inspected");
  const mins = left.reduce((a, r) => a + D.serviceMinutes(r), 0);
  if (!mine.length) return `<div class="panel empty">No rooms are assigned to ${esc(m.name)} today. Your supervisor assigns rooms from the Housekeeping board.<br><br>${S.role === "ra" ? `<button class="btn" data-act="hk-auto">Ask for an auto-assignment</button>` : ""}</div>`;
  const card = r => `<div class="row static${r.hk === "Cleaning" ? " " : ""}" style="${r.hk === "Cleaning" ? "background:var(--warn-soft)" : ""}">
      <div><div class="t" style="font-size:18px">${r.no} <span style="font-size:13px;font-weight:500;color:var(--ink-3)">${esc(r.type)} · ${esc(SERVICE_LABEL(r))}</span> ${r.vip ? chip("VIP", "purple") : ""} ${r.rush ? chip("Rush", "amber") : ""} ${r.dnd ? chip("DND", "dark") : ""}</div>
      <div class="m">${hkChip(r.hk)}<span>${D.serviceMinutes(r)} min</span>${r.note ? `<span>📝 ${esc(r.note)}</span>` : ""}</div></div>
      <div class="r" style="flex-direction:row;flex-wrap:wrap;gap:6px">
        ${r.hk === "Dirty" ? `<button class="btn primary" data-act="my-start" data-no="${r.no}">▶ Start</button>` : r.hk === "Cleaning" ? `<button class="btn good" data-act="my-done" data-no="${r.no}">✓ Done</button>` : ""}
        ${r.hk === "Dirty" ? `<button class="btn" data-act="my-dnd" data-no="${r.no}">${r.dnd ? "Clear DND" : "🚫 DND"}</button>` : ""}
        <button class="btn" data-act="room-wo" data-no="${r.no}" title="Report a maintenance issue">🔧</button>
        <button class="btn" data-act="room-lf" data-no="${r.no}" title="Log a found item">🧳</button>
        <button class="btn" data-act="room" data-no="${r.no}" title="Room details">⋯</button>
      </div></div>`;
  return `<div class="kpis">
      <div class="kpi"><div class="label">Rooms left</div><div class="value">${left.length}</div><div class="sub">about ${dur(mins * MIN)} of work</div></div>
      <div class="kpi ok"><div class="label">Done today</div><div class="value">${done.length}</div><div class="sub">of ${mine.length} assigned</div></div>
      <div class="kpi"><div class="label">Departures</div><div class="value">${mine.filter(r => r.due === "DEP").length}</div><div class="sub">full cleans</div></div>
    </div>
    <div class="bar" style="height:12px;margin-bottom:14px"><i style="width:${done.length / mine.length * 100}%"></i></div>
    <div class="panel"><div class="ph"><h2>To do, in order</h2><span class="grow"></span><span class="muted" style="font-size:13px">Rush and VIP arrivals first</span></div>
      ${left.length ? `<div class="rows">${left.map(card).join("")}</div>` : `<div class="empty">All your rooms are done. Nice work! 🎉</div>`}</div>
    ${done.length ? `<div class="panel"><div class="ph"><h2>Done</h2></div><div class="rows">${done.map(card).join("")}</div></div>` : ""}`;
};
ACT["my-start"] = el => { const r = roomByNo(el.dataset.no); setRoomStatus(r, "Cleaning"); touch(); render(); toast(`Started room ${r.no}`); };
ACT["my-done"] = el => { const r = roomByNo(el.dataset.no); setRoomStatus(r, "Clean"); touch(); render(); toast(`Room ${r.no} is clean and ready for inspection`, () => { r.hk = "Cleaning"; touch(); render(); }); };
ACT["my-dnd"] = el => { const r = roomByNo(el.dataset.no); r.dnd = !r.dnd; if (r.dnd) logActivity(`flagged room ${r.no} do not disturb`, "#/housekeeping/" + r.no); touch(); render(); };

/* ================= Work orders ================= */
const woOf = id => H().workOrders.find(w => w.id === id);
function woFilters() {
  const f = U.f;
  if (f.woWho === undefined) f.woWho = S.role === "mt" ? "me" : "";
  if (f.woStatus === undefined) f.woStatus = "active";
  return f;
}
const PRI_RANK = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
function woList() {
  const f = woFilters(), m = me();
  const list = H().workOrders.filter(w =>
    (f.woStatus === "all" || (f.woStatus === "active" ? w.status !== "Completed" : f.woStatus === "overdue" ? isOverdue(w) : w.status === f.woStatus)) &&
    (!f.woPri || w.priority === f.woPri) && (!f.woCat || w.category === f.woCat) &&
    (!f.woWho || (f.woWho === "me" ? w.assignee === m.id : f.woWho === "none" ? !w.assignee : w.assignee === f.woWho)) &&
    (!f.woText || [w.id, w.title, w.location, w.desc].join(" ").toLowerCase().includes(f.woText.toLowerCase())));
  // Open work: overdue first, then by priority and due time. Finished work: newest first.
  if (f.woStatus !== "Completed" && f.woStatus !== "all") list.sort((a, b) => isOverdue(b) - isOverdue(a) || PRI_RANK[a.priority] - PRI_RANK[b.priority] || a.dueAt - b.dueAt);
  return list;
}
function woRow(w) {
  const od = isOverdue(w);
  return `<div class="row${od ? " overdue" : ""}" data-act="nav" data-href="#/workorders/${w.id}"><div><div class="t"><span class="id">${w.id}</span>${esc(w.title)} ${w.oooRoom && w.status !== "Completed" ? chip("Room OOO", "dark") : ""}${w.photo ? " 📷" : ""}</div>
    <div class="m"><span>📍 ${/^\d+$/.test(w.location) ? "Room " : ""}${esc(w.location)}</span><span>${esc(w.category)}</span><span>👤 ${esc(sname(w.assignee))}</span><span>${w.status === "Completed" ? "Done " + esc(when(w.completedAt)) : od ? `<b style="color:var(--bad)">Overdue ${esc(dur(Date.now() - w.dueAt))}</b>` : "Due " + esc(when(w.dueAt))}</span></div></div>
    <div class="r">${priChip(w.priority)}${chip(w.status, WO_CHIP[w.status])}</div></div>`;
}
VIEWS.workorders = function () {
  const h = H(), f = woFilters(), m = me();
  const view = f.woView || "list";
  const list = woList();
  const all = h.workOrders;
  const segs = [["active", "Active", all.filter(w => w.status !== "Completed").length], ["Open", "Open", all.filter(w => w.status === "Open").length], ["In progress", "In progress", all.filter(w => w.status === "In progress").length], ["On hold", "On hold", all.filter(w => w.status === "On hold").length], ["overdue", "Overdue", all.filter(isOverdue).length], ["Completed", "Completed", all.filter(w => w.status === "Completed").length], ["all", "All", all.length]];
  const eng = h.staff.filter(s => s.dept === "Engineering" && s.active);
  const lim = U.limit.wo || 50;
  let body;
  if (view === "board") {
    const recent = list.filter(w => w.status !== "Completed" || w.completedAt > Date.now() - DAY);
    body = `<div class="kanban">${D.WO_STATUS.map(st => { const col = recent.filter(w => w.status === st); return `<div class="kcol" data-col="${st}"><h3><span>${st}</span><span class="muted">${col.length}</span></h3>${col.map(w => `<div class="kcard" draggable="${can("woManage")}" data-id="${w.id}" data-act="nav" data-href="#/workorders/${w.id}" style="${isOverdue(w) ? "border-left:3px solid var(--bad)" : ""}"><div class="t">${esc(w.title)}</div><div class="m"><span class="id" style="font-family:'JetBrains Mono',monospace">${w.id}</span><span>📍 ${esc(w.location)}</span>${priChip(w.priority)}<span>👤 ${esc(firstName(w.assignee) || "Unassigned")}</span></div></div>`).join("") || `<div class="muted" style="font-size:13px;padding:6px">Nothing here</div>`}</div>`; }).join("")}</div>
      ${can("woManage") ? `<p class="muted" style="font-size:13px;margin-top:6px">Drag a card to another column to change its status. Completed shows the last 24 hours.</p>` : ""}`;
  } else {
    body = `<div class="rows">${list.slice(0, lim).map(woRow).join("") || `<div class="empty">No work orders match these filters.</div>`}${list.length > lim ? `<div class="more-row"><button class="btn sm" data-act="more" data-k="wo">Show more (${list.length - lim} left)</button></div>` : ""}</div>`;
  }
  const done7 = all.filter(w => w.completedAt && w.completedAt > Date.now() - 7 * DAY);
  const avgH = done7.length ? done7.reduce((a, w) => a + (w.completedAt - w.createdAt), 0) / done7.length : null;
  const onTime = done7.length ? done7.filter(w => w.completedAt <= w.dueAt).length / done7.length : null;
  return `<div class="kpis">
      <a class="kpi" href="#/workorders" data-act="seg" data-k="woStatus" data-v="active"><div class="label">Active</div><div class="value">${all.filter(w => w.status !== "Completed").length}</div><div class="sub">${all.filter(w => w.status !== "Completed" && w.assignee === m.id).length} assigned to me</div></a>
      <a class="kpi ${all.filter(isOverdue).length ? "alert" : "ok"}" href="#/workorders" data-act="seg" data-k="woStatus" data-v="overdue"><div class="label">Overdue</div><div class="value">${all.filter(isOverdue).length}</div><div class="sub">past due time</div></a>
      <div class="kpi"><div class="label">Avg time to complete</div><div class="value">${avgH == null ? "–" : dur(avgH)}</div><div class="sub">last 7 days</div></div>
      <div class="kpi"><div class="label">Completed on time</div><div class="value">${pct(onTime)}</div><div class="sub">${done7.length} completed in 7 days</div></div>
    </div>
    <div class="filters"><div class="seg">${segs.map(([k, l, n]) => `<button class="${f.woStatus === k ? "active" : ""}" data-act="seg" data-k="woStatus" data-v="${k}">${l}<span class="n">${n}</span></button>`).join("")}</div></div>
    <div class="filters">
      <input type="search" data-f="woText" placeholder="Filter by title, room or ID" value="${esc(f.woText || "")}" style="width:220px">
      <select data-f="woWho" aria-label="Assignee"><option value="">Anyone</option><option value="me"${f.woWho === "me" ? " selected" : ""}>Assigned to me</option><option value="none"${f.woWho === "none" ? " selected" : ""}>Unassigned</option>${eng.map(s => `<option value="${s.id}"${f.woWho === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
      <select data-f="woPri" aria-label="Priority"><option value="">Any priority</option>${opt(D.PRIORITIES, f.woPri)}</select>
      <select data-f="woCat" aria-label="Category"><option value="">Any category</option>${opt(Object.keys(D.WO_CATS), f.woCat)}</select>
      <span style="flex:1"></span>
      <div class="seg"><button class="${view === "list" ? "active" : ""}" data-act="seg" data-k="woView" data-v="list">☰ List</button><button class="${view === "board" ? "active" : ""}" data-act="seg" data-k="woView" data-v="board">▦ Board</button></div>
      <button class="btn" data-act="wo-csv">⬇ CSV</button>
      <button class="btn primary" data-act="wo-new">＋ Work order</button>
    </div>${body}`;
};
VIEWS.workorders_after = function (view) {
  // Drag and drop between kanban columns.
  view.querySelectorAll(".kcard[draggable=true]").forEach(c => c.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", c.dataset.id); }));
  view.querySelectorAll(".kcol").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("over"); });
    col.addEventListener("dragleave", () => col.classList.remove("over"));
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("over");
      const w = woOf(e.dataTransfer.getData("text/plain")), st = col.dataset.col;
      if (!w || w.status === st) return;
      if (st === "Completed") { openWOComplete(w.id); return; }
      if (st === "On hold") { openWOHold(w.id); return; }
      setWOStatus(w, st); touch(); render();
    });
  });
  const t = view.querySelector('[data-f="woText"]');
  if (t && U.f._focusWo) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); U.f._focusWo = false; }
};
ACT["wo-new"] = () => openWOForm();
ACT["wo-csv"] = () => csvDownload(`work-orders-${S.hotel}.csv`, [["ID", "Title", "Location", "Category", "Priority", "Status", "Assigned to", "Created", "Due", "Completed", "Minutes", "Parts cost", "Source"],
  ...woList().map(w => [w.id, w.title, w.location, w.category, w.priority, w.status, sname(w.assignee), new Date(w.createdAt).toISOString(), new Date(w.dueAt).toISOString(), w.completedAt ? new Date(w.completedAt).toISOString() : "", w.minutes, w.partsCost, w.source])]);

function setWOStatus(w, st, note) {
  const now = Date.now();
  w.status = st;
  if (st === "In progress" && !w.startedAt) w.startedAt = now;
  if (st !== "Completed") w.completedAt = null;
  if (st !== "On hold") delete w.holdReason;
  w.notes.push({ t: now, by: me().id, text: note || "Status changed to " + st });
  logActivity(`moved ${w.id} to ${st.toLowerCase()}`, "#/workorders/" + w.id);
}
function locationList() { return [...H().rooms.map(r => r.no), ...D.AREAS]; }
function openWOForm(pre = {}) {
  const h = H();
  const eng = h.staff.filter(s => s.dept === "Engineering" && s.active);
  const dueDefault = new Date(Date.now() + D.DUE_HOURS[pre.priority || "Normal"] * HOUR);
  const local = d => new Date(d.getTime() - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  modal({
    title: "New work order", wide: true,
    body: `<div class="form" id="wo-form">
      <div class="f full"><label for="wo-title">What needs fixing? *</label><input type="text" id="wo-title" name="title" value="${esc(pre.title || "")}" placeholder="e.g. Bathroom sink draining slowly" list="wo-titles"><datalist id="wo-titles">${Object.values(D.WO_CATS).flat().map(t => `<option value="${esc(t)}">`).join("")}</datalist></div>
      <div class="f"><label>Location *</label><input type="text" name="location" value="${esc(pre.location || "")}" list="wo-locs" placeholder="Room number or area"><datalist id="wo-locs">${locationList().map(l => `<option value="${esc(l)}">`).join("")}</datalist></div>
      <div class="f"><label>Category</label><select name="category">${opt(Object.keys(D.WO_CATS), pre.category || guessCategory(pre.title || ""))}</select></div>
      <div class="f"><label>Priority</label><select name="priority" id="wo-pri">${opt(D.PRIORITIES, pre.priority || "Normal")}</select></div>
      <div class="f"><label>Due</label><input type="datetime-local" name="due" id="wo-due" value="${local(dueDefault)}"></div>
      ${can("woAssign") ? `<div class="f"><label>Assign to</label><select name="assignee"><option value="">Unassigned (engineering queue)</option>${eng.map(s => `<option value="${s.id}">${esc(s.name)} · ${esc(D.ROLES[s.role].name)}</option>`).join("")}</select></div>` : `<div class="f"><label>Assign to</label><input type="text" disabled value="Engineering will assign"></div>`}
      <div class="f"><label>Equipment (optional)</label><select name="assetId"><option value="">None</option>${h.assets.map(a => `<option value="${a.id}"${pre.assetId === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
      <div class="f full"><label>Details</label><textarea name="desc" placeholder="What did you see? Anything the technician should know?">${esc(pre.desc || "")}</textarea></div>
      <div class="f"><label>Photo (optional)</label><input type="file" accept="image/*" capture="environment" id="wo-photo"></div>
      <div class="f check" style="align-self:end"><input type="checkbox" name="oooRoom" id="wo-ooo"${pre.oooRoom ? " checked" : ""}><label for="wo-ooo" style="font-weight:500">Take the room out of order until fixed</label></div>
    </div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="wo-save">Create work order</button>`,
  });
  const box = modalEl();
  box.querySelector("#wo-pri").onchange = e => { box.querySelector("#wo-due").value = local(new Date(Date.now() + D.DUE_HOURS[e.target.value] * HOUR)); };
  box.querySelector("#wo-title").onchange = e => { const c = guessCategory(e.target.value); if (c) box.querySelector("[name=category]").value = c; };
  box.querySelector("#wo-save").onclick = async () => {
    const v = readForm(box.querySelector("#wo-form"));
    if (!v.title || !v.location) { toast("Please add what needs fixing and where."); return; }
    const photoFile = box.querySelector("#wo-photo").files[0];
    const photo = photoFile ? await shrinkImage(photoFile) : null;
    const now = Date.now(), id = nextId("WO");
    const w = { id, title: v.title, category: v.category, location: v.location, priority: v.priority, status: "Open", assignee: v.assignee || null, createdBy: me().id, createdAt: now,
      dueAt: v.due ? new Date(v.due).getTime() : now + D.DUE_HOURS[v.priority] * HOUR, startedAt: null, completedAt: null, minutes: 0, partsCost: 0, oooRoom: false,
      source: pre.source || "Staff", photo, desc: v.desc, assetId: v.assetId || null, reqId: pre.reqId || null, pmId: pre.pmId || null, notes: [{ t: now, by: me().id, text: "Work order created" }] };
    if (w.assignee) w.notes.push({ t: now, by: me().id, text: "Assigned to " + sname(w.assignee) });
    const room = roomByNo(v.location);
    if (v.oooRoom && room) { w.oooRoom = true; room.hk = "OOO"; room.note = v.title; room.updatedAt = now; w.notes.push({ t: now, by: me().id, text: `Room ${room.no} placed out of order` }); }
    if (pre.reqId) { const r = H().requests.find(x => x.id === pre.reqId); if (r) { r.woId = id; r.notes.push({ t: now, by: me().id, text: "Work order " + id + " created" }); } }
    H().workOrders.unshift(w);
    logActivity(`created work order ${id}: ${w.title} (${w.location})`, "#/workorders/" + id);
    touch(); closeModal(true); render();
    toast(`Created ${id}${w.oooRoom ? `, room ${room.no} is out of order` : ""}`);
  };
}
function guessCategory(title) {
  const t = title.toLowerCase();
  for (const [cat, list] of Object.entries(D.WO_CATS)) if (list.some(x => x.toLowerCase() === t)) return cat;
  const kw = [["Plumbing", /leak|drain|toilet|faucet|tub|shower|water|clog/], ["HVAC", /ac\b|air|cool|heat|thermostat|hvac|vent|warm|cold/], ["Electrical", /light|lamp|outlet|power|bulb|usb/], ["TV & Wi-Fi", /tv|wi-?fi|remote|internet|cast/], ["Doors & locks", /door|lock|key|safe/], ["Appliances", /fridge|coffee|dryer|iron|microwave|ice/], ["Life safety", /smoke|fire|exit|alarm|emergency/], ["Furniture & fixtures", /chair|desk|drawer|bed|curtain|closet|table/], ["Finishes", /paint|stain|carpet|caulk|grout|wall|scuff/]];
  const hit = kw.find(([, re]) => re.test(t));
  return hit ? hit[0] : "";
}
function shrinkImage(file) {
  return new Promise(res => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 720 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.68));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
OPENERS.workorders = id => openWO(id);
function openWO(id) {
  const w = woOf(id);
  if (!w) { toast(id + " not found."); return; }
  const h = H(), mine = w.assignee === me().id, manage = can("woManage") || mine;
  const eng = h.staff.filter(s => s.dept === "Engineering" && s.active);
  const asset = w.assetId && h.assets.find(a => a.id === w.assetId);
  const req = w.reqId ? h.requests.find(r => r.id === w.reqId) : h.requests.find(r => r.woId === w.id);
  const od = isOverdue(w);
  let actions = "";
  if (manage) {
    if (w.status === "Open") actions = `<button class="btn" data-act="wo-hold" data-id="${w.id}">⏸ Hold</button><button class="btn primary" data-act="wo-st" data-id="${w.id}" data-st="In progress">▶ Start work</button>`;
    if (w.status === "In progress") actions = `<button class="btn" data-act="wo-hold" data-id="${w.id}">⏸ Hold</button><button class="btn good" data-act="wo-complete" data-id="${w.id}">✓ Complete</button>`;
    if (w.status === "On hold") actions = `<button class="btn primary" data-act="wo-st" data-id="${w.id}" data-st="In progress">▶ Resume</button>`;
    if (w.status === "Completed") actions = `<button class="btn" data-act="wo-st" data-id="${w.id}" data-st="Open">↺ Reopen</button>`;
  }
  recordModal("workorders", {
    title: `<span class="id" style="font-family:'JetBrains Mono',monospace;color:var(--ink-3);font-size:14px">${w.id}</span> ${esc(w.title)}`, wide: true,
    body: `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${chip(w.status, WO_CHIP[w.status])}${priChip(w.priority)}${od ? chip("Overdue " + dur(Date.now() - w.dueAt), "red") : ""}${w.oooRoom && w.status !== "Completed" ? chip("Room out of order", "dark") : ""}</div>
      <dl class="kv">
        <dt>Location</dt><dd>${roomByNo(w.location) ? `<a href="#/housekeeping/${w.location}" data-act="nav" data-href="#/housekeeping/${w.location}">Room ${esc(w.location)}</a>` : esc(w.location)}</dd>
        <dt>Category</dt><dd>${esc(w.category)}</dd>
        <dt>Assigned to</dt><dd>${can("woAssign") ? `<select id="wo-assign" style="width:auto"><option value="">Unassigned</option>${eng.map(s => `<option value="${s.id}"${w.assignee === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select>` : esc(sname(w.assignee))}</dd>
        <dt>Reported</dt><dd>${esc(when(w.createdAt))} by ${esc(sname(w.createdBy))} · ${esc(w.source)}</dd>
        <dt>Due</dt><dd>${esc(when(w.dueAt))}</dd>
        ${w.startedAt ? `<dt>Started</dt><dd>${esc(when(w.startedAt))}</dd>` : ""}
        ${w.completedAt ? `<dt>Completed</dt><dd>${esc(when(w.completedAt))} · ${dur(w.completedAt - w.createdAt)} after report</dd><dt>Labour and parts</dt><dd>${w.minutes} min · ${money(w.partsCost, 2)} parts · ${money(w.minutes / 60 * LABOUR_RATE + w.partsCost, 2)} total</dd>` : ""}
        ${w.holdReason ? `<dt>On hold</dt><dd>${esc(w.holdReason)}</dd>` : ""}
        ${asset ? `<dt>Equipment</dt><dd><a href="#/assets/${asset.id}" data-act="nav" data-href="#/assets/${asset.id}">${esc(asset.name)}</a></dd>` : ""}
        ${req ? `<dt>Guest request</dt><dd><a href="#/requests/${req.id}" data-act="nav" data-href="#/requests/${req.id}">${req.id}</a> · ${esc(req.guest)}</dd>` : ""}
      </dl>
      ${w.desc ? `<p style="white-space:pre-wrap">${esc(w.desc)}</p>` : ""}
      ${w.photo ? `<img class="thumb" src="${w.photo}" alt="Photo attached to ${w.id}">` : ""}
      <h3 style="font-size:14px;margin-top:14px">Activity</h3>
      <ul class="feed">${w.notes.slice().reverse().map(n => `<li>${avatar(n.by)}<div><div><b>${esc(sname(n.by))}</b> ${esc(n.text)}</div><div class="w">${esc(when(n.t))}</div></div></li>`).join("")}</ul>
      <div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="wo-note" placeholder="Add a note or update" style="flex:1"><button class="btn" data-act="wo-note" data-id="${w.id}">Add</button></div>`,
    foot: `<button class="btn" data-act="wo-print" data-id="${w.id}">🖨️ Print ticket</button><span class="grow"></span>${actions}`,
  });
  const sel = modalEl().querySelector("#wo-assign");
  if (sel) sel.onchange = () => { w.assignee = sel.value || null; w.notes.push({ t: Date.now(), by: me().id, text: w.assignee ? "Assigned to " + sname(w.assignee) : "Unassigned" }); logActivity(`assigned ${w.id} to ${sname(w.assignee)}`, "#/workorders/" + w.id); touch(); openWO(w.id); render(); };
  const note = modalEl().querySelector("#wo-note");
  note.addEventListener("keydown", e => { if (e.key === "Enter") ACT["wo-note"]({ dataset: { id: w.id } }); });
}
ACT["wo-st"] = el => { const w = woOf(el.dataset.id); setWOStatus(w, el.dataset.st); touch(); openWO(w.id); render(); toast(`${w.id} is now ${w.status.toLowerCase()}`); };
ACT["wo-note"] = el => { const w = woOf(el.dataset.id), inp = document.getElementById("wo-note"); if (!inp.value.trim()) return; w.notes.push({ t: Date.now(), by: me().id, text: inp.value.trim() }); touch(); openWO(w.id); };
ACT["wo-hold"] = el => openWOHold(el.dataset.id);
ACT["wo-complete"] = el => openWOComplete(el.dataset.id);
ACT["wo-print"] = el => {
  const w = woOf(el.dataset.id);
  printDoc(w.id, `<h1>Work order ${w.id}</h1><p class="muted">${esc(w.priority)} priority · ${esc(w.status)}</p><table><tbody>
    <tr><th>Title</th><td>${esc(w.title)}</td></tr><tr><th>Location</th><td>${esc(w.location)}</td></tr><tr><th>Category</th><td>${esc(w.category)}</td></tr>
    <tr><th>Assigned to</th><td>${esc(sname(w.assignee))}</td></tr><tr><th>Reported</th><td>${esc(when(w.createdAt))} by ${esc(sname(w.createdBy))}</td></tr><tr><th>Due</th><td>${esc(when(w.dueAt))}</td></tr>
    <tr><th>Details</th><td>${esc(w.desc)}</td></tr></tbody></table><h2>Work done</h2><table><tbody><tr><th style="width:30%">Time spent</th><td style="height:28px"></td></tr><tr><th>Parts used</th><td style="height:28px"></td></tr><tr><th>Signed off by</th><td style="height:28px"></td></tr></tbody></table>`);
};
function openWOHold(id) {
  const w = woOf(id);
  modal({ title: `Put ${w.id} on hold`, body: `<div class="form"><div class="f full"><label>Reason</label><select id="hold-r">${opt(["Waiting for parts", "Guest in room, retry later", "Contractor booked", "Needs manager approval", "Other"], "")}</select></div><div class="f full"><label>Note</label><input type="text" id="hold-n" placeholder="Optional"></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="hold-go">Put on hold</button>` });
  modalEl().querySelector("#hold-go").onclick = () => {
    const r = document.getElementById("hold-r").value, n = document.getElementById("hold-n").value.trim();
    setWOStatus(w, "On hold", "On hold: " + r + (n ? ". " + n : "")); w.holdReason = r + (n ? ". " + n : "");
    touch(); closeModal(true); render(); toast(`${w.id} on hold`);
  };
}
function openWOComplete(id) {
  const w = woOf(id), h = H();
  const parts = h.inventory.filter(i => i.category === "Engineering parts");
  modal({ title: `Complete ${w.id}`, body: `<div class="form">
      <div class="f"><label>Time spent (minutes)</label><input type="number" id="wc-min" min="0" value="${w.minutes || 30}"></div>
      <div class="f"><label>Other parts cost ($)</label><input type="number" id="wc-cost" min="0" step="0.01" value="0"></div>
      <div class="f"><label>Part from stock (optional)</label><select id="wc-part"><option value="">None</option>${parts.map(p => `<option value="${p.id}">${esc(p.name)} (${p.onHand} on hand)</option>`).join("")}</select></div>
      <div class="f"><label>Quantity used</label><input type="number" id="wc-qty" min="1" value="1"></div>
      <div class="f full"><label>What was done?</label><textarea id="wc-note" placeholder="e.g. Replaced flapper and tested"></textarea></div>
      ${w.oooRoom ? `<div class="f full"><div class="takeaway" style="margin:0">Room ${esc(w.location)} will go back to housekeeping as <b>dirty</b> so it can be cleaned and inspected before it is sold.</div></div>` : ""}
    </div>`, foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn good" id="wc-go">✓ Mark complete</button>` });
  modalEl().querySelector("#wc-go").onclick = () => {
    const mins = Math.max(0, +document.getElementById("wc-min").value || 0);
    let cost = Math.max(0, +document.getElementById("wc-cost").value || 0);
    const partId = document.getElementById("wc-part").value, qty = Math.max(1, +document.getElementById("wc-qty").value || 1);
    const note = document.getElementById("wc-note").value.trim();
    const now = Date.now();
    if (partId) {
      const p = h.inventory.find(i => i.id === partId);
      p.onHand = Math.max(0, p.onHand - qty); cost += p.cost * qty;
      h.invTx.unshift({ t: now, itemId: p.id, qty: -qty, by: me().id, reason: "Used on " + w.id });
    }
    w.minutes = mins; w.partsCost = Math.round(cost * 100) / 100;
    setWOStatus(w, "Completed", "Completed" + (note ? ". " + note : ""));
    w.completedAt = now; if (!w.startedAt) w.startedAt = now;
    let extra = "";
    if (w.oooRoom) { const r = roomByNo(w.location); if (r && r.hk === "OOO") { r.hk = "Dirty"; r.note = "Back from maintenance: " + w.title; r.updatedAt = now; extra = `, room ${r.no} sent to housekeeping`; } }
    if (w.pmId) { const p = h.pm.find(x => x.id === w.pmId); if (p) completePM(p, mins, "Via " + w.id); }
    logActivity(`completed ${w.id}: ${w.title}`, "#/workorders/" + w.id);
    touch(); closeModal(true); openWO(w.id); render(); toast(`${w.id} completed${extra}`);
  };
}

/* ================= Preventive maintenance ================= */
const pmOf = id => H().pm.find(p => p.id === id);
const assetName = id => ((H().assets.find(a => a.id === id)) || {}).name || "";
function pmDueChip(p) {
  const d = p.nextDue - Date.now();
  if (d < 0) return chip("Overdue " + dur(-d), "red");
  if (d < 7 * DAY) return chip("Due " + (d < DAY ? "today" : "in " + dur(d)), "amber");
  return chip("Due " + shortDay(p.nextDue), "green");
}
VIEWS.pm = function () {
  const h = H(), now = Date.now(), f = U.f;
  const win = f.pmWin || "all";
  const list = h.pm.filter(p => win === "all" || (win === "overdue" ? p.nextDue < now : win === "7" ? p.nextDue < now + 7 * DAY : p.nextDue < now + 30 * DAY)).sort((a, b) => a.nextDue - b.nextDue);
  const rooms = h.rooms, doneRooms = rooms.filter(r => r.pmDone).length;
  const roomTask = h.pm.find(p => p.roomCycle);
  const cycleStart = roomTask ? roomTask.lastDone : now;
  const done30 = h.pm.reduce((a, p) => a + p.history.filter(x => x.t > now - 30 * DAY).length, 0);
  const compliance = h.pm.filter(p => p.nextDue >= now).length / h.pm.length;
  const floors = [...new Set(rooms.map(r => r.floor))];
  return `<div class="kpis">
      <div class="kpi ${h.pm.filter(p => p.nextDue < now).length ? "alert" : "ok"}"><div class="label">Overdue tasks</div><div class="value">${h.pm.filter(p => p.nextDue < now).length}</div><div class="sub">of ${h.pm.length} scheduled tasks</div></div>
      <div class="kpi"><div class="label">Due next 7 days</div><div class="value">${h.pm.filter(p => p.nextDue >= now && p.nextDue < now + 7 * DAY).length}</div><div class="sub">plan the week</div></div>
      <div class="kpi"><div class="label">Completed, 30 days</div><div class="value">${done30}</div><div class="sub">PM tasks signed off</div></div>
      <div class="kpi"><div class="label">Compliance</div><div class="value">${pct(compliance)}</div><div class="sub">tasks not overdue</div></div>
    </div>
    <div class="cols c21">
      <div class="panel"><div class="ph"><h2>Scheduled tasks</h2><span class="grow"></span>
        <div class="seg">${[["overdue", "Overdue"], ["7", "7 days"], ["30", "30 days"], ["all", "All"]].map(([k, l]) => `<button class="${win === k ? "active" : ""}" data-act="seg" data-k="pmWin" data-v="${k}">${l}</button>`).join("")}</div>
        ${can("pmEdit") ? `<button class="btn primary sm" data-act="pm-new">＋ Task</button>` : ""}</div>
        <div class="rows">${list.map(p => `<div class="row${p.nextDue < now ? " overdue" : ""}" data-act="nav" data-href="#/pm/${p.id}"><div><div class="t">${esc(p.title)}</div><div class="m"><span>${p.roomCycle ? "All guest rooms" : "⚙️ " + esc(assetName(p.assetId))}</span><span>Every ${freqLabel(p.freqDays)}</span><span>👤 ${esc(sname(p.assignee))}</span><span>Last done ${esc(shortDay(p.lastDone))}</span></div></div><div class="r">${pmDueChip(p)}</div></div>`).join("") || `<div class="empty">Nothing due in this window.</div>`}</div>
      </div>
      <div class="panel"><div class="ph"><h2>Room PM cycle</h2><span class="grow"></span><b>${pct(doneRooms / rooms.length)}</b></div>
        <p class="muted" style="font-size:13px">Every guest room gets a 20-point check each quarter. This cycle started ${esc(shortDay(cycleStart))}: ${doneRooms} of ${rooms.length} rooms done.</p>
        <div class="bar" style="height:12px;margin-bottom:10px"><i style="width:${doneRooms / rooms.length * 100}%"></i></div>
        ${floors.map(fl => { const fr = rooms.filter(r => r.floor === fl), d = fr.filter(r => r.pmDone).length; return `<div class="prog"><span>Floor ${fl}</span><div class="bar blue"><i style="width:${d / fr.length * 100}%"></i></div><span class="r">${d}/${fr.length}</span></div>`; }).join("")}
        ${can("pmEdit") ? `<button class="btn primary" style="margin-top:12px;width:100%;justify-content:center" data-act="pm-room">Log a room PM</button>` : ""}
      </div>
    </div>`;
};
const freqLabel = d => d === 1 ? "day" : d === 7 ? "week" : d === 30 ? "month" : d === 90 ? "quarter" : d === 365 ? "year" : d + " days";
ACT["pm-new"] = () => {
  const h = H(), eng = h.staff.filter(s => s.dept === "Engineering" && s.active);
  modal({ title: "New preventive maintenance task", body: `<div class="form" id="pm-form">
      <div class="f full"><label>Task *</label><input type="text" name="title" placeholder="e.g. Clean ice machine condenser"></div>
      <div class="f"><label>Equipment</label><select name="assetId"><option value="">None / general</option>${h.assets.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></div>
      <div class="f"><label>Repeats every</label><select name="freq">${opt([["1", "Day"], ["7", "Week"], ["14", "2 weeks"], ["30", "Month"], ["90", "Quarter"], ["180", "6 months"], ["365", "Year"]], "30")}</select></div>
      <div class="f"><label>Assigned to</label><select name="assignee">${eng.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
      <div class="f"><label>Estimated minutes</label><input type="number" name="mins" value="30" min="5"></div>
      <div class="f"><label>First due</label><input type="date" name="first" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="f full"><label>Checklist (one step per line)</label><textarea name="checklist" placeholder="Step 1&#10;Step 2"></textarea></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="pm-go">Add task</button>` });
  modalEl().querySelector("#pm-go").onclick = () => {
    const v = readForm(modalEl().querySelector("#pm-form"));
    if (!v.title) { toast("Please name the task."); return; }
    const freq = +v.freq, first = new Date(v.first + "T09:00").getTime() || Date.now();
    const p = { id: nextId("PM"), title: v.title, assetId: v.assetId || null, roomCycle: false, freqDays: freq, estMinutes: +v.mins || 30, checklist: v.checklist.split("\n").map(s => s.trim()).filter(Boolean), assignee: v.assignee, lastDone: first - freq * DAY, nextDue: first, history: [] };
    h.pm.push(p); logActivity(`added PM task: ${p.title}`, "#/pm/" + p.id); touch(); closeModal(true); render(); toast("PM task added");
  };
};
function completePM(p, mins, note) {
  const now = Date.now();
  p.history.unshift({ t: now, by: me().id, minutes: mins, note });
  p.lastDone = now; p.nextDue = now + p.freqDays * DAY;
  logActivity(`completed PM: ${p.title}`, "#/pm/" + p.id);
}
OPENERS.pm = id => openPM(id);
function openPM(id) {
  const p = pmOf(id);
  if (!p) return;
  const h = H(), edit = can("pmEdit");
  const eng = h.staff.filter(s => s.dept === "Engineering" && s.active);
  recordModal("pm", { title: esc(p.title), wide: true,
    body: `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${pmDueChip(p)}${chip("Every " + freqLabel(p.freqDays), "blue")}${chip("About " + p.estMinutes + " min")}</div>
      <dl class="kv"><dt>Equipment</dt><dd>${p.roomCycle ? "All guest rooms (use Log a room PM)" : p.assetId ? `<a href="#/assets/${p.assetId}" data-act="nav" data-href="#/assets/${p.assetId}">${esc(assetName(p.assetId))}</a>` : "General"}</dd>
      <dt>Assigned to</dt><dd>${edit ? `<select id="pm-as" style="width:auto">${eng.map(s => `<option value="${s.id}"${p.assignee === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select>` : esc(sname(p.assignee))}</dd>
      <dt>Last done</dt><dd>${esc(dateOnly(p.lastDone))}</dd><dt>Next due</dt><dd>${esc(dateOnly(p.nextDue))}</dd></dl>
      ${p.roomCycle ? "" : `<h3 style="font-size:14px">Checklist</h3><div id="pm-chk">${p.checklist.map((c, i) => `<label class="chk" style="cursor:pointer"><span>${esc(c)}</span><input type="checkbox" data-i="${i}" style="width:20px;height:20px"></label>`).join("") || `<div class="muted">No checklist steps.</div>`}</div>
      ${edit ? `<div class="form" style="margin-top:10px"><div class="f"><label>Minutes taken</label><input type="number" id="pm-min" value="${p.estMinutes}" min="0"></div><div class="f"><label>Note</label><input type="text" id="pm-note" placeholder="Readings, issues found"></div></div>` : ""}`}
      <h3 style="font-size:14px;margin-top:14px">History</h3>${p.history.length ? `<div class="tblw"><table><thead><tr><th>Date</th><th>By</th><th class="num">Minutes</th><th>Note</th></tr></thead><tbody>${p.history.slice(0, 8).map(x => `<tr><td>${esc(dateOnly(x.t))}</td><td>${esc(sname(x.by))}</td><td class="num">${x.minutes}</td><td>${esc(x.note || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="muted">Not done yet.</div>`}`,
    foot: edit && !p.roomCycle ? `<button class="btn" data-act="pm-wo" data-id="${p.id}">🔧 Create work order</button><span class="grow"></span><button class="btn good" data-act="pm-done" data-id="${p.id}">✓ Mark complete</button>` : edit ? `<span class="grow"></span><button class="btn primary" data-act="pm-room">Log a room PM</button>` : "",
  });
  const as = modalEl().querySelector("#pm-as");
  if (as) as.onchange = () => { p.assignee = as.value; touch(); render(); toast("Reassigned to " + sname(p.assignee)); };
}
ACT["pm-done"] = el => {
  const p = pmOf(el.dataset.id);
  const boxes = [...document.querySelectorAll("#pm-chk input")];
  if (boxes.length && boxes.some(b => !b.checked) && !document.getElementById("pm-note").value.trim()) { toast("Tick every checklist step, or add a note saying why one was skipped."); return; }
  completePM(p, +document.getElementById("pm-min").value || p.estMinutes, document.getElementById("pm-note").value.trim());
  touch(); closeModal(); render(); toast(`Done. Next due ${dateOnly(p.nextDue)}`);
};
ACT["pm-wo"] = el => {
  const p = pmOf(el.dataset.id);
  closeModal(true);
  openWOForm({ title: "PM: " + p.title, location: (H().assets.find(a => a.id === p.assetId) || {}).location || "Mechanical room", assetId: p.assetId, desc: "Checklist:\n- " + p.checklist.join("\n- "), source: "Preventive maintenance", pmId: p.id, category: "HVAC" });
};
ACT["pm-room"] = () => {
  const h = H(), task = h.pm.find(p => p.roomCycle);
  const todo = h.rooms.filter(r => !r.pmDone);
  modal({ title: "Log a room PM", wide: true, body: `<div class="form">
      <div class="f"><label>Room *</label><input type="text" id="rp-room" list="rp-list" placeholder="${todo.length} rooms left this cycle"><datalist id="rp-list">${todo.map(r => `<option value="${r.no}">`).join("")}</datalist></div>
      <div class="f"><label>Minutes taken</label><input type="number" id="rp-min" value="${task ? task.estMinutes : 45}"></div></div>
      <h3 style="font-size:14px;margin-top:12px">20-point check</h3>
      ${(task ? task.checklist : []).map(c => `<label class="chk" style="cursor:pointer"><span>${esc(c)}</span><input type="checkbox" class="rp-c" checked style="width:20px;height:20px"></label>`).join("")}
      <div class="form" style="margin-top:10px"><div class="f full"><label>Issue found that needs a work order (optional)</label><input type="text" id="rp-issue" placeholder="e.g. Grout cracked in shower"></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn good" id="rp-go">✓ Save room PM</button>` });
  modalEl().querySelector("#rp-go").onclick = () => {
    const r = roomByNo(document.getElementById("rp-room").value.trim());
    if (!r) { toast("Enter a valid room number."); return; }
    const issue = document.getElementById("rp-issue").value.trim();
    r.pmDone = true;
    if (task) task.history.unshift({ t: Date.now(), by: me().id, minutes: +document.getElementById("rp-min").value || 45, note: "Room " + r.no + (issue ? ": " + issue : "") });
    let msg = `Room ${r.no} PM logged`;
    if (issue) {
      const id = nextId("WO"), now = Date.now();
      h.workOrders.unshift({ id, title: issue, category: guessCategory(issue) || "Finishes", location: r.no, priority: "Normal", status: "Open", assignee: me().dept === "Engineering" ? me().id : null, createdBy: me().id, createdAt: now, dueAt: now + 48 * HOUR, startedAt: null, completedAt: null, minutes: 0, partsCost: 0, oooRoom: false, source: "Preventive maintenance", photo: null, desc: "Found during room PM", notes: [{ t: now, by: me().id, text: "Created from room PM" }] });
      msg += ` and ${id} created`;
    }
    if (h.rooms.every(x => x.pmDone) && task) { h.rooms.forEach(x => { x.pmDone = false; }); task.lastDone = Date.now(); task.nextDue = Date.now() + task.freqDays * DAY; msg += ". Cycle complete, a new quarter starts"; }
    logActivity(`logged room PM for ${r.no}`, "#/pm");
    touch(); closeModal(true); render(); toast(msg);
  };
};

/* ================= Assets ================= */
VIEWS.assets = function () {
  const h = H(), f = U.f, yr = new Date().getFullYear();
  const cats = [...new Set(h.assets.map(a => a.category))];
  const list = h.assets.filter(a => !f.asCat || a.category === f.asCat);
  const repair = a => h.workOrders.filter(w => w.assetId === a.id && w.completedAt).reduce((s, w) => s + w.partsCost + w.minutes / 60 * LABOUR_RATE, 0);
  const soon = h.assets.filter(a => a.installed + a.lifeYears - yr <= 3).sort((a, b) => (a.installed + a.lifeYears) - (b.installed + b.lifeYears));
  return `<div class="cols c21"><div>
      <div class="filters"><select data-f="asCat"><option value="">All categories</option>${opt(cats, f.asCat)}</select><span style="flex:1"></span>${can("pmEdit") ? `<button class="btn primary" data-act="asset-new">＋ Asset</button>` : ""}</div>
      <div class="rows">${list.map(a => { const age = yr - a.installed, life = Math.min(1, age / a.lifeYears); const wOk = new Date(a.warrantyEnd) > new Date();
        return `<div class="row" data-act="nav" data-href="#/assets/${a.id}"><div><div class="t">${esc(a.name)}</div><div class="m"><span>${esc(a.category)}</span><span>📍 ${esc(a.location)}</span><span>${age} of ${a.lifeYears} years used</span>${repair(a) ? `<span>Repairs ${money(repair(a))}</span>` : ""}</div>
          <div class="bar ${life > .85 ? "amber" : "blue"}" style="margin-top:6px;max-width:260px"><i style="width:${life * 100}%"></i></div></div>
          <div class="r">${chip(a.condition, a.condition === "Good" ? "green" : a.condition === "Fair" ? "amber" : "red")}${chip(wOk ? "In warranty" : "Warranty ended", wOk ? "blue" : "")}</div></div>`; }).join("")}</div>
    </div>
    <div class="panel"><div class="ph"><h2>Capital plan, next 3 years</h2></div>
      <p class="muted" style="font-size:13px">Equipment reaching the end of its expected life. Use this for the capital budget.</p>
      ${soon.length ? `<div class="rows">${soon.map(a => `<div class="row" data-act="nav" data-href="#/assets/${a.id}"><div><div class="t">${esc(a.name)}</div><div class="m">Replace by ${a.installed + a.lifeYears}</div></div><div class="r"><b>${money(a.replaceCost)}</b></div></div>`).join("")}</div>
      <p style="margin-top:10px"><b>Total: ${money(soon.reduce((s, a) => s + a.replaceCost, 0))}</b></p>` : `<div class="empty">Nothing due for replacement.</div>`}
    </div></div>`;
};
OPENERS.assets = id => openAsset(id);
function openAsset(id) {
  const h = H(), a = h.assets.find(x => x.id === id);
  if (!a) return;
  const yr = new Date().getFullYear();
  const wos = h.workOrders.filter(w => w.assetId === a.id || (!w.assetId && w.location === a.location && w.location !== ""));
  const pms = h.pm.filter(p => p.assetId === a.id);
  const cost = wos.filter(w => w.completedAt).reduce((s, w) => s + w.partsCost + w.minutes / 60 * LABOUR_RATE, 0);
  recordModal("assets", { title: esc(a.name), wide: true,
    body: `<dl class="kv"><dt>Category</dt><dd>${esc(a.category)}</dd><dt>Location</dt><dd>${esc(a.location)}</dd><dt>Serial</dt><dd>${esc(a.serial)}</dd>
      <dt>Installed</dt><dd>${a.installed} (${yr - a.installed} years ago, expected life ${a.lifeYears} years)</dd><dt>Warranty ends</dt><dd>${esc(a.warrantyEnd)}</dd>
      <dt>Condition</dt><dd>${can("pmEdit") ? `<select id="as-cond" style="width:auto">${opt(["Good", "Fair", "Poor"], a.condition)}</select>` : esc(a.condition)}</dd>
      <dt>Replacement</dt><dd>${money(a.replaceCost)} planned for ${a.installed + a.lifeYears}</dd><dt>Repair cost to date</dt><dd>${money(cost)} (labour at ${money(LABOUR_RATE)}/h plus parts)</dd></dl>
      <h3 style="font-size:14px">Preventive maintenance</h3>${pms.length ? pms.map(p => `<div style="font-size:13.5px;margin-bottom:4px"><a href="#/pm/${p.id}" data-act="nav" data-href="#/pm/${p.id}">${esc(p.title)}</a> · every ${freqLabel(p.freqDays)} · ${pmDueChip(p)}</div>`).join("") : `<div class="muted" style="font-size:13px">No PM tasks linked.</div>`}
      <h3 style="font-size:14px;margin-top:12px">Work orders</h3>${wos.length ? wos.slice(0, 8).map(w => `<div style="font-size:13.5px;margin-bottom:4px"><a href="#/workorders/${w.id}" data-act="nav" data-href="#/workorders/${w.id}">${w.id}</a> ${esc(w.title)} ${chip(w.status, WO_CHIP[w.status])}</div>`).join("") : `<div class="muted" style="font-size:13px">No work orders yet.</div>`}`,
    foot: `<button class="btn" data-act="asset-wo" data-id="${a.id}">🔧 Create work order</button>` });
  const c = modalEl().querySelector("#as-cond");
  if (c) c.onchange = () => { a.condition = c.value; touch(); render(); toast("Condition updated"); };
}
ACT["asset-wo"] = el => { const a = H().assets.find(x => x.id === el.dataset.id); closeModal(true); openWOForm({ location: a.location, assetId: a.id }); };
ACT["asset-new"] = () => {
  modal({ title: "New asset", body: `<div class="form" id="as-form">
    <div class="f full"><label>Name *</label><input type="text" name="name" placeholder="e.g. Boiler #2"></div>
    <div class="f"><label>Category</label><input type="text" name="category" list="as-cats" value="Heating"><datalist id="as-cats">${[...new Set(H().assets.map(a => a.category))].map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
    <div class="f"><label>Location</label><input type="text" name="location" value="Mechanical room"></div>
    <div class="f"><label>Year installed</label><input type="number" name="installed" value="${new Date().getFullYear()}"></div>
    <div class="f"><label>Expected life (years)</label><input type="number" name="life" value="15"></div>
    <div class="f"><label>Replacement cost ($)</label><input type="number" name="cost" value="10000"></div>
    <div class="f"><label>Warranty ends</label><input type="date" name="warranty"></div>
    <div class="f"><label>Serial number</label><input type="text" name="serial"></div></div>`,
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="as-go">Add asset</button>` });
  modalEl().querySelector("#as-go").onclick = () => {
    const v = readForm(modalEl().querySelector("#as-form"));
    if (!v.name) { toast("Please name the asset."); return; }
    const h = H();
    h.assets.push({ id: S.hotel + "-A" + (h.assets.length + 1) + "-" + Date.now() % 1000, name: v.name, category: v.category || "General", location: v.location, installed: +v.installed || new Date().getFullYear(), lifeYears: +v.life || 15, replaceCost: +v.cost || 0, serial: v.serial || "–", warrantyEnd: v.warranty || "–", condition: "Good" });
    touch(); closeModal(true); render(); toast("Asset added");
  };
};
