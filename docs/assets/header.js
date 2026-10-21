/* Shared site header, footer and light/dark theme for Nihal's portfolio (/) and
   the Hospitality BI site (/hotel-business/). The same file lives in both repos:
   nihalunfc.github.io/assets/header.js and hotel-business/docs/assets/header.js.
   Keep the two copies identical.

   How a page uses it:
     in <head>, after the stylesheet: a plain (not deferred) script tag with src ".../assets/header.js"
     <body> <site-header></site-header> ... page ... <site-footer></site-footer>
   A full-screen app can leave out <site-header>: the script then only applies the saved theme.

   URL schema (all links are root-relative, so a custom domain only needs the CNAME):
     /                         portfolio home         /projects/        all projects
     /swarm/ /swarm/<domain>/  Swarm Intelligence     /tools/           every tool (personal + hotel)
     /tools/<slug>/            a personal tool        /about/ /disclaimer/
     /hotel-business/                 Hospitality BI home
     /hotel-business/dashboards/<slug>/   sample-data dashboards and demos
     /hotel-business/tools/<slug>/        hotel tools (older tools keep their tools/<slug>.html address)
     /hotel-business/swarm/               AI swarm for hotels
   New pages are folders with an index.html. Existing addresses never move.

   Theme: saved in localStorage "nihal.theme" ("light" or "dark", default light) and set as
   <html data-theme="...">. A "themechange" event is sent on window when it changes. */
