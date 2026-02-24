// MCP App View client — Regex Playground interactive UI
// Bundled into mcp-app.html by Vite + vite-plugin-singlefile

import {
  App,
  applyHostStyleVariables,
  applyDocumentTheme,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

// --- Shared types (matching server JSON envelopes) ---

interface RegexMatch {
  index: number;
  match: string;
  groups: string[];
  namedGroups?: Record<string, string>;
}

interface RegexTestResult {
  pattern: string;
  flags: string;
  testString: string;
  matches: RegexMatch[];
  matchCount: number;
  error?: string;
}

interface Token {
  token: string;
  category: string;
  description: string;
}

interface ExplainResult {
  pattern: string;
  flags: string;
  tokens: Token[];
  summary: string;
  flagDescriptions: { flag: string; description: string }[];
}

interface ValidationResult {
  input: string;
  shouldMatch: boolean;
  didMatch: boolean;
  passed: boolean;
}

interface GenerateData {
  pattern: string;
  flags: string;
  results: ValidationResult[];
  passCount: number;
  totalCount: number;
  description: string;
  error?: string;
}

interface PatternEntry {
  name: string;
  pattern: string;
  flags: string;
  category: string;
  description: string;
  example: string;
}

interface CheatsheetData {
  patterns: PatternEntry[];
  categories: string[];
  activeCategory: string;
}

interface ViewEnvelope {
  __regexplayground__: true;
  viewType: "test" | "explain" | "generate" | "cheatsheet";
  data: RegexTestResult | ExplainResult | GenerateData | CheatsheetData;
}

// --- State ---
let currentViewType: string = "";
let currentTestData: RegexTestResult | null = null;
let currentCheatsheetData: CheatsheetData | null = null;
let currentGenerateData: GenerateData | null = null;
let activeCheatsheetCategory = "All";

// --- DOM refs ---
const contentEl = document.getElementById("content")!;
const modeBadge = document.getElementById("mode-badge");

// --- Match highlight color palette ---
const HIGHLIGHT_COLORS = [
  "match-hl-0", "match-hl-1", "match-hl-2",
  "match-hl-3", "match-hl-4", "match-hl-5",
];

// --- Create the App instance ---
const app = new App(
  { name: "RegexPlayground", version: "0.1.0" },
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

// Apply theme early before ext-apps connects
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
        if (parsed && parsed.__regexplayground__) {
          handleEnvelope(parsed as ViewEnvelope);
          return;
        }
      } catch {
        // Not JSON — skip
      }
    }
  }

  // Fallback
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
    '<div class="status"><p>Ready! Ask the AI to test or explain a regex.</p></div>';
} catch (err) {
  console.error("Regex Playground bridge connect failed:", err);
  contentEl.innerHTML =
    '<div class="status"><p>Waiting for regex data...</p><p style="font-size:12px;margin-top:8px;color:var(--color-text-tertiary,#999)">Ask the AI to test or explain a regex!</p></div>';
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
    case "test":
      currentTestData = env.data as RegexTestResult;
      if (modeBadge) modeBadge.textContent ="Test";
      renderTestMode(currentTestData);
      break;
    case "explain":
      if (modeBadge) modeBadge.textContent ="Explain";
      renderExplainMode(env.data as ExplainResult);
      break;
    case "generate":
      currentGenerateData = env.data as GenerateData;
      if (modeBadge) modeBadge.textContent ="Generate";
      renderGenerateMode(currentGenerateData);
      break;
    case "cheatsheet":
      currentCheatsheetData = env.data as CheatsheetData;
      activeCheatsheetCategory = currentCheatsheetData.activeCategory || "All";
      if (modeBadge) modeBadge.textContent ="Cheatsheet";
      renderCheatsheetMode(currentCheatsheetData);
      break;
  }

  notifySize();
}

// =====================
// TEST MODE
// =====================

