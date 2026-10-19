// Minimal stand-in for the dashboard runtime: loads JSON files from ./data and
// serves them to the page through the same small `dash` API.
(function () {
  const FILES = ['energy_results', 'energy_curve', 'hotel_results', 'training_history', 'wildfire_results',
    'wildfire_replay', 'wildfire_variants', 'hotel_swarms', 'scale_study', 'hotel_energy',
    'hotel_housekeeping', 'hotel_relocation', 'hotel_shifts'];
  const store = {}, calcs = [], subs = [];
  FILES.forEach(id => { store[id] = { status: 'loading', data: [] }; });
  const fire = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const runCalcs = () => calcs.forEach(c => {
    const ins = c.inputs.map(i => store[i]);
    if (ins.every(s => s && s.status === 'ok')) {
      try { store[c.id] = { status: 'ok', data: c.fn(...ins.map(s => s.data)) }; }
      catch (e) { console.error(e); store[c.id] = { status: 'error', data: [] }; }
    } else if (ins.some(s => !s || s.status === 'error')) store[c.id] = { status: 'error', data: [] };
  });
  window.dash = {
    data: id => store[id] || { status: 'missing', data: [] },
    onData: fn => { subs.push(fn); fn(); },
    calc: (id, def) => { calcs.push({ id, inputs: def.inputs, fn: def.fn }); store[id] = { status: 'loading', data: [] }; },
    colors: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#8e5bd6', '#d6457a', '#4a9ab5', '#7a8a2a'],
    setLink: name => { history.replaceState(null, '', '#' + name); },
    params: {}, setParams: () => {}, resetParams: () => {},
  };
  FILES.forEach(id => fetch('data/' + id + '.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { store[id] = { status: 'ok', data: d }; })
    .catch(() => { store[id] = { status: 'error', data: [] }; })
    .finally(() => { runCalcs(); fire(); }));
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fire, 150); });
})();