(function () {
  'use strict';
  var KEY = 'nihal.theme';
  var root = document.documentElement;

  function savedTheme() { try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    root.style.colorScheme = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#12161c' : '#ffffff');
  }
  applyTheme(savedTheme());
  window.addEventListener('storage', function (e) { if (e.key === KEY) { applyTheme(savedTheme()); window.dispatchEvent(new Event('themechange')); } });

  /* ---------------------------------------------------------------- data */
  var H = '/hotel-business/';
  var PERSONAL_TOOLS = [
    { href: '/tools/expense-calendar/', label: 'Expense calendar', sub: 'Plan and track expenses day by day' }
  ];
  var HOTEL_TOOLS = [
    { group: 'Revenue', items: [
      { href: H + 'tools/rate-recommender.html', label: 'Rate recommender', sub: 'A rate for each of the next 30 days' },
      { href: H + 'tools/forecaster.html', label: 'Occupancy forecaster', sub: 'The next 30 to 90 days of occupancy' },
      { href: H + 'tools/overbooking.html', label: 'Overbooking calculator', sub: 'How many extra rooms to sell' },
      { href: H + 'tools/group-displacement.html', label: 'Group quote and displacement', sub: 'Is this group worth it?' },
      { href: H + 'tools/kpi.html', label: 'Hotel KPI dashboard', sub: 'Occupancy, ADR, RevPAR and profit' }
    ] },
    { group: 'Operations', items: [
      { href: H + 'schedule.html', label: 'Staff schedule builder', sub: "A week's schedule at the lowest cost" },
      { href: H + 'tools/housekeeping-board.html', label: 'Housekeeping board', sub: "Today's room assignments" },
      { href: H + 'tools/labour.html', label: 'Labour productivity', sub: 'Hours and cost per occupied room' },
      { href: H + 'tools/night-audit.html', label: 'Night audit assistant', sub: 'Checklist, balancing and daily report' },
      { href: H + 'tools/energy-estimator.html', label: 'Peak-energy savings', sub: 'Ontario Global Adjustment savings' },
      { href: H + 'tools/report-dashboard/', label: 'Hotel report builder', sub: "Upload any exports, get a manager's report" }
    ] }
  ];
  var HOTEL_DASHBOARDS = [
    { href: H + 'revenue.html', label: 'Revenue command centre', sub: 'Twelve months of pricing decisions' },
    { href: H + 'dashboards/workforce/', label: 'Workforce', sub: 'Scheduling, time clock, timesheets and payroll' },
    { href: H + 'dashboards/operations/', label: 'Operations', sub: 'Housekeeping, maintenance and guest requests in one app' }
  ];
  var PROJECTS = [
    { href: '/swarm/', label: 'Swarm Intelligence', sub: 'One AI engine for hotels, grid batteries and wildfire drones' },
    { href: H, label: 'Hospitality BI', sub: 'Dashboards and free tools for a five-hotel group' }
  ];
  var GH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

  var SITES = {
    portfolio: {
      home: '/', name: 'Nihal', sub: 'Portfolio',
      nav: [
        { label: 'Home', href: '/', exact: true },
        { label: 'Projects', href: '/projects/', match: ['/projects/', '/swarm/'], menu: [{ items: PROJECTS }], all: { href: '/projects/', label: 'All projects' } },
        { label: 'Tools', href: '/tools/', match: ['/tools/'], wide: true,
          menu: [{ group: 'Personal tools', tag: 'personal', items: PERSONAL_TOOLS }].concat(HOTEL_TOOLS.map(function (g) { return { group: 'Hotel tools · ' + g.group, tag: 'hotel', items: g.items }; })),
          all: { href: '/tools/', label: 'All tools' } },
        { label: 'About', href: '/about/', match: ['/about/', '/disclaimer/'] }
      ],
      action: { label: 'GitHub', href: 'https://github.com/nihalunfc' }
    },
    hotel: {
      home: H, name: 'Hospitality BI', sub: 'by Nihal',
      nav: [
        { label: 'Home', href: H, exact: true },
        { label: 'Dashboards', href: H + 'dashboards/', match: [H + 'dashboards/', H + 'revenue.html'], menu: [{ items: HOTEL_DASHBOARDS }], all: { href: H + 'dashboards/', label: 'All dashboards' } },
        { label: 'Hotel tools', href: H + 'tools/', match: [H + 'tools/', H + 'schedule.html'], wide: true,
          menu: HOTEL_TOOLS.map(function (g) { return { group: g.group, tag: 'hotel', items: g.items }; }),
          all: { href: H + 'tools/index.html', label: 'All hotel tools' },
          extra: { href: '/tools/', label: 'Personal tools on Nihal’s portfolio' } },
        { label: 'AI swarm', href: H + 'swarm/', match: [H + 'swarm/'] },
        { label: 'Proposals', href: H + 'index.html#proposals' }
      ],
      action: { label: 'Code', href: 'https://github.com/nihalunfc/hotel-business' }
    }
  };
  var src = (document.currentScript && document.currentScript.src) || '';
  var SITE = SITES[/\/hotel-business\//.test(src) ? 'hotel' : 'portfolio'];

  /* --------------------------------------------------------------- styles */
  var CSS = [
    'site-header{display:block;position:sticky;top:0;z-index:50;min-height:64px;background:var(--sh-bg);border-bottom:1px solid var(--sh-line);font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    'site-footer{display:block}',
    ':root{--sh-bg:#fff;--sh-ink:#111827;--sh-ink-2:#4b5563;--sh-ink-3:#6b7280;--sh-line:#e5e7eb;--sh-hover:#f3f4f6;--sh-brand:#1d4ed8;--sh-brand-soft:#eef3fe;--sh-hotel:#0f766e;--sh-hotel-soft:#e6f4f1;--sh-shadow:0 12px 32px rgba(17,24,39,.12),0 2px 6px rgba(17,24,39,.06);--sh-foot:#f9fafb}',
    ':root[data-theme="dark"]{--sh-bg:#161b22;--sh-ink:#e6e9ee;--sh-ink-2:#b4bdc9;--sh-ink-3:#8b95a3;--sh-line:#2a313c;--sh-hover:#1f2630;--sh-brand:#7aa7ff;--sh-brand-soft:rgba(122,167,255,.14);--sh-hotel:#3cc9b5;--sh-hotel-soft:rgba(60,201,181,.14);--sh-shadow:0 12px 32px rgba(0,0,0,.45);--sh-foot:#12161c}',
    '.sh-in{max-width:1180px;margin:0 auto;padding:0 16px;height:64px;display:flex;align-items:center;gap:24px}',
    '.sh-brand{display:inline-flex;align-items:center;gap:10px;color:var(--sh-ink);font-weight:700;font-size:16.5px;letter-spacing:-.01em;white-space:nowrap;text-decoration:none}',
    '.sh-brand:hover{text-decoration:none}',
    '.sh-brand svg{width:28px;height:28px;flex:none}',
    '.sh-brand small{font-weight:500;color:var(--sh-ink-3);font-size:13px;letter-spacing:0;margin-left:2px}',
    '.sh-nav{display:flex;align-items:center;gap:2px;height:100%;flex:1;min-width:0}',
    '.sh-nav>a,.sh-dd>button{position:relative;display:inline-flex;align-items:center;gap:5px;height:100%;padding:0 12px;font:inherit;font-size:14.5px;font-weight:500;color:var(--sh-ink-2);background:none;border:0;cursor:pointer;white-space:nowrap;text-decoration:none}',
    '.sh-nav>a:hover,.sh-dd>button:hover,.sh-dd>button[aria-expanded="true"]{color:var(--sh-ink);text-decoration:none}',
    '.sh-nav>a.on,.sh-dd>button.on{color:var(--sh-brand);font-weight:600}',
    '.sh-nav>a.on::after,.sh-dd>button.on::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:2px;border-radius:2px;background:var(--sh-brand)}',
    '.sh-dd{position:relative;height:100%;display:flex}',
    '.sh-dd>button svg{width:12px;height:12px;transition:transform .15s}',
    '.sh-dd>button[aria-expanded="true"] svg{transform:rotate(180deg)}',
    '.sh-menu{position:absolute;top:calc(100% + 6px);left:0;min-width:280px;max-width:calc(100vw - 32px);background:var(--sh-bg);border:1px solid var(--sh-line);border-radius:10px;box-shadow:var(--sh-shadow);padding:8px;z-index:60}',
    '.sh-menu[hidden]{display:none}',
    '.sh-menu.wide{width:760px}',
    '.sh-cols{display:grid;gap:4px 12px}',
    '.sh-menu.wide .sh-cols{grid-template-columns:repeat(var(--cols),minmax(0,1fr))}',
    '.sh-group{font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--sh-ink-3);padding:8px 10px 4px;display:flex;align-items:center;gap:6px}',
    '.sh-group i{width:8px;height:8px;border-radius:2px;background:var(--sh-brand);flex:none}',
    '.sh-group.hotel i{background:var(--sh-hotel)}',
    '.sh-menu a{display:block;padding:8px 10px;border-radius:7px;color:var(--sh-ink);font-size:14px;font-weight:600;text-decoration:none;line-height:1.35}',
    '.sh-menu a span{display:block;font-weight:400;font-size:12.5px;color:var(--sh-ink-3);margin-top:1px}',
    '.sh-menu a:hover,.sh-menu a:focus-visible{background:var(--sh-hover);outline:none;text-decoration:none}',
    '.sh-menu a.here{background:var(--sh-brand-soft)}',
    '.sh-menu .hotel a.here{background:var(--sh-hotel-soft)}',
    '.sh-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;border-top:1px solid var(--sh-line);margin-top:6px;padding-top:4px}',
    '.sh-foot a{font-size:13.5px;color:var(--sh-brand);display:inline-block}',
    '.sh-foot a.x{color:var(--sh-ink-3);font-weight:500}',
    '.sh-right{display:flex;align-items:center;gap:8px;margin-left:auto}',
    '.sh-act{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border:1px solid var(--sh-line);border-radius:8px;color:var(--sh-ink);font-size:14px;font-weight:500;text-decoration:none;white-space:nowrap}',
    '.sh-act:hover{background:var(--sh-hover);text-decoration:none}',
    '.sh-act svg{width:16px;height:16px}',
    '.sh-icon{display:inline-grid;place-items:center;width:36px;height:36px;border:1px solid var(--sh-line);border-radius:8px;background:none;color:var(--sh-ink-2);cursor:pointer;padding:0}',
    '.sh-icon:hover{background:var(--sh-hover);color:var(--sh-ink)}',
    '.sh-icon svg{width:18px;height:18px}',
    '.sh-theme .moon{display:block}.sh-theme .sun{display:none}',
    ':root[data-theme="dark"] .sh-theme .moon{display:none}:root[data-theme="dark"] .sh-theme .sun{display:block}',
    '.sh-burger{display:none}',
    '@media (max-width:900px){',
    ' .sh-in{gap:12px}',
    ' .sh-burger{display:inline-grid}',
    ' .sh-act{display:none}',
    ' .sh-nav{display:none;position:fixed;top:64px;left:0;right:0;bottom:0;height:auto;flex-direction:column;align-items:stretch;gap:0;padding:8px 16px 24px;background:var(--sh-bg);overflow-y:auto;border-top:1px solid var(--sh-line)}',
    ' site-header.open .sh-nav{display:flex}',
    ' .sh-nav>a,.sh-dd>button{height:auto;padding:14px 4px;font-size:16px;border-bottom:1px solid var(--sh-line);justify-content:space-between;width:100%}',
    ' .sh-nav>a.on::after,.sh-dd>button.on::after{left:-16px;right:auto;top:10px;bottom:10px;width:3px;height:auto}',
    ' .sh-dd{height:auto;flex-direction:column}',
    ' .sh-menu,.sh-menu.wide{position:static;width:auto;min-width:0;max-width:none;box-shadow:none;border:0;border-radius:0;padding:4px 0 10px;border-bottom:1px solid var(--sh-line)}',
    ' .sh-menu.wide .sh-cols{grid-template-columns:1fr}',
    ' .sh-nav .sh-mact{display:flex}',
    '}',
    '.sh-mact{display:none;gap:8px;padding-top:16px}',
    '.sh-mact .sh-act{display:inline-flex}',
    '@media print{site-header,site-footer{display:none!important}}',
    /* footer */
    '.sf{background:var(--sh-foot);border-top:1px solid var(--sh-line);color:var(--sh-ink-2);font-size:14px;margin-top:56px;font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.sf-in{max-width:1180px;margin:0 auto;padding:40px 16px 24px;display:grid;gap:28px;grid-template-columns:1.5fr 1fr 1fr 1fr}',
    '.sf p{margin:10px 0 0;max-width:24rem;line-height:1.55;color:var(--sh-ink-3)}',
    '.sf h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--sh-ink);margin:4px 0 10px;font-weight:600}',
    '.sf a{color:var(--sh-ink-2);display:block;padding:3px 0;text-decoration:none}',
    '.sf a:hover{color:var(--sh-brand);text-decoration:none}',
    '.sf a.sh-brand{display:inline-flex;padding:0;color:var(--sh-ink)}',
    '.sf-legal{grid-column:1/-1;border-top:1px solid var(--sh-line);padding-top:18px;font-size:13px;color:var(--sh-ink-3);display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 18px}',
    '.sf-legal a{display:inline;color:var(--sh-ink-3);text-decoration:underline}',
    '@media (max-width:760px){.sf-in{grid-template-columns:1fr 1fr}.sf-in>div:first-child{grid-column:1/-1}}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'site-chrome-css';
  style.textContent = CSS;
  (document.head || root).appendChild(style);

  /* --------------------------------------------------------------- render */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(p) { return p.replace(/index\.html$/, '').replace(/#.*$/, ''); }
  var here = norm(location.pathname);
  function isHere(href) { return /^\//.test(href) && norm(href) === here; }
  function isOn(item) {
    if (item.exact) return here === norm(item.href);
    if ((item.match || []).some(function (m) { return here.indexOf(norm(m)) === 0; })) return true;
    return (item.menu || []).some(function (g) { return g.items.some(function (i) { return isHere(i.href); }); });
  }
  var CHEV = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3"/></svg>';
  var MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1d4ed8"/><g stroke="#fff" stroke-width="1.6" opacity=".6"><line x1="10" y1="11" x2="22" y2="11"/><line x1="10" y1="11" x2="16" y2="22"/><line x1="22" y1="11" x2="16" y2="22"/></g><g fill="#fff"><circle cx="10" cy="11" r="3"/><circle cx="22" cy="11" r="3"/><circle cx="16" cy="22" r="3"/></g></svg>';
  var GHSVG = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="' + GH + '"/></svg>';
  var THEME = '<button class="sh-icon sh-theme" type="button" aria-label="Switch between light and dark theme" title="Light or dark theme">' +
    '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
    '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>';
  var BURGER = '<button class="sh-icon sh-burger" type="button" aria-label="Menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';
  function action(a) { return '<a class="sh-act" href="' + esc(a.href) + '">' + GHSVG + esc(a.label) + '</a>'; }

  function menuHTML(item, id) {
    var groups = item.menu, cols = groups.length;
    var body = '<div class="sh-cols" style="--cols:' + Math.min(cols, 3) + '">' + groups.map(function (g) {
      return '<div class="' + (g.tag || '') + '">' + (g.group ? '<div class="sh-group ' + (g.tag || '') + '"><i></i>' + esc(g.group) + '</div>' : '') +
        g.items.map(function (i) { return '<a href="' + esc(i.href) + '"' + (isHere(i.href) ? ' class="here" aria-current="page"' : '') + '>' + esc(i.label) + (i.sub ? '<span>' + esc(i.sub) + '</span>' : '') + '</a>'; }).join('') + '</div>';
    }).join('') + '</div>';
    var foot = (item.all || item.extra) ? '<div class="sh-foot">' + (item.all ? '<a href="' + esc(item.all.href) + '">' + esc(item.all.label) + ' →</a>' : '') + (item.extra ? '<a class="x" href="' + esc(item.extra.href) + '">' + esc(item.extra.label) + ' →</a>' : '') + '</div>' : '';
    return '<div class="sh-menu' + (item.wide && cols > 1 ? ' wide' : '') + '" id="' + id + '" hidden>' + body + foot + '</div>';
  }
  function headerHTML() {
    var nav = SITE.nav.map(function (item, n) {
      var on = isOn(item) ? ' on' : '';
      if (!item.menu) return '<a class="' + on.trim() + '" href="' + esc(item.href) + '"' + (on && isHere(item.href) ? ' aria-current="page"' : '') + '>' + esc(item.label) + '</a>';
      return '<div class="sh-dd"><button type="button" class="' + on.trim() + '" aria-expanded="false" aria-controls="sh-m' + n + '">' + esc(item.label) + CHEV + '</button>' + menuHTML(item, 'sh-m' + n) + '</div>';
    }).join('');
    return '<div class="sh-in"><a class="sh-brand" href="' + esc(SITE.home) + '">' + MARK + esc(SITE.name) + ' <small>' + esc(SITE.sub) + '</small></a>' +
      '<nav class="sh-nav" aria-label="Main">' + nav + '<div class="sh-mact">' + action(SITE.action) + '</div></nav>' +
      '<div class="sh-right">' + action(SITE.action) + THEME + BURGER + '</div></div>';
  }
  function footerHTML() {
    var hotel = SITE === SITES.hotel;
    var col = function (title, links) { return '<div><h2>' + title + '</h2>' + links.map(function (l) { return '<a href="' + esc(l[0]) + '">' + esc(l[1]) + '</a>'; }).join('') + '</div>'; };
    return '<div class="sf-in"><div><a class="sh-brand" href="/">' + MARK + 'Nihal <small>Portfolio</small></a>' +
      '<p>Data, business intelligence and applied AI. Projects and free tools with live results you can explore.</p></div>' +
      col('Projects', [['/swarm/', 'Swarm Intelligence'], [H, 'Hospitality BI'], [H + 'swarm/', 'AI swarm for hotels'], ['/projects/', 'All projects']]) +
      col('Tools', [['/tools/expense-calendar/', 'Expense calendar'], [H + 'tools/index.html', 'Hotel tools'], ['/tools/', 'All tools']]) +
      col('Site', [['/about/', 'About'], ['/disclaimer/', 'Disclaimer and privacy'], ['https://github.com/nihalunfc', 'GitHub']]) +
      '<div class="sf-legal"><span>© 2026 Nihal.' + (hotel ? ' All hotels, guests, staff and figures on this site are fictional samples.' : '') + '</span>' +
      '<span>Built with the help of AI tools. <a href="/disclaimer/">Credits</a></span></div></div>';
  }

  /* ------------------------------------------------------------ behaviour */
  function wire(el) {
    var open = null;
    function close() { if (!open) return; open.btn.setAttribute('aria-expanded', 'false'); open.menu.hidden = true; open = null; }
    function fit(menu) {
      if (matchMedia('(max-width:900px)').matches) return;
      menu.style.left = '0px';
      var r = menu.getBoundingClientRect(), over = r.right - (window.innerWidth - 16);
      if (over > 0) menu.style.left = (-over) + 'px';
    }
    el.querySelectorAll('.sh-dd').forEach(function (dd) {
      var btn = dd.querySelector('button'), menu = dd.querySelector('.sh-menu');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (open && open.btn === btn) { close(); return; }
        close(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); open = { btn: btn, menu: menu }; fit(menu);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!open || open.btn !== btn) btn.click(); var a = menu.querySelector('a'); if (a) a.focus(); }
      });
      menu.addEventListener('keydown', function (e) {
        var links = [].slice.call(menu.querySelectorAll('a')), i = links.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
      });
    });
    document.addEventListener('click', function (e) { if (open && !open.menu.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (open) { var b = open.btn; close(); b.focus(); } else if (el.classList.contains('open')) burger.click();
    });
    window.addEventListener('resize', close);
    var burger = el.querySelector('.sh-burger');
    burger.addEventListener('click', function () {
      var on = el.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(on));
      document.body.style.overflow = on ? 'hidden' : '';
    });
    el.querySelectorAll('.sh-nav a').forEach(function (a) { a.addEventListener('click', function () { if (el.classList.contains('open')) burger.click(); }); });
    el.querySelector('.sh-theme').addEventListener('click', function () {
      var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, t); } catch (e) {}
      applyTheme(t);
      window.dispatchEvent(new Event('themechange'));
    });
  }

  function define(name, render) {
    if (!window.customElements || customElements.get(name)) return;
    customElements.define(name, class extends HTMLElement {
      connectedCallback() { if (this.dataset.done) return; this.dataset.done = '1'; render(this); }
    });
  }
  define('site-header', function (el) { el.setAttribute('role', 'banner'); el.innerHTML = headerHTML(); wire(el); });
  define('site-footer', function (el) { el.setAttribute('role', 'contentinfo'); el.classList.add('sf'); el.innerHTML = footerHTML(); });
  window.SiteChrome = { sites: SITES, theme: function () { return root.getAttribute('data-theme'); } };
})();
