// MCP App View client — Loan Calculator interactive UI
// Bundled into loan.html by Vite + vite-plugin-singlefile

import {
  App,
  applyHostStyleVariables,
  applyDocumentTheme,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

// --- Shared types (matching server JSON envelopes) ---

interface LoanResult {
  principal: number;
  loanAmount: number;
  downPayment: number;
  annualRate: number;
  termYears: number;
  termMonths: number;
  monthlyPrincipalInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyTotal: number;
  totalInterest: number;
  totalCost: number;
  propertyTaxRate: number;
  annualInsurance: number;
}

interface AmortizationRow {
  month: number;
  payment: number;
  principalPortion: number;
  interestPortion: number;
  remainingBalance: number;
}

interface AmortizationResult {
  loanAmount: number;
  annualRate: number;
  termYears: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  schedule: AmortizationRow[];
}

interface CompareResult {
  scenarios: LoanResult[];
  bestMonthly: number;
  bestTotalInterest: number;
  bestTotalCost: number;
}

interface ViewEnvelope {
  __loancalculator__: true;
  viewType: "calculate" | "amortization" | "compare" | "error";
  data: LoanResult | AmortizationResult | CompareResult | { error: string };
}

// --- State ---
let currentViewType = "";
let currentCalcData: LoanResult | null = null;
let currentAmortData: AmortizationResult | null = null;
let currentCompareData: CompareResult | null = null;
let amortViewMode: "chart" | "table" = "chart";

// --- DOM ---
const contentEl = document.getElementById("content")!;

// --- Utilities ---
function esc(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function pct(n: number): string {
  return n.toFixed(1) + "%";
}

// --- Loan math (client-side recalculation for sliders) ---
function calcMonthly(principal: number, monthlyRate: number, termMonths: number): number {
  if (monthlyRate === 0) return principal / termMonths;
  const f = Math.pow(1 + monthlyRate, termMonths);
  return principal * (monthlyRate * f) / (f - 1);
}

function recalcFromSliders(base: LoanResult, rate: number, termYears: number, downPct: number): LoanResult {
  const downPayment = Math.round(base.principal * downPct / 100);
  const loanAmount = base.principal - downPayment;
  const monthlyRate = rate / 100 / 12;
  const termMonths = termYears * 12;
  const monthlyPI = calcMonthly(loanAmount, monthlyRate, termMonths);
  const monthlyTax = base.propertyTaxRate ? (base.principal * base.propertyTaxRate / 100) / 12 : 0;
  const monthlyInsurance = base.annualInsurance ? base.annualInsurance / 12 : 0;
  const monthlyTotal = monthlyPI + monthlyTax + monthlyInsurance;
  const totalInterest = monthlyPI * termMonths - loanAmount;
  const totalCost = monthlyTotal * termMonths + downPayment;

  return {
    ...base,
    loanAmount: Math.round(loanAmount * 100) / 100,
    downPayment,
    annualRate: rate,
    termYears,
    termMonths,
    monthlyPrincipalInterest: Math.round(monthlyPI * 100) / 100,
    monthlyTax: Math.round(monthlyTax * 100) / 100,
    monthlyInsurance: Math.round(monthlyInsurance * 100) / 100,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
  };
}

// --- Create the App instance ---
const app = new App(
  { name: "LoanCalculator", version: "0.1.0" },
  {},
  { autoResize: true }
);

// --- Host theming ---
function detectTheme(): "dark" | "light" | undefined {
  try {
    const t = (window as any).openai?.theme;
    if (t === "dark" || t === "light") return t;
  } catch { /* sandboxed */ }
  const dt = document.documentElement.getAttribute("data-theme");
  if (dt === "dark" || dt === "light") return dt as "dark" | "light";
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return undefined;
}

function applyTheme(ctx: McpUiHostContext) {
  const theme = ctx.theme || detectTheme();
  if (theme) applyDocumentTheme(theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

const earlyTheme = detectTheme();
if (earlyTheme) applyDocumentTheme(earlyTheme);

app.onhostcontextchanged = (ctx) => {
  applyTheme(ctx);
};

// --- Tool result handler ---
app.ontoolresult = (result) => {
  const content = result.content || [];

  for (const block of content) {
    if (block.type === "text" && "text" in block) {
      try {
        const parsed = JSON.parse(block.text as string);
        if (parsed && parsed.__loancalculator__) {
          handleEnvelope(parsed as ViewEnvelope);
          return;
        }
      } catch {
        // Not JSON
      }
    }
  }

  // Fallback — show raw text
  for (const block of content) {
    if (block.type === "text" && "text" in block) {
      contentEl.innerHTML = `<div style="white-space:pre-wrap;font-size:13px;padding:12px;line-height:1.6">${esc(block.text as string)}</div>`;
      return;
    }
  }

  contentEl.innerHTML = '<div class="status"><p>Received result but no content</p></div>';
};

app.ontoolcancelled = () => {
  contentEl.innerHTML = '<div class="status"><p>Tool call was cancelled</p></div>';
};

// --- Connect ---
try {
  await app.connect();
  const ctx = app.getHostContext();
  if (ctx) applyTheme(ctx);
  contentEl.innerHTML =
    '<div class="status"><p>Ready! Ask about a loan to get started.</p></div>';
} catch (err) {
  console.error("Loan Calculator bridge connect failed:", err);
  contentEl.innerHTML =
    '<div class="status"><p>Waiting for loan data...</p><p style="font-size:12px;margin-top:8px;color:var(--color-text-tertiary,#999)">Ask the AI to calculate a loan!</p></div>';
}

// --- Size notification ---
function notifySize() {
  requestAnimationFrame(() => {
    app.sendSizeChanged({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    });
  });
}

// --- Envelope handler ---
function handleEnvelope(env: ViewEnvelope) {
  currentViewType = env.viewType;

  switch (env.viewType) {
    case "calculate":
      currentCalcData = env.data as LoanResult;
      renderCalculateMode(currentCalcData);
      break;
    case "amortization":
      currentAmortData = env.data as AmortizationResult;
      amortViewMode = "chart";
      renderAmortizationMode(currentAmortData);
      break;
    case "compare":
      currentCompareData = env.data as CompareResult;
      renderCompareMode(currentCompareData);
      break;
    case "error":
      renderError((env.data as { error: string }).error);
      break;
  }

  notifySize();
}

// ======================
// CALCULATE MODE
// ======================
function renderCalculateMode(data: LoanResult) {
  const downPct = data.principal > 0 ? (data.downPayment / data.principal) * 100 : 0;

  let html = "";

  // Hero payment
  html += `
    <div class="hero-payment">
      <div class="hero-label">Monthly Payment</div>
      <div class="hero-amount" id="hero-amount">${fmt(data.monthlyTotal)}</div>
      <div class="hero-sub" id="hero-sub">${fmt(data.loanAmount)} loan at ${pct(data.annualRate)} for ${data.termYears}yr</div>
    </div>
  `;

  // Payment breakdown
  html += `<div class="section-label">Payment Breakdown</div>`;
  html += `<div class="breakdown-row">`;

  // Pie chart (SVG)
  html += `<div class="pie-wrap" id="pie-wrap">${renderPieChart(data)}</div>`;

  // Legend
  html += `<div class="breakdown-legend" id="breakdown-legend">`;
  html += renderBreakdownLegend(data);
  html += `</div></div>`;

  // Sliders
  html += `<div class="section-label" style="margin-top:16px">Adjust Parameters</div>`;
  html += `<div class="sliders-wrap">`;

  html += renderSlider("rate", "Interest Rate", data.annualRate, 0, 15, 0.1, "%");
  html += renderSlider("term", "Loan Term", data.termYears, 5, 40, 5, " years");
  html += renderSlider("down", "Down Payment", Math.round(downPct), 0, 50, 1, "%");

  html += `</div>`;

  // Summary stats
  html += `
    <div class="stats-row" id="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Interest</div>
        <div class="stat-value" id="stat-interest">${fmt(data.totalInterest)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Cost</div>
        <div class="stat-value" id="stat-cost">${fmt(data.totalCost)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Loan Amount</div>
        <div class="stat-value" id="stat-loan">${fmt(data.loanAmount)}</div>
      </div>
    </div>
  `;

  contentEl.innerHTML = html;

  // Attach slider events
  attachSliderEvents(data);
  notifySize();
}

function renderPieChart(data: LoanResult): string {
  const total = data.monthlyPrincipalInterest + data.monthlyTax + data.monthlyInsurance;
  if (total === 0) return "";

  const slices: { value: number; color: string; label: string }[] = [];

  // Calculate total interest vs principal per month
  const monthlyInterest = data.loanAmount > 0
    ? (data.loanAmount * (data.annualRate / 100 / 12))
    : 0;
  const monthlyPrincipal = data.monthlyPrincipalInterest - monthlyInterest;

  slices.push({ value: monthlyPrincipal, color: "var(--color-pie-principal, #3b82f6)", label: "Principal" });
  slices.push({ value: monthlyInterest, color: "var(--color-pie-interest, #f59e0b)", label: "Interest" });
  if (data.monthlyTax > 0) slices.push({ value: data.monthlyTax, color: "var(--color-pie-tax, #10b981)", label: "Tax" });
  if (data.monthlyInsurance > 0) slices.push({ value: data.monthlyInsurance, color: "var(--color-pie-insurance, #8b5cf6)", label: "Insurance" });

  const size = 120;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  let cumulativeAngle = -Math.PI / 2;

  let paths = "";
  for (const slice of slices) {
    const angle = (slice.value / total) * 2 * Math.PI;
    if (slice.value <= 0) continue;

    const x1 = cx + r * Math.cos(cumulativeAngle);
    const y1 = cy + r * Math.sin(cumulativeAngle);
    const x2 = cx + r * Math.cos(cumulativeAngle + angle);
    const y2 = cy + r * Math.sin(cumulativeAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${slice.color}" />`;
    cumulativeAngle += angle;
  }

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block">${paths}</svg>`;
}

function renderBreakdownLegend(data: LoanResult): string {
  const total = data.monthlyTotal;
  if (total === 0) return "";

  const monthlyInterest = data.loanAmount > 0
    ? (data.loanAmount * (data.annualRate / 100 / 12))
    : 0;
  const monthlyPrincipal = data.monthlyPrincipalInterest - monthlyInterest;

  let html = "";
  html += legendItem("Principal", monthlyPrincipal, total, "var(--color-pie-principal, #3b82f6)");
  html += legendItem("Interest", monthlyInterest, total, "var(--color-pie-interest, #f59e0b)");
  if (data.monthlyTax > 0) html += legendItem("Tax", data.monthlyTax, total, "var(--color-pie-tax, #10b981)");
  if (data.monthlyInsurance > 0) html += legendItem("Insurance", data.monthlyInsurance, total, "var(--color-pie-insurance, #8b5cf6)");
  return html;
}

function legendItem(label: string, value: number, total: number, color: string): string {
  return `<div class="legend-item">
    <span class="legend-dot" style="background:${color}"></span>
    <span class="legend-label">${label}</span>
    <span class="legend-value">${fmtFull(value)}</span>
    <span class="legend-pct">${((value / total) * 100).toFixed(0)}%</span>
  </div>`;
}

function renderSlider(id: string, label: string, value: number, min: number, max: number, step: number, suffix: string): string {
  return `<div class="slider-group">
    <div class="slider-header">
      <span class="slider-label">${label}</span>
      <span class="slider-value" id="val-${id}">${id === "down" ? value + suffix : (id === "rate" ? value.toFixed(1) + suffix : value + suffix)}</span>
    </div>
    <input type="range" id="slider-${id}" class="slider" min="${min}" max="${max}" step="${step}" value="${value}" />
  </div>`;
}

function attachSliderEvents(baseData: LoanResult) {
  const rateSlider = document.getElementById("slider-rate") as HTMLInputElement;
  const termSlider = document.getElementById("slider-term") as HTMLInputElement;
  const downSlider = document.getElementById("slider-down") as HTMLInputElement;

  if (!rateSlider || !termSlider || !downSlider) return;

  const downPct = baseData.principal > 0 ? (baseData.downPayment / baseData.principal) * 100 : 0;

  function update() {
    const rate = parseFloat(rateSlider.value);
    const term = parseInt(termSlider.value);
    const down = parseInt(downSlider.value);

    document.getElementById("val-rate")!.textContent = rate.toFixed(1) + "%";
    document.getElementById("val-term")!.textContent = term + " years";
    document.getElementById("val-down")!.textContent = down + "%";

    const updated = recalcFromSliders(baseData, rate, term, down);

    document.getElementById("hero-amount")!.textContent = fmt(updated.monthlyTotal);
    document.getElementById("hero-sub")!.textContent = `${fmt(updated.loanAmount)} loan at ${pct(updated.annualRate)} for ${updated.termYears}yr`;

    document.getElementById("pie-wrap")!.innerHTML = renderPieChart(updated);
    document.getElementById("breakdown-legend")!.innerHTML = renderBreakdownLegend(updated);

    document.getElementById("stat-interest")!.textContent = fmt(updated.totalInterest);
    document.getElementById("stat-cost")!.textContent = fmt(updated.totalCost);
    document.getElementById("stat-loan")!.textContent = fmt(updated.loanAmount);

    currentCalcData = updated;
    notifySize();
  }

  rateSlider.addEventListener("input", update);
  termSlider.addEventListener("input", update);
  downSlider.addEventListener("input", update);
}

// ======================
// AMORTIZATION MODE
// ======================
function renderAmortizationMode(data: AmortizationResult) {
  let html = "";

  // Header
  html += `
    <div class="hero-payment">
      <div class="hero-label">Monthly Payment</div>
      <div class="hero-amount">${fmt(data.monthlyPayment)}</div>
      <div class="hero-sub">${fmt(data.loanAmount)} at ${pct(data.annualRate)} for ${data.termYears}yr — Total Interest: ${fmt(data.totalInterest)}</div>
    </div>
  `;

  // Toggle: chart / table
  html += `
    <div class="toggle-wrap">
      <button class="toggle-btn ${amortViewMode === "chart" ? "active" : ""}" id="btn-amort-chart">Chart</button>
      <button class="toggle-btn ${amortViewMode === "table" ? "active" : ""}" id="btn-amort-table">Table</button>
    </div>
  `;

  html += `<div id="amort-content">`;
  if (amortViewMode === "chart") {
    html += renderAmortChart(data);
  } else {
    html += renderAmortTable(data);
  }
  html += `</div>`;

  contentEl.innerHTML = html;

  // Toggle events
  document.getElementById("btn-amort-chart")?.addEventListener("click", () => {
    amortViewMode = "chart";
    if (currentAmortData) renderAmortizationMode(currentAmortData);
  });
  document.getElementById("btn-amort-table")?.addEventListener("click", () => {
    amortViewMode = "table";
    if (currentAmortData) renderAmortizationMode(currentAmortData);
  });

  notifySize();
}

function renderAmortChart(data: AmortizationResult): string {
  const schedule = data.schedule;
  const w = 500, h = 200, padL = 10, padR = 10, padT = 10, padB = 20;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Sample every N months to keep SVG manageable
  const step = Math.max(1, Math.floor(schedule.length / 100));
  const sampled = schedule.filter((_, i) => i % step === 0 || i === schedule.length - 1);

  const maxBalance = data.loanAmount;

  // Build cumulative principal and interest
  let cumPrincipal = 0, cumInterest = 0;
  const principalLine: string[] = [];
  const interestLine: string[] = [];
  const balanceLine: string[] = [];

  for (const row of sampled) {
    const x = padL + (row.month / data.termMonths) * chartW;
    const by = padT + (1 - row.remainingBalance / maxBalance) * chartH;
    balanceLine.push(`${x},${by}`);
  }

  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block;max-width:${w}px">`;

  // Balance line
  svg += `<polyline points="${balanceLine.join(" ")}" fill="none" stroke="var(--color-pie-principal, #3b82f6)" stroke-width="2" />`;

  // X axis labels
  const years = [0, Math.round(data.termYears / 4), Math.round(data.termYears / 2), Math.round(data.termYears * 3 / 4), data.termYears];
  for (const y of years) {
    const x = padL + (y / data.termYears) * chartW;
    svg += `<text x="${x}" y="${h - 2}" text-anchor="middle" font-size="10" fill="var(--color-text-tertiary, #999)">Yr ${y}</text>`;
  }

  svg += `</svg>`;
  return `<div class="section-label">Remaining Balance Over Time</div>${svg}`;
}

function renderAmortTable(data: AmortizationResult): string {
  const schedule = data.schedule;
  let html = `<div class="amort-table-wrap"><table class="amort-table">
    <thead><tr>
      <th>Month</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th>
    </tr></thead><tbody>`;

  // Show yearly summaries + ability to expand
  for (let year = 1; year <= data.termYears; year++) {
    const startIdx = (year - 1) * 12;
    const endIdx = Math.min(year * 12, schedule.length);
    const yearRows = schedule.slice(startIdx, endIdx);

    const yearPrincipal = yearRows.reduce((s, r) => s + r.principalPortion, 0);
    const yearInterest = yearRows.reduce((s, r) => s + r.interestPortion, 0);
    const yearPayment = yearRows.reduce((s, r) => s + r.payment, 0);
    const endBalance = yearRows[yearRows.length - 1]?.remainingBalance ?? 0;

    html += `<tr class="year-row" data-year="${year}">
      <td><strong>Year ${year}</strong></td>
      <td>${fmtFull(yearPayment)}</td>
      <td>${fmtFull(yearPrincipal)}</td>
      <td>${fmtFull(yearInterest)}</td>
      <td>${fmtFull(endBalance)}</td>
    </tr>`;

    // Month detail rows (hidden by default)
    for (const row of yearRows) {
      html += `<tr class="month-row month-year-${year}" style="display:none">
        <td style="padding-left:20px">${row.month}</td>
        <td>${fmtFull(row.payment)}</td>
        <td>${fmtFull(row.principalPortion)}</td>
        <td>${fmtFull(row.interestPortion)}</td>
        <td>${fmtFull(row.remainingBalance)}</td>
      </tr>`;
    }
  }

  html += `</tbody></table></div>`;

  // Add click-to-expand after render
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>(".year-row").forEach((row) => {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        const year = row.dataset.year;
        const monthRows = document.querySelectorAll<HTMLElement>(`.month-year-${year}`);
        const visible = monthRows[0]?.style.display !== "none";
        monthRows.forEach((r) => r.style.display = visible ? "none" : "");
        notifySize();
      });
    });
  }, 0);

  return html;
}

// ======================
// COMPARE MODE
// ======================
function renderCompareMode(data: CompareResult) {
  let html = "";

  html += `<div class="section-label">Loan Comparison</div>`;
  html += `<div class="compare-grid" style="grid-template-columns: repeat(${data.scenarios.length}, 1fr)">`;

  data.scenarios.forEach((s, i) => {
    const isBestMonthly = i === data.bestMonthly;
    const isBestInterest = i === data.bestTotalInterest;
    const isBestCost = i === data.bestTotalCost;

    html += `<div class="compare-card ${isBestCost ? "best-card" : ""}">`;
    html += `<div class="compare-header">Scenario ${i + 1}</div>`;
    html += `<div class="compare-rate">${pct(s.annualRate)} / ${s.termYears}yr</div>`;
    html += `<div class="compare-loan">${fmt(s.loanAmount)}</div>`;

    html += `<div class="compare-stat">
      <span>Monthly</span>
      <span class="${isBestMonthly ? "best-value" : ""}">${fmt(s.monthlyTotal)} ${isBestMonthly ? "✓" : ""}</span>
    </div>`;
    html += `<div class="compare-stat">
      <span>Total Interest</span>
      <span class="${isBestInterest ? "best-value" : ""}">${fmt(s.totalInterest)} ${isBestInterest ? "✓" : ""}</span>
    </div>`;
    html += `<div class="compare-stat">
      <span>Total Cost</span>
      <span class="${isBestCost ? "best-value" : ""}">${fmt(s.totalCost)} ${isBestCost ? "✓" : ""}</span>
    </div>`;

    if (s.downPayment > 0) {
      html += `<div class="compare-stat"><span>Down Payment</span><span>${fmt(s.downPayment)}</span></div>`;
    }

    html += `</div>`;
  });

  html += `</div>`;

  contentEl.innerHTML = html;
  notifySize();
}

// ======================
// ERROR MODE
// ======================
function renderError(message: string) {
  contentEl.innerHTML = `<div class="error-msg">${esc(message)}</div>`;
  notifySize();
}
