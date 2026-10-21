// Hotel Operations Hub: reference lists and the synthetic demo-data generator.
// Everything is fictional. The generator is seeded, so every visitor starts from the same data.
(function () {
  const HOUR = 36e5, DAY = 864e5, MIN = 6e4;

  const HOTELS = [
    { id: "GTR", name: "Grand Terrace Resort", floors: 8, perFloor: 18 },
    { id: "HLH", name: "Harbour Lights Hotel", floors: 7, perFloor: 16 },
    { id: "PVI", name: "Parkview Inn", floors: 4, perFloor: 14 },
    { id: "RVS", name: "Riverside Suites", floors: 6, perFloor: 12 },
    { id: "STH", name: "Summit Tower Hotel", floors: 10, perFloor: 14 },
  ];

  // Which modules each role sees, in sidebar order. "wo:mine" means the list opens on "assigned to me".
  const ROLES = {
    gm: { name: "General Manager", dept: "Management", mods: ["dashboard", "housekeeping", "workorders", "pm", "assets", "requests", "inspections", "logbook", "lostfound", "inventory", "reports", "team"] },
    fd: { name: "Front Desk Agent", dept: "Front Office", mods: ["dashboard", "housekeeping", "requests", "workorders", "logbook", "lostfound"] },
    eh: { name: "Executive Housekeeper", dept: "Housekeeping", mods: ["dashboard", "housekeeping", "inspections", "requests", "workorders", "logbook", "lostfound", "inventory", "reports", "team"] },
    ra: { name: "Room Attendant", dept: "Housekeeping", mods: ["myrooms", "requests", "workorders", "logbook", "lostfound"] },
    ce: { name: "Chief Engineer", dept: "Engineering", mods: ["dashboard", "workorders", "pm", "assets", "requests", "inspections", "logbook", "inventory", "reports", "team"] },
    mt: { name: "Maintenance Technician", dept: "Engineering", mods: ["workorders", "pm", "assets", "logbook", "inventory"] },
  };

  const DEPTS = ["Front Office", "Housekeeping", "Engineering", "Food & Beverage", "Security", "Management"];
  const HK_STATUSES = ["Dirty", "Cleaning", "Clean", "Inspected", "OOO", "OOS"];
  const HK_LABEL = { Dirty: "Dirty", Cleaning: "In progress", Clean: "Clean", Inspected: "Inspected", OOO: "Out of order", OOS: "Out of service" };
  const OCC_LABEL = { OCC: "Occupied", VAC: "Vacant" };
  const DUE_LABEL = { DEP: "Due out", ARR: "Arrival", "": "" };
  // Minutes of attendant time per service type (used for assignment balancing and credits).
  const SERVICE_MIN = { DEP: 32, SO: 20, VAC: 8 };

  const WO_STATUS = ["Open", "In progress", "On hold", "Completed"];
  const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
  const DUE_HOURS = { Low: 168, Normal: 48, High: 8, Urgent: 2 };
  const WO_CATS = {
    "Plumbing": ["Slow-draining tub", "Toilet running constantly", "Leaking sink faucet", "Low water pressure in shower", "Clogged bathroom sink"],
    "HVAC": ["Room unit not cooling", "Thermostat not responding", "Noisy fan in room unit", "Room too warm, guest complaint", "Musty smell from vent"],
    "Electrical": ["Bedside lamp not working", "Outlet dead by desk", "Bathroom light flickering", "USB charger port broken", "Corridor light out"],
    "TV & Wi-Fi": ["TV shows no signal", "Wi-Fi drops in room", "TV remote not pairing", "Casting to TV not working"],
    "Furniture & fixtures": ["Desk chair wobbly", "Drawer runner broken", "Headboard loose", "Curtain track off rail", "Closet door off track"],
    "Doors & locks": ["Door lock battery low", "Door not latching", "Connecting door lock stiff", "Safe will not open"],
    "Finishes": ["Wall scuffs by entry", "Re-caulk around tub", "Carpet stain needs extraction", "Grout cracked in shower"],
    "Appliances": ["Mini-fridge not cooling", "Coffee maker faulty", "Hair dryer broken", "Iron leaking water"],
    "Life safety": ["Smoke detector chirping", "Exit sign light out", "Fire door closer slow", "Emergency light failed test"],
  };
  const AREAS = ["Lobby", "Front desk", "Pool deck", "Fitness centre", "Elevator 1", "Elevator 2", "Main kitchen", "Laundry", "Parking garage", "Ballroom", "Restaurant", "Loading dock", "Staff locker room", "Business centre"];
  const AREA_CATS = { "Lobby": "Electrical", "Pool deck": "Plumbing", "Fitness centre": "Appliances", "Elevator 1": "Life safety", "Elevator 2": "Life safety", "Main kitchen": "Appliances", "Laundry": "Appliances" };

  const REQ_TYPES = {
    Request: { dept: "Housekeeping", items: [["Amenity", "Extra towels"], ["Amenity", "Extra pillows"], ["Amenity", "Crib for infant"], ["Amenity", "Toothbrush and toothpaste"], ["Amenity", "Iron and board"], ["Front Office", "Late checkout to 2 PM"], ["Amenity", "Rollaway bed"], ["Housekeeping", "Room refresh before dinner"], ["Front Office", "Wake-up call 5:30 AM"], ["Amenity", "Hypoallergenic pillows"]] },
    Complaint: { dept: "Front Office", items: [["Noise", "Noise from neighbouring room"], ["Maintenance", "Air conditioning not cooling"], ["Cleanliness", "Hair found in bathroom"], ["Wi-Fi", "Wi-Fi keeps dropping"], ["Billing", "Charged twice for parking"], ["Service", "Room service took over an hour"], ["Maintenance", "Shower is lukewarm"], ["Cleanliness", "Room not serviced yesterday"], ["Noise", "Construction noise in the morning"]] },
    Compliment: { dept: "Management", items: [["Service", "Front desk agent went above and beyond"], ["Cleanliness", "Spotless room, thank the attendant"], ["Service", "Restaurant team handled allergy perfectly"]] },
    Incident: { dept: "Security", items: [["Safety", "Guest slipped near pool entrance"], ["Security", "Guest reports missing laptop"], ["Medical", "Guest felt faint in lobby, EMS called"], ["Property damage", "Guest vehicle scraped in garage"], ["Security", "Unregistered visitor on 5th floor"], ["Property damage", "Broken lamp, guest-caused"]] },
  };
  const REQ_STATUS = ["New", "Acknowledged", "In progress", "Resolved", "Closed"];
  const RECOVERY = ["None", "Apology", "Amenity sent", "Points credited", "Rate adjustment", "Room move", "Meal voucher"];

  const LF_STATUS = ["Stored", "Claimed", "Shipped", "Donated", "Disposed"];
  const LF_ITEMS = [["Electronics", "Phone charger, white USB-C"], ["Electronics", "Wireless earbuds in black case"], ["Clothing", "Navy blazer, size 40"], ["Clothing", "Child's pink hoodie"], ["Jewellery", "Silver bracelet"], ["Documents", "Passport (handed to security)"], ["Electronics", "Laptop, 13-inch, grey"], ["Personal", "Prescription glasses"], ["Personal", "Toiletry bag"], ["Clothing", "Running shoes, size 9"], ["Toys", "Stuffed bear"], ["Personal", "Umbrella, black"], ["Electronics", "Tablet with blue cover"], ["Jewellery", "Wedding band, gold"], ["Personal", "Wallet, brown leather"]];

  const FIRST = ["Amara", "Ben", "Carmen", "Dev", "Elena", "Farid", "Grace", "Hiro", "Isla", "Jonah", "Kavya", "Liam", "Maya", "Noah", "Olu", "Priya", "Quinn", "Rosa", "Sami", "Tara", "Umar", "Vera", "Wes", "Xin", "Yara", "Zane", "Aiden", "Bea", "Chen", "Dina", "Eli", "Fatima", "Gabe", "Hana", "Ivan", "Jade", "Kofi", "Lena", "Mateo", "Nia", "Omar", "Pia", "Raj", "Sofia", "Tomas", "Uma", "Vik", "Wren", "Yusuf", "Zoe"];
  const LAST = ["Abara", "Bell", "Costa", "Das", "Evans", "Fischer", "Gill", "Hayes", "Ito", "Jensen", "Khan", "Lopez", "Moreau", "Nair", "Okafor", "Patel", "Quist", "Reyes", "Silva", "Tran", "Usman", "Vargas", "Wong", "Young", "Zhou", "Brooks", "Chandra", "Dubois", "Ferreira", "Grant"];
  const GUEST_LAST = ["Anderson", "Becker", "Cho", "Delgado", "Eriksen", "Flores", "Gupta", "Hart", "Iqbal", "Jordan", "Kim", "Larsen", "Mendes", "Novak", "Ortiz", "Price", "Ramos", "Sato", "Thompson", "Valdez", "Walsh", "Yamamoto"];

  const INSPECTION_TEMPLATES = [
    { id: "T-ROOM", name: "Guest room inspection", area: "room", pass: 85, items: [
      ["Entry door, lock and peephole work", 1, true], ["Bed made to standard, linens free of stains and hair", 2, true], ["Floors vacuumed, under bed and furniture clear", 1, false],
      ["Bathroom: tub, shower and toilet spotless", 2, true], ["Mirrors and glass streak-free", 1, false], ["Amenities and towels to par", 1, false],
      ["Dusting: headboard, lamps, ledges, vents", 1, false], ["Minibar and fridge stocked and clean", 1, false], ["TV, remote and lights all work", 1, false],
      ["Thermostat set to 21°C", 1, false], ["No odours", 1, true], ["Windows, curtains and blackout working", 1, false],
      ["Coffee station clean and stocked", 1, false], ["Smoke detector present, no tampering", 1, true]] },
    { id: "T-WASH", name: "Public washroom", area: "area", pass: 80, items: [["Fixtures clean and working", 2, true], ["Soap, paper and hand dryers stocked", 1, false], ["Floors dry and clean", 2, true], ["Mirrors streak-free", 1, false], ["Bins emptied", 1, false], ["No odours", 1, false], ["Accessible stall clear", 1, true], ["Cleaning log signed", 1, false]] },
    { id: "T-POOL", name: "Pool and spa", area: "area", pass: 90, items: [["Chlorine and pH within range, logged", 2, true], ["Water clear, drain visible", 2, true], ["Deck clean, no trip hazards", 1, true], ["Lifesaving equipment present", 1, true], ["Rules and depth signage visible", 1, false], ["Towels stocked", 1, false], ["Gate self-closes and latches", 1, true], ["Furniture clean and undamaged", 1, false]] },
    { id: "T-FIT", name: "Fitness centre", area: "area", pass: 80, items: [["Equipment wiped and working", 2, false], ["Out-of-order equipment tagged", 1, true], ["Water and towels stocked", 1, false], ["Floor and mats clean", 1, false], ["Emergency phone works", 1, true], ["TVs and lights working", 1, false]] },
    { id: "T-KIT", name: "Kitchen back of house", area: "area", pass: 90, items: [["Fridge and freezer temperatures logged", 2, true], ["Food labelled and dated", 2, true], ["Hand sink stocked", 1, true], ["Floors and drains clean", 1, false], ["Hood filters clean", 1, false], ["Chemicals stored away from food", 2, true], ["Pest control log current", 1, false], ["Fire suppression tag current", 1, true]] },
  ];

  const PM_TASKS = [
    ["Room preventive maintenance (20-point check)", "rooms", 90, 45, ["Test all lights and outlets", "Check plumbing for leaks and drain speed", "Clean room unit filter and coil", "Tighten furniture and fixtures", "Inspect caulking and grout", "Test door lock battery and closer", "Test smoke detector", "Check TV and remote"]],
    ["Fire extinguisher monthly check", "Fire alarm panel", 30, 40, ["Gauge in green", "Pin and seal intact", "Tag signed", "Mounted and visible"]],
    ["Boiler water treatment test", "Boiler #1", 7, 30, ["Test chemical levels", "Blow down", "Record pressure and temperature", "Check for leaks"]],
    ["Generator load test", "Emergency generator", 30, 60, ["Run under load 30 minutes", "Record voltage and frequency", "Check fuel level", "Check battery and charger"]],
    ["Elevator machine room inspection", "Elevator 1", 30, 30, ["Room clean and locked", "No oil leaks", "Emergency phone tested", "Log signed"]],
    ["Pool chemistry log", "Pool heater", 1, 15, ["Chlorine reading", "pH reading", "Water temperature", "Log posted"]],
    ["Kitchen hood degrease", "Kitchen exhaust hood", 90, 120, ["Contractor on site", "Filters cleaned", "Duct access checked", "Certificate filed"]],
    ["Dryer lint duct cleaning", "Dryer 1", 7, 45, ["Clean lint traps", "Clear duct", "Check belts", "Check gas line"]],
    ["Emergency lighting test", "Fire alarm panel", 30, 60, ["Test each corridor", "Test stairwells", "Replace failed lamps", "Log results"]],
    ["Ice machine sanitizing", "Ice machine (3rd floor)", 30, 40, ["Empty and sanitize bin", "Descale", "Replace water filter", "Test ice quality"]],
    ["Cooling tower cleaning", "Cooling tower", 90, 180, ["Drain and clean basin", "Inspect fill media", "Water treatment check", "Record readings"]],
    ["Backflow preventer test", "Domestic water heater", 365, 60, ["Certified tester", "Record results", "Submit to city", "File certificate"]],
    ["Roof drains and rooftop unit check", "Rooftop unit", 90, 60, ["Clear drains", "Check unit belts and filters", "Check roof membrane", "Photograph issues"]],
    ["Laundry washer inspection", "Washer 1", 30, 30, ["Check door seal", "Check chemical dosing", "Clean drain trap", "Check bearings for noise"]],
  ];
  const ASSETS = [
    ["Boiler #1", "Heating", "Mechanical room", 2014, 25, 68000], ["Chiller", "Cooling", "Mechanical room", 2016, 23, 145000], ["Cooling tower", "Cooling", "Roof", 2016, 20, 52000],
    ["Emergency generator", "Electrical", "Generator room", 2012, 30, 88000], ["Elevator 1", "Vertical transport", "Main core", 2009, 25, 210000], ["Elevator 2", "Vertical transport", "Main core", 2009, 25, 210000],
    ["Fire alarm panel", "Life safety", "Security office", 2018, 15, 24000], ["Pool heater", "Heating", "Pool equipment room", 2019, 12, 9500], ["Ice machine (3rd floor)", "Appliances", "3rd floor vending", 2021, 8, 4200],
    ["Washer 1", "Laundry", "Laundry", 2017, 12, 18000], ["Dryer 1", "Laundry", "Laundry", 2017, 12, 14000], ["Kitchen exhaust hood", "Kitchen", "Main kitchen", 2015, 20, 30000],
    ["Rooftop unit", "Cooling", "Roof", 2013, 18, 41000], ["Domestic water heater", "Plumbing", "Mechanical room", 2020, 12, 12000],
  ];
  const INVENTORY = [
    ["Bath towel", "Linen", "each", 600, 120, 6.4, "Northline Linen"], ["Hand towel", "Linen", "each", 600, 120, 2.9, "Northline Linen"], ["King sheet set", "Linen", "set", 400, 80, 21.0, "Northline Linen"],
    ["Pillowcase", "Linen", "each", 900, 160, 2.2, "Northline Linen"], ["Bath mat", "Linen", "each", 300, 60, 4.1, "Northline Linen"],
    ["Shampoo 40 ml", "Guest amenities", "case of 300", 12, 3, 88, "Harbour Supply Co."], ["Conditioner 40 ml", "Guest amenities", "case of 300", 12, 3, 88, "Harbour Supply Co."], ["Body wash 40 ml", "Guest amenities", "case of 300", 12, 3, 88, "Harbour Supply Co."],
    ["Bar soap", "Guest amenities", "case of 500", 8, 2, 96, "Harbour Supply Co."], ["Coffee pods", "Guest amenities", "case of 200", 15, 4, 64, "Harbour Supply Co."], ["Toilet paper", "Guest amenities", "case of 48", 40, 10, 52, "CleanPro Distribution"],
    ["Facial tissue", "Guest amenities", "case of 36", 25, 6, 41, "CleanPro Distribution"], ["Bathroom cleaner", "Cleaning chemicals", "4 L jug", 30, 8, 22, "CleanPro Distribution"], ["Glass cleaner", "Cleaning chemicals", "4 L jug", 20, 6, 18, "CleanPro Distribution"],
    ["Disinfectant", "Cleaning chemicals", "4 L jug", 30, 8, 27, "CleanPro Distribution"], ["Vacuum bags", "Cleaning chemicals", "pack of 10", 20, 5, 19, "CleanPro Distribution"],
    ["Room unit filter", "Engineering parts", "each", 80, 20, 14, "Metro Mechanical"], ["LED bulb A19", "Engineering parts", "each", 200, 50, 3.2, "Metro Mechanical"], ["Door lock battery AA", "Engineering parts", "pack of 24", 12, 3, 21, "Metro Mechanical"],
    ["Toilet flapper", "Engineering parts", "each", 40, 10, 7.5, "Metro Mechanical"], ["Silicone caulk", "Engineering parts", "tube", 30, 8, 9, "Metro Mechanical"], ["Smoke detector 9V battery", "Engineering parts", "pack of 12", 10, 3, 24, "Metro Mechanical"],
    ["TV remote (universal)", "Engineering parts", "each", 20, 5, 16, "Metro Mechanical"], ["Pool chlorine", "Engineering parts", "20 kg pail", 10, 3, 89, "Metro Mechanical"],
  ];

  const LOG_TEMPLATES = [
    ["Front Office", "AM", "Sold out tonight. Walk list ready if needed: two late arrivals guaranteed, holding 1 king for VIP {room}."],
    ["Front Office", "PM", "Group 'Northwind Pharma' arrives tomorrow 2 PM, 42 rooms. Keys pre-made, welcome letters at desk."],
    ["Front Office", "Night", "Night audit closed with no variance. Two no-shows charged. Fire panel trouble light on at 3:10 AM, engineering notified."],
    ["Housekeeping", "AM", "Short one attendant today (sick call). Supervisor taking 8 rooms on floor {floor}. Please hold early check-ins after 1 PM."],
    ["Housekeeping", "PM", "Linen delivery short 120 bath towels. Using backup par from storage, reorder placed."],
    ["Engineering", "AM", "Elevator 2 slow door close. Contractor booked for 10 AM. Guests directed to Elevator 1 meanwhile."],
    ["Engineering", "PM", "Hot water pressure dropped on floors 6 to 8 around 7 PM, restored 7:40 PM after valve swap. Watch for complaints."],
    ["Security", "Night", "Noise complaint {room} at 1:15 AM, second warning issued. Guest cooperative."],
    ["Food & Beverage", "AM", "Breakfast count 212. Waffle station down, replacement part due Thursday."],
    ["Management", "AM", "Reminder: brand quality audit window opens next week. Please focus on public washrooms and room inspections."],
    ["Front Office", "AM", "VIP {room} arriving 3 PM, anniversary. Amenity ordered, upgrade to suite approved."],
    ["Housekeeping", "AM", "Deep-clean project continues on floor {floor}. Rooms {room} and next two blocked until 4 PM."],
  ];

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedHotel(h, hi, now) {
    const R = rng(1000 + hi * 7919);
    const pick = a => a[Math.floor(R() * a.length)];
    const int = (lo, hi2) => lo + Math.floor(R() * (hi2 - lo + 1));
    const chance = p => R() < p;
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const t0 = startOfToday.getTime();
    const seq = { WO: 1000, GR: 2000, IN: 3000, LF: 4000, LG: 5000, PM: 100 };
    const nextId = k => k + "-" + (++seq[k]);

    // Staff
    const used = new Set();
    const person = () => { let n; do { n = pick(FIRST) + " " + pick(LAST); } while (used.has(n)); used.add(n); return n; };
    const staff = [];
    const add = (role, n) => { for (let i = 0; i < n; i++) staff.push({ id: h.id + "-S" + (staff.length + 1), name: person(), role, dept: ROLES[role].dept, active: true }); };
    add("gm", 1); add("fd", 4); add("eh", 1); add("ra", Math.max(5, Math.round(h.floors * h.perFloor / 16))); add("ce", 1); add("mt", h.floors >= 7 ? 3 : 2);
    const byRole = r => staff.filter(s => s.role === r);
    const eng = [...byRole("ce"), ...byRole("mt")];
    const ras = byRole("ra");

    // Rooms
    const rooms = [];
    for (let f = 1; f <= h.floors; f++) {
      for (let i = 1; i <= h.perFloor; i++) {
        const no = String(f * 100 + i);
        const type = i > h.perFloor - 2 ? "Suite" : i === 1 ? "Accessible king" : i % 2 ? "King" : "Two queens";
        const occ = chance(0.78) ? "OCC" : "VAC";
        let due = "";
        if (occ === "OCC" && chance(0.32)) due = "DEP"; else if (occ === "VAC" && chance(0.55)) due = "ARR";
        let hk;
        if (due === "DEP") hk = pick(["Dirty", "Dirty", "Dirty", "Cleaning", "Clean", "Inspected"]);
        else if (occ === "OCC") hk = pick(["Dirty", "Dirty", "Cleaning", "Clean", "Clean", "Inspected"]);
        else hk = pick(["Inspected", "Inspected", "Inspected", "Clean", "Dirty"]);
        rooms.push({ no, floor: f, type, occ, due, hk, att: null, dnd: occ === "OCC" && due !== "DEP" && chance(0.07), vip: chance(0.05), rush: due === "ARR" && chance(0.15), note: "", updatedAt: t0 + int(6, 10) * HOUR, pmDone: false });
      }
    }
    const roomNos = rooms.map(r => r.no);
    // Two rooms out of order, one out of service.
    const ooo = [pick(rooms), pick(rooms), pick(rooms)];
    ooo[0].hk = "OOO"; ooo[0].occ = "VAC"; ooo[0].due = ""; ooo[0].note = "Bathroom leak, ceiling repair";
    ooo[1].hk = "OOO"; ooo[1].occ = "VAC"; ooo[1].due = ""; ooo[1].note = "Carpet replacement";
    ooo[2].hk = "OOS"; ooo[2].occ = "VAC"; ooo[2].due = ""; ooo[2].note = "Deep clean";
    autoAssign(rooms, ras.map(s => s.id), r => r.hk === "Dirty" || r.hk === "Cleaning" || (r.occ === "OCC" && (r.hk === "Clean" || r.hk === "Inspected")));

    // An attendant works one room at a time.
    const busy = new Set();
    rooms.forEach(r => { if (r.hk === "Cleaning") { if (!r.att || busy.has(r.att)) r.hk = "Dirty"; else busy.add(r.att); } });

    // Quarterly room PM progress: about 45% of rooms done this cycle.
    rooms.forEach(r => { r.pmDone = chance(0.45); });

    // Assets
    const assets = ASSETS.map(([name, cat, loc, yr, life, cost], i) => ({
      id: h.id + "-A" + (i + 1), name, category: cat, location: loc, installed: yr + int(-1, 2), lifeYears: life, replaceCost: cost,
      serial: "SN-" + int(100000, 999999), warrantyEnd: new Date(t0 + int(-900, 700) * DAY).toISOString().slice(0, 10),
      condition: pick(["Good", "Good", "Good", "Fair", "Fair", "Poor"]),
    }));
    const assetByName = n => assets.find(a => a.name === n);

    // Work orders, last 30 days
    const wos = [];
    const activity = [];
    const roomsN = rooms.length;
    for (let d = 30; d >= 0; d--) {
      const n = Math.max(1, Math.round(roomsN / 28 + R() * 3 - 1));
      for (let k = 0; k < n; k++) {
        const created = t0 - d * DAY + int(6 * 60, 22 * 60) * MIN;
        if (created > now) continue;
        const inRoom = chance(0.72);
        const location = inRoom ? pick(roomNos) : pick(AREAS);
        const category = inRoom ? pick(Object.keys(WO_CATS)) : (AREA_CATS[location] || pick(Object.keys(WO_CATS)));
        const title = pick(WO_CATS[category]);
        const priority = pick(["Low", "Normal", "Normal", "Normal", "High", "High", "Urgent"]);
        const assignee = pick(eng).id;
        const by = chance(0.5) ? pick(byRole("fd")).id : chance(0.5) ? pick(ras).id : pick(eng).id;
        const durH = { Urgent: 0.6 + R() * 2, High: 1 + R() * 7, Normal: 3 + R() * 40, Low: 12 + R() * 110 }[priority];
        let status = "Completed", completedAt = created + durH * HOUR;
        if (completedAt > now) { status = pick(["Open", "In progress", "In progress", "On hold"]); completedAt = null; }
        else if (d <= 2 && chance(0.25)) { status = pick(["Open", "On hold"]); completedAt = null; }
        const wo = {
          id: nextId("WO"), title, category, location, priority, status, assignee, createdBy: by, createdAt: created,
          dueAt: created + DUE_HOURS[priority] * HOUR, startedAt: status !== "Open" ? created + Math.min(durH * 0.3, 2) * HOUR : null,
          completedAt, minutes: completedAt ? int(10, 90) : 0, partsCost: completedAt && chance(0.45) ? int(4, 180) : 0,
          oooRoom: false, source: chance(0.15) ? "Guest request" : chance(0.15) ? "Inspection" : "Staff", photo: null,
          desc: inRoom ? `Reported in room ${location}.` : `Reported at ${location}.`,
          notes: [{ t: created, by, text: "Work order created" }],
        };
        if (status === "On hold") wo.holdReason = pick(["Waiting for parts", "Guest in room, retry later", "Contractor booked"]);
        wo.notes.push({ t: created + 5 * MIN, by: byRole("ce")[0].id, text: "Assigned to " + staff.find(s => s.id === assignee).name });
        if (completedAt) wo.notes.push({ t: completedAt, by: assignee, text: "Completed. " + pick(["Replaced part and tested.", "Adjusted and tested, working.", "Cleaned and reset.", "Tightened and secured.", "Replaced batteries."]) });
        wos.push(wo);
      }
    }
    // Tie the OOO rooms to open work orders.
    [ooo[0], ooo[1]].forEach((r, i) => {
      const created = t0 - (i + 1) * DAY + 9 * HOUR;
      wos.push({ id: nextId("WO"), title: i ? "Replace carpet, full room" : "Bathroom ceiling leak from room above", category: i ? "Finishes" : "Plumbing", location: r.no, priority: "High", status: i ? "On hold" : "In progress",
        holdReason: i ? "Waiting for parts" : undefined, assignee: eng[i % eng.length].id, createdBy: byRole("eh")[0].id, createdAt: created, dueAt: created + 8 * HOUR, startedAt: created + HOUR, completedAt: null, minutes: 0, partsCost: 0,
        oooRoom: true, source: "Inspection", photo: null, desc: r.note + ". Room placed out of order.", notes: [{ t: created, by: byRole("eh")[0].id, text: "Work order created, room placed out of order" }] });
    });

    // Preventive maintenance
    const pm = PM_TASKS.map(([title, asset, freq, mins, checklist], i) => {
      const last = t0 - int(1, Math.round(freq * 1.25)) * DAY;
      const hist = [];
      for (let k = 1; k <= 4; k++) hist.push({ t: last - (k - 1) * freq * DAY, by: pick(eng).id, minutes: mins + int(-10, 20) });
      return { id: nextId("PM"), title, assetId: asset === "rooms" ? null : (assetByName(asset) || {}).id || null, roomCycle: asset === "rooms", freqDays: freq, estMinutes: mins, checklist,
        assignee: pick(eng).id, lastDone: last, nextDue: last + freq * DAY, history: hist.filter(x => x.t > t0 - 400 * DAY) };
    });

    // Guest requests and incidents, last 14 days
    const reqs = [];
    for (let d = 14; d >= 0; d--) {
      const n = Math.max(2, Math.round(roomsN / 22 + R() * 3));
      for (let k = 0; k < n; k++) {
        const created = t0 - d * DAY + int(7 * 60, 23 * 60) * MIN;
        if (created > now) continue;
        const type = pick(["Request", "Request", "Request", "Request", "Complaint", "Complaint", "Compliment", "Incident"]);
        const [category, title] = pick(REQ_TYPES[type].items);
        const dept = category === "Maintenance" ? "Engineering" : category === "Front Office" || category === "Billing" ? "Front Office" : category === "Cleanliness" || category === "Amenity" || category === "Housekeeping" ? "Housekeeping" : REQ_TYPES[type].dept;
        const pool = staff.filter(s => s.dept === dept);
        const ackMin = int(1, type === "Request" ? 9 : 15), resMin = ackMin + int(5, type === "Incident" ? 240 : 55);
        let status = "Closed", ackAt = created + ackMin * MIN, resolvedAt = created + resMin * MIN;
        if (resolvedAt > now) { resolvedAt = null; status = ackAt > now ? "New" : "In progress"; if (ackAt > now) ackAt = null; }
        else if (d === 0 && chance(0.4)) status = "Resolved";
        const r = { id: nextId("GR"), type, category, title, guest: pick(GUEST_LAST) + ", " + pick(FIRST).slice(0, 1) + ".", room: pick(roomNos), dept, priority: type === "Incident" ? "High" : type === "Complaint" ? "High" : "Normal",
          status, assignee: pool.length ? pick(pool).id : null, createdBy: pick(byRole("fd")).id, createdAt: created, ackAt, resolvedAt,
          recovery: type === "Complaint" && resolvedAt ? pick(RECOVERY) : "None", recoveryCost: 0, satisfaction: resolvedAt && type !== "Compliment" && chance(0.6) ? pick([3, 4, 4, 5, 5, 5, 2]) : null,
          desc: "", notes: [{ t: created, by: null, text: "Logged" }], woId: null };
        if (r.recovery !== "None") r.recoveryCost = { "Apology": 0, "Amenity sent": 25, "Points credited": 15, "Rate adjustment": 60, "Room move": 0, "Meal voucher": 30 }[r.recovery] || 0;
        if (type === "Incident") { r.severity = pick(["Low", "Moderate", "Moderate", "High"]); r.injury = category === "Safety" || category === "Medical"; r.witnesses = chance(0.5) ? pick(FIRST) + " " + pick(LAST) + " (guest)" : ""; r.policeReport = category === "Security" && chance(0.4); }
        if (category === "Maintenance" && chance(0.7)) {
          const wo = { id: nextId("WO"), title: title, category: "HVAC", location: r.room, priority: "High", status: resolvedAt ? "Completed" : "In progress", assignee: pick(eng).id, createdBy: r.createdBy,
            createdAt: created + 2 * MIN, dueAt: created + 8 * HOUR, startedAt: created + ackMin * MIN, completedAt: resolvedAt, minutes: resolvedAt ? int(15, 50) : 0, partsCost: 0, oooRoom: false, source: "Guest request", photo: null,
            desc: "From guest request " + r.id, notes: [{ t: created + 2 * MIN, by: r.createdBy, text: "Created from guest request " + r.id }] };
          wos.push(wo); r.woId = wo.id;
        }
        reqs.push(r);
      }
    }

    // A few requests still open right now, so the live queue is never empty whatever the time of day.
    [[4, "New", "Request"], [11, "New", "Request"], [23, "Acknowledged", "Complaint"], [48, "In progress", "Request"]].forEach(([mins, status, type]) => {
      const [category, title] = pick(REQ_TYPES[type].items.filter(i => i[0] !== "Maintenance"));
      const dept = ["Amenity", "Housekeeping", "Cleanliness"].includes(category) ? "Housekeeping" : category === "Front Office" || category === "Billing" || category === "Wi-Fi" ? "Front Office" : REQ_TYPES[type].dept;
      const pool = staff.filter(s => s.dept === dept);
      const created = now - mins * MIN;
      reqs.push({ id: nextId("GR"), type, category, title, guest: pick(GUEST_LAST) + ", " + pick(FIRST).slice(0, 1) + ".", room: pick(rooms.filter(r => r.occ === "OCC")).no, dept, priority: type === "Complaint" ? "High" : "Normal",
        status, assignee: status === "New" ? null : pick(pool).id, createdBy: pick(byRole("fd")).id, createdAt: created, ackAt: status === "New" ? null : created + int(2, 6) * MIN, resolvedAt: null,
        recovery: "None", recoveryCost: 0, satisfaction: null, desc: "", notes: [{ t: created, by: null, text: "Logged" }], woId: null });
    });

    // Inspections, last 30 days
    const insp = [];
    const inspectors = [...byRole("eh"), ...byRole("gm")];
    for (let d = 30; d >= 0; d--) {
      const n = int(3, 6);
      for (let k = 0; k < n; k++) {
        const t = t0 - d * DAY + int(9 * 60, 17 * 60) * MIN;
        if (t > now) continue;
        const tpl = chance(0.75) ? INSPECTION_TEMPLATES[0] : pick(INSPECTION_TEMPLATES.slice(1));
        const failP = 0.03 + R() * 0.12 + (d > 20 ? 0.04 : 0); // gets a little better over the month
        const results = tpl.items.map(it => chance(0.04) ? "na" : chance(it[2] ? failP * 0.25 : failP) ? "fail" : "pass");
        const rec = { id: nextId("IN"), templateId: tpl.id, location: tpl.area === "room" ? pick(roomNos) : pick(["Lobby", "Pool deck", "Fitness centre", "Main kitchen", "Ballroom"]),
          inspector: pick(inspectors).id, attendant: tpl.area === "room" ? pick(ras).id : null, at: t, results, notes: results.map(x => x === "fail" ? pick(["Redo", "Stain found", "Missing item", "Needs touch-up", "Reported to engineering"]) : "") };
        rec.score = scoreInspection(tpl, results);
        insp.push(rec);
      }
    }

    // Logbook, last 7 days
    const log = [];
    for (let d = 7; d >= 0; d--) {
      const n = int(3, 5);
      for (let k = 0; k < n; k++) {
        const t = t0 - d * DAY + int(6 * 60, 23 * 60) * MIN;
        if (t > now) continue;
        const [dept, shift, text] = pick(LOG_TEMPLATES);
        const authors = staff.filter(s => s.dept === dept);
        const room = pick(roomNos);
        log.push({ id: nextId("LG"), dept, shift, author: (authors.length ? pick(authors) : staff[0]).id, at: t,
          text: text.replace("{room}", room).replace("{floor}", room.slice(0, -2)), priority: chance(0.25) ? "Important" : "Normal",
          pinned: false, followUp: chance(0.3) ? (d > 1 ? "Done" : "Open") : "", readBy: d > 1 ? staff.filter(() => chance(0.7)).map(s => s.id) : [], comments: chance(0.3) ? [{ t: t + int(20, 200) * MIN, by: pick(staff).id, text: pick(["Noted, thanks.", "Handled at 2 PM.", "Following up with the guest.", "Engineering is aware."]) }] : [] });
      }
    }
    log.sort((a, b) => b.at - a.at);
    if (log[2]) log[2].pinned = true;

    // Lost and found, last 75 days
    const lf = [];
    for (let k = 0; k < 22; k++) {
      const t = t0 - int(0, 75) * DAY + int(8 * 60, 20 * 60) * MIN;
      if (t > now) continue;
      const [category, item] = pick(LF_ITEMS);
      const age = (now - t) / DAY;
      const status = age > 60 ? pick(["Donated", "Disposed", "Claimed"]) : age > 5 ? pick(["Stored", "Stored", "Claimed", "Shipped"]) : "Stored";
      lf.push({ id: nextId("LF"), item, category, location: chance(0.7) ? "Room " + pick(roomNos) : pick(AREAS), foundBy: pick([...ras, ...byRole("fd")]).id, foundAt: t,
        status, bin: "Bin " + String.fromCharCode(65 + int(0, 5)) + int(1, 9), valuable: category === "Jewellery" || category === "Electronics" || category === "Documents",
        guest: status === "Claimed" || status === "Shipped" ? pick(GUEST_LAST) + ", " + pick(FIRST).slice(0, 1) + "." : "", contact: "", tracking: status === "Shipped" ? "1Z" + int(10000000, 99999999) : "", closedAt: status === "Stored" ? null : t + int(1, 20) * DAY, notes: "" });
    }
    lf.sort((a, b) => b.foundAt - a.foundAt);

    // Inventory
    const scale = roomsN / 120;
    const inv = INVENTORY.map(([name, cat, unit, par, reorder, cost, supplier], i) => {
      const p = Math.max(2, Math.round(par * scale)), ro = Math.max(1, Math.round(reorder * scale));
      return { id: h.id + "-I" + (i + 1), name, category: cat, unit, par: p, reorder: ro, onHand: chance(0.18) ? int(0, ro) : int(ro + 1, Math.round(p * 1.1)), cost, supplier, location: cat === "Engineering parts" ? "Engineering shop" : cat === "Linen" ? "Linen room" : "Housekeeping store", lastCount: t0 - int(1, 12) * DAY };
    });
    const invTx = [];
    for (let k = 0; k < 24; k++) { const it = pick(inv); invTx.push({ t: t0 - int(0, 14) * DAY + int(8, 18) * HOUR, itemId: it.id, qty: chance(0.3) ? int(10, 60) : -int(1, 25), by: pick(staff).id, reason: "" }); }
    invTx.forEach(x => { x.reason = x.qty > 0 ? "Received" : pick(["Issued to floor", "Issued to engineering", "Damaged", "Count adjustment"]); });
    invTx.sort((a, b) => b.t - a.t);

    // Recent activity feed seed
    wos.filter(w => w.createdAt > now - DAY).forEach(w => activity.push({ t: w.createdAt, by: w.createdBy, text: `created work order ${w.id}: ${w.title} (${w.location})`, link: "#/workorders/" + w.id }));
    wos.filter(w => w.completedAt && w.completedAt > now - DAY).forEach(w => activity.push({ t: w.completedAt, by: w.assignee, text: `completed ${w.id}: ${w.title}`, link: "#/workorders/" + w.id }));
    reqs.filter(r => r.createdAt > now - DAY).forEach(r => activity.push({ t: r.createdAt, by: r.createdBy, text: `logged ${r.type.toLowerCase()} ${r.id} for room ${r.room}: ${r.title}`, link: "#/requests/" + r.id }));
    insp.filter(x => x.at > now - DAY).forEach(x => activity.push({ t: x.at, by: x.inspector, text: `inspected ${x.location}, score ${x.score}%`, link: "#/inspections/" + x.id }));
    activity.sort((a, b) => b.t - a.t);

    return { seq, staff, rooms, assets, workOrders: wos.sort((a, b) => b.createdAt - a.createdAt), pm, requests: reqs.sort((a, b) => b.createdAt - a.createdAt), inspections: insp.sort((a, b) => b.at - a.at), log, lostFound: lf, inventory: inv, invTx, activity: activity.slice(0, 80) };
  }

  function scoreInspection(tpl, results) {
    let got = 0, max = 0, critFail = false;
    tpl.items.forEach(([, w, crit], i) => {
      const r = results[i];
      if (r === "na" || r == null) return;
      max += w; if (r === "pass") got += w; else if (crit) critFail = true;
    });
    if (!max) return 0;
    const s = Math.round(got / max * 100);
    return critFail ? Math.min(s, tpl.pass - 1) : s;
  }

  // Balance rooms that need service across attendants by minutes, keeping each attendant on as few floors as possible.
  function autoAssign(rooms, attIds, pred) {
    if (!attIds.length) return;
    pred = pred || (r => r.hk === "Dirty" || r.hk === "Cleaning");
    const need = rooms.filter(pred).sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true }));
    const total = need.reduce((s, r) => s + serviceMinutes(r), 0);
    const target = total / attIds.length;
    let i = 0, load = 0;
    need.forEach(r => {
      if (load >= target && i < attIds.length - 1) { i++; load = 0; }
      r.att = attIds[i]; load += serviceMinutes(r);
    });
  }
  function serviceMinutes(r) { return r.due === "DEP" ? SERVICE_MIN.DEP : r.occ === "OCC" ? SERVICE_MIN.SO : SERVICE_MIN.VAC; }

  window.OPSDATA = { HOUR, DAY, MIN, HOTELS, ROLES, DEPTS, HK_STATUSES, HK_LABEL, OCC_LABEL, DUE_LABEL, SERVICE_MIN, WO_STATUS, PRIORITIES, DUE_HOURS, WO_CATS, AREAS, REQ_TYPES, REQ_STATUS, RECOVERY, LF_STATUS, INSPECTION_TEMPLATES, seedHotel, scoreInspection, autoAssign, serviceMinutes };
})();
