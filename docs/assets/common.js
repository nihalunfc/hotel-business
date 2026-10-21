const fmt = {
  pct: (v, d = 1) => (v == null ? "-" : (v * 100).toFixed(d) + "%"),
  money: (v, d = 0) => (v == null ? "-" : "$" + Number(v).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d })),
  num: (v, d = 0) => (v == null ? "-" : Number(v).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d })),
  compact: (v) => {
    if (v == null) return "-";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
    return "$" + v.toFixed(0);
  },
  date: (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }),
};

function delta(curr, prev, mode) {
  if (prev == null || curr == null) return "";
  if (mode === "points") {
    const p = (curr - prev) * 100;
    return `<span class="delta ${p >= 0 ? "up" : "down"}">${p >= 0 ? "+" : ""}${p.toFixed(1)} pts</span>`;
  }
  const r = (curr / prev - 1) * 100;
  return `<span class="delta ${r >= 0 ? "up" : "down"}">${r >= 0 ? "+" : ""}${r.toFixed(1)}%</span>`;
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
const COLORS = {
  s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100",
  get grid() { return isDark() ? "#2a313c" : "#e9edf1"; },
  get ink() { return isDark() ? "#b4bdc9" : "#4a5561"; },
  get muted() { return isDark() ? "#6b7685" : "#9aa4ae"; },
  get bg() { return isDark() ? "#161b22" : "#ffffff"; },
};

function chartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.font.size = 12.5;
  Chart.defaults.color = COLORS.ink;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.boxHeight = 12;
  chartTheme();
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 5;
  Chart.defaults.elements.bar.borderRadius = 4;
  Chart.defaults.interaction.mode = "index";
  Chart.defaults.interaction.intersect = false;
  Chart.defaults.maintainAspectRatio = false;
}

function gridScale(extra = {}) {
  return Object.assign({ grid: { color: COLORS.grid }, border: { display: false }, ticks: { color: COLORS.ink } }, extra);
}

// Light and dark theme for Chart.js. Runs at start-up and again when the visitor
// switches theme (assets/header.js sends "themechange"): every chart on the page
// gets the new grid, label and tooltip colours without being rebuilt.
function chartTheme() {
  if (!window.Chart) return;
  const d = isDark(), ink = COLORS.ink, grid = COLORS.grid;
  Chart.defaults.color = ink;
  Chart.defaults.borderColor = grid;
  const tt = Chart.defaults.plugins.tooltip;
  tt.backgroundColor = d ? "#1d232c" : "#ffffff";
  tt.titleColor = tt.bodyColor = d ? "#e6e9ee" : "#18212b";
  tt.borderColor = d ? "#3a4350" : "#cfd6de";
  return { ink, grid, tt };
}
window.addEventListener("themechange", () => {
  if (!window.Chart) return;
  const { ink, grid, tt } = chartTheme();
  Object.values(Chart.instances || {}).forEach(ch => {
    const o = ch.options;
    Object.values(o.scales || {}).forEach(sc => {
      if (sc.grid && sc.grid.color !== "transparent" && sc.grid.display !== false) sc.grid.color = grid;
      if (sc.ticks) sc.ticks.color = ink;
      if (sc.title) sc.title.color = ink;
    });
    if (o.plugins && o.plugins.legend && o.plugins.legend.labels) o.plugins.legend.labels.color = ink;
    if (o.plugins && o.plugins.tooltip) Object.assign(o.plugins.tooltip, { backgroundColor: tt.backgroundColor, titleColor: tt.titleColor, bodyColor: tt.bodyColor, borderColor: tt.borderColor });
    (ch.data.datasets || []).forEach(ds => { if (ds.borderColor === "#ffffff" || ds.borderColor === "#161b22") ds.borderColor = COLORS.bg; });
    ch.update("none");
  });
});