function renderTestMode(data: RegexTestResult) {
  let html = "";

  // Pattern bar (editable)
  html += `
    <div class="pattern-bar">
      <div class="pattern-input-wrap">
        <span class="slash">/</span>
        <input type="text" id="pattern-input" value="${escAttr(data.pattern)}" placeholder="pattern">
        <span class="slash-end">/</span>
        <input type="text" id="flags-input" class="flags-input" value="${escAttr(data.flags)}" placeholder="flags">
      </div>
      <button class="copy-btn" id="copy-pattern-btn">Copy</button>
    </div>
  `;

  // Test string (editable)
  html += `
    <div class="test-string-area">
      <label>Test String</label>
      <textarea id="test-textarea">${esc(data.testString)}</textarea>
    </div>
  `;

  if (data.error) {
    html += `<div class="error-msg">${esc(data.error)}</div>`;
  } else {
    // Highlighted output
    html += `<div class="section-label">Highlighted Matches <span id="match-count" style="color:var(--color-text-info,#3b82f6)">${data.matchCount} match${data.matchCount !== 1 ? "es" : ""}</span></div>`;
    html += `<div class="highlight-output" id="highlight-output">${buildHighlightedHtml(data)}</div>`;

    // Match table
    if (data.matches.length > 0) {
      html += buildMatchTable(data);
    }
  }

  contentEl.innerHTML = html;

  // Wire up live editing
  const patternInput = document.getElementById("pattern-input") as HTMLInputElement;
  const flagsInput = document.getElementById("flags-input") as HTMLInputElement;
  const testTextarea = document.getElementById("test-textarea") as HTMLTextAreaElement;
  const copyBtn = document.getElementById("copy-pattern-btn")!;

  const rerun = () => {
    const result = runRegexClientSide(patternInput.value, flagsInput.value, testTextarea.value);
    currentTestData = result;
    updateTestResults(result);
  };

  patternInput.addEventListener("input", rerun);
  flagsInput.addEventListener("input", rerun);
  testTextarea.addEventListener("input", rerun);

  copyBtn.addEventListener("click", () => {
    const text = `/${patternInput.value}/${flagsInput.value}`;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });
  });
}

function updateTestResults(data: RegexTestResult) {
  const highlightEl = document.getElementById("highlight-output");
  const matchCountEl = document.getElementById("match-count");

  if (data.error) {
    if (highlightEl) highlightEl.innerHTML = `<span style="color:var(--color-text-danger,#ef4444)">${esc(data.error)}</span>`;
    if (matchCountEl) matchCountEl.textContent = "Error";
    // Remove table
    const tableEl = contentEl.querySelector(".match-table");
    if (tableEl) tableEl.remove();
    // Remove old section label for table
    const labels = contentEl.querySelectorAll(".section-label");
    if (labels.length > 1) labels[1].remove();
    return;
  }

  if (highlightEl) highlightEl.innerHTML = buildHighlightedHtml(data);
  if (matchCountEl) matchCountEl.textContent = `${data.matchCount} match${data.matchCount !== 1 ? "es" : ""}`;

  // Update or create match table
  const existingTable = contentEl.querySelector(".match-table");
  const existingLabel = contentEl.querySelectorAll(".section-label")[1];

  if (data.matches.length > 0) {
    const tableHtml = buildMatchTable(data);
    if (existingTable) {
      existingTable.outerHTML = tableHtml;
    } else {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = tableHtml;
      contentEl.appendChild(wrapper.firstElementChild!);
    }
  } else {
    if (existingTable) existingTable.remove();
    if (existingLabel) existingLabel.remove();
  }

  notifySize();
}

function buildHighlightedHtml(data: RegexTestResult): string {
  if (data.matches.length === 0) return esc(data.testString);

  const str = data.testString;
  let html = "";
  let lastIdx = 0;

  for (let i = 0; i < data.matches.length && i < 100; i++) {
    const m = data.matches[i];
    if (m.index > lastIdx) {
      html += esc(str.substring(lastIdx, m.index));
    }
    const colorClass = HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length];
    html += `<span class="${colorClass}">${esc(m.match)}</span>`;
    lastIdx = m.index + m.match.length;
  }

  if (lastIdx < str.length) {
    html += esc(str.substring(lastIdx));
  }

  return html;
}

function buildMatchTable(data: RegexTestResult): string {
  const maxGroups = Math.max(...data.matches.map((m) => m.groups.length), 0);
  const hasNamed = data.matches.some((m) => m.namedGroups);

  let html = `<table class="match-table"><thead><tr>
    <th>#</th><th>Match</th><th>Index</th>`;

  if (hasNamed && data.matches[0]?.namedGroups) {
    const names = Object.keys(data.matches[0].namedGroups);
    for (const name of names) {
      html += `<th>${esc(name)}</th>`;
    }
  } else {
    for (let g = 1; g <= maxGroups; g++) {
      html += `<th>Group ${g}</th>`;
    }
  }

  html += `</tr></thead><tbody>`;

  for (let i = 0; i < data.matches.length && i < 100; i++) {
    const m = data.matches[i];
    html += `<tr><td>${i + 1}</td><td>${esc(m.match)}</td><td>${m.index}</td>`;

    if (hasNamed && m.namedGroups) {
      for (const v of Object.values(m.namedGroups)) {
        html += `<td>${esc(v)}</td>`;
      }
    } else {
      for (let g = 0; g < maxGroups; g++) {
        html += `<td>${esc(m.groups[g] ?? "")}</td>`;
      }
    }

    html += `</tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

function runRegexClientSide(pattern: string, flags: string, testString: string): RegexTestResult {
  try {
    const effectiveFlags = flags.includes("g") ? flags : flags + "g";
    const re = new RegExp(pattern, effectiveFlags);
    const matches: RegexMatch[] = [];
    let m: RegExpExecArray | null;
    let safety = 0;

    while ((m = re.exec(testString)) !== null && safety < 100) {
      safety++;
      const groups: string[] = [];
      for (let i = 1; i < m.length; i++) {
        groups.push(m[i] ?? "");
      }
      const named: Record<string, string> = {};
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          named[k] = v ?? "";
        }
      }
      matches.push({
        index: m.index,
        match: m[0],
        groups,
        namedGroups: Object.keys(named).length > 0 ? named : undefined,
      });
      if (m[0].length === 0) re.lastIndex++;
    }

    return { pattern, flags, testString, matches, matchCount: matches.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pattern, flags, testString, matches: [], matchCount: 0, error: msg };
  }
}

// =====================
// EXPLAIN MODE
// =====================

function renderExplainMode(data: ExplainResult) {
  let html = "";

  // Token strip
  html += `<div class="section-label">Pattern Breakdown</div>`;
  html += `<div class="token-strip">`;
  for (const t of data.tokens) {
    const catClass = `cat-${t.category}`;
    html += `<span class="token-chip ${catClass}" title="${escAttr(t.description)}">${esc(t.token)}</span>`;
  }
  html += `</div>`;

  // Token list
  html += `<ul class="token-list">`;
  for (const t of data.tokens) {
    const catClass = `cat-${t.category}`;
    html += `<li>
      <span class="tl-token">${esc(t.token)}</span>
      <span class="tl-desc">${esc(t.description)}</span>
      <span class="tl-cat ${catClass}">${esc(t.category)}</span>
    </li>`;
  }
  html += `</ul>`;

  // Summary
  html += `<div class="summary-text">${esc(data.summary)}</div>`;

  // Flags
  if (data.flagDescriptions.length > 0) {
    html += `<div class="section-label">Flags</div>`;
    html += `<div class="flags-section">`;
    for (const f of data.flagDescriptions) {
      html += `<div class="flag-item"><span class="flag-char">${esc(f.flag)}</span><span>${esc(f.description)}</span></div>`;
    }
    html += `</div>`;
  }

  contentEl.innerHTML = html;
}

// =====================
// GENERATE MODE
// =====================

function renderGenerateMode(data: GenerateData) {
  let html = "";

  // Description banner
  if (data.description) {
    html += `<div class="desc-banner">${esc(data.description)}</div>`;
  }

  // Pattern block (editable)
  html += `
    <div class="pattern-bar">
      <div class="pattern-input-wrap">
        <span class="slash">/</span>
        <input type="text" id="gen-pattern-input" value="${escAttr(data.pattern)}" placeholder="pattern">
        <span class="slash-end">/</span>
        <input type="text" id="gen-flags-input" class="flags-input" value="${escAttr(data.flags)}" placeholder="flags">
      </div>
      <button class="copy-btn" id="copy-gen-btn">Copy</button>
    </div>
  `;

  if (data.error) {
    html += `<div class="error-msg">${esc(data.error)}</div>`;
  }

  // Score badge
  const scoreClass = data.passCount === data.totalCount ? "score-pass" : data.passCount > 0 ? "score-partial" : "score-fail";
  html += `<div style="margin-bottom:12px"><span class="score-badge ${scoreClass}">${data.passCount}/${data.totalCount} passed</span></div>`;

  // Test cases
  html += `<ul class="test-case-list" id="gen-results">`;
  html += buildTestCaseListItems(data.results);
  html += `</ul>`;

  contentEl.innerHTML = html;

  // Wire up live editing
  const patternInput = document.getElementById("gen-pattern-input") as HTMLInputElement;
  const flagsInput = document.getElementById("gen-flags-input") as HTMLInputElement;
  const copyBtn = document.getElementById("copy-gen-btn")!;

  const rerun = () => {
    const pattern = patternInput.value;
    const flags = flagsInput.value;
    const cases = currentGenerateData?.results.map((r) => ({
      input: r.input,
      shouldMatch: r.shouldMatch,
    })) || [];

    try {
      const re = new RegExp(pattern, flags);
      const results: ValidationResult[] = cases.map((c) => {
        const didMatch = re.test(c.input);
        return { input: c.input, shouldMatch: c.shouldMatch, didMatch, passed: didMatch === c.shouldMatch };
      });
      const passCount = results.filter((r) => r.passed).length;

      const listEl = document.getElementById("gen-results");
      if (listEl) listEl.innerHTML = buildTestCaseListItems(results);

      const badgeEl = contentEl.querySelector(".score-badge");
      if (badgeEl) {
        badgeEl.textContent = `${passCount}/${results.length} passed`;
        badgeEl.className = `score-badge ${passCount === results.length ? "score-pass" : passCount > 0 ? "score-partial" : "score-fail"}`;
      }

      // Clear error
      const errEl = contentEl.querySelector(".error-msg");
      if (errEl) errEl.remove();
    } catch (err: unknown) {
      const errEl = contentEl.querySelector(".error-msg");
      const msg = err instanceof Error ? err.message : String(err);
      if (errEl) {
        errEl.textContent = msg;
      } else {
        const div = document.createElement("div");
        div.className = "error-msg";
        div.textContent = msg;
        patternInput.closest(".pattern-bar")!.insertAdjacentElement("afterend", div);
      }
    }

    notifySize();
  };

  patternInput.addEventListener("input", rerun);
  flagsInput.addEventListener("input", rerun);

  copyBtn.addEventListener("click", () => {
    const text = `/${patternInput.value}/${flagsInput.value}`;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });
  });
}

function buildTestCaseListItems(results: ValidationResult[]): string {
  return results.map((r) => {
    const cls = r.passed ? "tc-pass" : "tc-fail";
    const icon = r.passed ? "PASS" : "FAIL";
    const expected = r.shouldMatch ? "should match" : "should not match";
    return `<li class="${cls}">
      <span class="tc-icon">${icon}</span>
      <span class="tc-input">${esc(r.input)}</span>
      <span class="tc-expected">${expected}</span>
    </li>`;
  }).join("");
}

// =====================
// CHEATSHEET MODE
// =====================

function renderCheatsheetMode(data: CheatsheetData) {
  let html = "";

  // Filter pills
  html += `<div class="filter-pills" id="filter-pills">`;
  for (const cat of data.categories) {
    const active = activeCheatsheetCategory === cat ? "active" : "";
    html += `<button class="pill ${active}" data-cat="${escAttr(cat)}">${esc(cat)}</button>`;
  }
  html += `</div>`;

  // Pattern cards
  html += `<div class="pattern-cards" id="pattern-cards">`;
  html += buildPatternCards(getFilteredCheatsheetPatterns(data.patterns));
  html += `</div>`;

  contentEl.innerHTML = html;

  // Wire up filter pills
  document.querySelectorAll("#filter-pills .pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCheatsheetCategory = (btn as HTMLElement).dataset.cat || "All";
      renderCheatsheetMode(data);
    });
  });

  wireUpTryButtons();
}

function getFilteredCheatsheetPatterns(patterns: PatternEntry[]): PatternEntry[] {
  let filtered = patterns;
  if (activeCheatsheetCategory && activeCheatsheetCategory !== "All") {
    filtered = filtered.filter((p) => p.category === activeCheatsheetCategory);
  }
  return filtered;
}

function buildPatternCards(patterns: PatternEntry[]): string {
  if (patterns.length === 0) {
    return '<div class="status"><p>No patterns match your search</p></div>';
  }
  return patterns.map((p, i) => `
    <div class="pattern-card">
      <div class="pc-name">${esc(p.name)}</div>
      <div class="pc-pattern">/${esc(p.pattern)}/${esc(p.flags)}</div>
      <div class="pc-desc">${esc(p.description)}</div>
      <div class="pc-example">Example: ${esc(p.example)}</div>
      <button class="try-btn" data-idx="${i}">Try It</button>
    </div>
  `).join("");
}

function wireUpTryButtons() {
  document.querySelectorAll(".try-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt((btn as HTMLElement).dataset.idx || "0", 10);
      const patterns = getFilteredCheatsheetPatterns(currentCheatsheetData?.patterns || []);
      const p = patterns[idx];
      if (p) {
        // Switch to test mode with this pattern
        const result = runRegexClientSide(p.pattern, p.flags || "g", p.example);
        currentTestData = result;
        currentViewType = "test";
        if (modeBadge) modeBadge.textContent ="Test";
        renderTestMode(result);
        notifySize();
      }
    });
  });
}

// --- Helpers ---

function esc(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
