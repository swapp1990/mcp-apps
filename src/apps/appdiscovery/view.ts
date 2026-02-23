// MCP App View client — rich interactive UI with host theming
// Bundled into mcp-app.html by Vite + vite-plugin-singlefile

import {
  App,
  applyHostStyleVariables,
  applyDocumentTheme,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

// --- Types matching server App interface ---
interface AppData {
  id: string;
  name: string;
  platform: "ios" | "android" | "both";
  category: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  pros: string[];
  cons: string[];
  developer: string;
  appStoreUrl: string;
  playStoreUrl?: string;
  iconUrl?: string;
  screenshotUrls: string[];
  lastUpdated: string;
  addedAt: string;
}

interface ViewEnvelope {
  __appdiscovery__: true;
  viewType: "search" | "detail" | "compare" | "alternatives";
  data: {
    results?: AppData[];
    app?: AppData | null;
    apps?: AppData[];
    sourceApp?: AppData | null;
    alternatives?: AppData[];
  };
}

type SortKey = "rating" | "price" | "name";

// --- State ---
let allApps: AppData[] = [];
let currentCategory: string | null = null;
let currentSort: SortKey = "rating";
let currentViewType: string = "search";
let sourceApp: AppData | null = null;

// --- DOM refs ---
const resultsEl = document.getElementById("results")!;
const filtersEl = document.getElementById("filters")!;
const toolbarEl = document.getElementById("toolbar")!;
const sortControlsEl = document.getElementById("sort-controls")!;
const appCountEl = document.getElementById("app-count")!;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchBtn = document.getElementById("search-btn")!;
const listView = document.getElementById("list-view")!;
const detailView = document.getElementById("detail-view")!;
const detailContent = document.getElementById("detail-content")!;
const backBtn = document.getElementById("back-btn")!;

// --- Create the App instance ---
const app = new App(
  { name: "AppDiscovery", version: "0.1.0" },
  {},
  { autoResize: true }
);

// --- Host theming ---
function applyTheme(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

app.onhostcontextchanged = (ctx) => {
  applyTheme(ctx);
};

// --- Event handlers (registered BEFORE connect) ---
app.ontoolinput = (params) => {
  const args = params.arguments || {};
  if (args.keywords && typeof args.keywords === "string") {
    searchInput.value = args.keywords;
  }
};

app.ontoolresult = (result) => {
  const content = result.content || [];
  let handled = false;

  // Try to find JSON envelope in content blocks
  for (const block of content) {
    if (block.type === "text" && "text" in block) {
      const text = block.text as string;
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.__appdiscovery__) {
          handleEnvelope(parsed as ViewEnvelope);
          handled = true;
          break;
        }
      } catch {
        // Not JSON — skip (this is the text block for AI)
      }
    }
  }

  if (!handled) {
    // Fallback: show raw text
    for (const block of content) {
      if (block.type === "text" && "text" in block) {
        resultsEl.innerHTML = `<div style="white-space:pre-wrap;font-size:13px;padding:12px;line-height:1.6">${esc(block.text as string)}</div>`;
        handled = true;
        break;
      }
    }
  }

  if (!handled) {
    resultsEl.innerHTML = '<div class="status"><p>Received result but no content</p></div>';
  }
};

app.ontoolcancelled = () => {
  resultsEl.innerHTML = '<div class="status"><p>Tool call was cancelled</p></div>';
};

// --- Connect ---
try {
  await app.connect();
  // Apply initial host context
  const ctx = app.getHostContext();
  if (ctx) applyTheme(ctx);
  resultsEl.innerHTML =
    '<div class="status"><p>Ready! Ask the AI to search for apps.</p></div>';
} catch (err) {
  console.error("AppDiscovery bridge connect failed:", err);
  resultsEl.innerHTML =
    '<div class="status"><p>Waiting for app data...</p><p style="font-size:12px;margin-top:8px;color:var(--color-text-tertiary,#999)">Ask the AI to search for apps!</p></div>';
}

// --- Manual size notification (backup for autoResize) ---
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
  showList();

  switch (env.viewType) {
    case "search":
      allApps = env.data.results || [];
      sourceApp = null;
      currentCategory = null;
      currentSort = "rating";
      renderSearchView();
      break;

    case "detail":
      if (env.data.app) {
        showDetailView(env.data.app);
      } else {
        resultsEl.innerHTML = '<div class="status"><p>App not found</p></div>';
      }
      break;

    case "compare":
      renderCompareView(env.data.apps || []);
      break;

    case "alternatives":
      sourceApp = env.data.sourceApp || null;
      allApps = env.data.alternatives || [];
      currentCategory = null;
      currentSort = "rating";
      renderAlternativesView();
      break;
  }

  notifySize();
}

// --- Render: Search results ---
function renderSearchView() {
  const filtered = getFilteredSorted();
  renderToolbar(true);
  renderApps(filtered);
  appCountEl.textContent = allApps.length + " apps";
}

function getFilteredSorted(): AppData[] {
  let apps = currentCategory
    ? allApps.filter((a) => a.category === currentCategory)
    : [...allApps];

  // Client-side text search
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    apps = apps.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.shortDescription.toLowerCase().includes(query) ||
        a.features.some((f) => f.toLowerCase().includes(query))
    );
  }

  // Sort
  switch (currentSort) {
    case "rating":
      apps.sort((a, b) => b.rating - a.rating);
      break;
    case "price":
      apps.sort((a, b) => a.price - b.price);
      break;
    case "name":
      apps.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return apps;
}

function renderToolbar(showSort: boolean) {
  toolbarEl.style.display = "flex";

  // Category filters
  const categories = [...new Set(allApps.map((a) => a.category).filter(Boolean))];
  filtersEl.innerHTML = `
    <button class="filter-btn ${!currentCategory ? "active" : ""}" data-cat="">All</button>
    ${categories.map((c) => `<button class="filter-btn ${currentCategory === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
  `;
  filtersEl.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = (btn as HTMLElement).dataset.cat || null;
      currentCategory = cat || null;
      renderSearchView();
    });
  });

  // Sort controls
  if (showSort && allApps.length > 1) {
    sortControlsEl.innerHTML = `
      <span class="sort-label">Sort:</span>
      <button class="sort-btn ${currentSort === "rating" ? "active" : ""}" data-sort="rating">Rating</button>
      <button class="sort-btn ${currentSort === "price" ? "active" : ""}" data-sort="price">Price</button>
      <button class="sort-btn ${currentSort === "name" ? "active" : ""}" data-sort="name">Name</button>
    `;
    sortControlsEl.querySelectorAll(".sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentSort = ((btn as HTMLElement).dataset.sort || "rating") as SortKey;
        renderSearchView();
      });
    });
  } else {
    sortControlsEl.innerHTML = "";
  }
}

function renderApps(apps: AppData[]) {
  if (apps.length === 0) {
    resultsEl.innerHTML = '<div class="status"><p>No apps found</p><p style="font-size:12px;margin-top:8px;color:var(--color-text-tertiary,#999)">Try different keywords or filters</p></div>';
    return;
  }

  resultsEl.innerHTML = apps
    .map(
      (a, i) => `
    <div class="app-card" data-index="${i}">
      <div class="icon">${iconHtml(a, 48)}</div>
      <div class="info">
        <div class="name">${esc(a.name)}</div>
        <div class="desc">${esc(a.shortDescription)}</div>
        <div class="meta">
          ${starHtml(a.rating)}
          <span class="star-count">(${formatCount(a.reviewCount)})</span>
          ${priceBadge(a.price)}
          ${platformPill(a.platform)}
        </div>
      </div>
    </div>`
    )
    .join("");

  // Click handlers
  resultsEl.querySelectorAll(".app-card").forEach((card) => {
    card.addEventListener("click", () => {
      const idx = parseInt((card as HTMLElement).dataset.index || "0", 10);
      const filtered = getFilteredSorted();
      if (filtered[idx]) showDetailView(filtered[idx]);
    });
  });
}

// --- Render: Detail view ---
function showDetailView(a: AppData) {
  listView.style.display = "none";
  detailView.classList.add("active");

  detailContent.innerHTML = `
    <div class="detail-header">
      <div class="icon">${iconHtml(a, 64)}</div>
      <div class="info">
        <h2>${esc(a.name)}</h2>
        <div class="developer">${esc(a.developer)}</div>
        <div class="meta">
          ${starHtml(a.rating)}
          <span class="star-count">(${formatCount(a.reviewCount)} reviews)</span>
          ${priceBadge(a.price)}
          ${platformPill(a.platform)}
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>About</h3>
      <p>${esc(a.fullDescription || a.shortDescription)}</p>
    </div>

    ${a.features.length > 0 ? `
    <div class="detail-section">
      <h3>Features</h3>
      <div class="features">${a.features.map((f) => `<span class="tag">${esc(f)}</span>`).join("")}</div>
    </div>` : ""}

    ${a.pros.length > 0 || a.cons.length > 0 ? `
    <div class="detail-section">
      <h3>Pros & Cons</h3>
      <div class="pros-cons">
        <div><ul>${a.pros.map((p) => `<li class="pro">${esc(p)}</li>`).join("")}</ul></div>
        <div><ul>${a.cons.map((c) => `<li class="con">${esc(c)}</li>`).join("")}</ul></div>
      </div>
    </div>` : ""}

    ${a.appStoreUrl ? `<button class="store-btn" data-url="${esc(a.appStoreUrl)}">View on App Store</button>` : ""}
    ${a.playStoreUrl ? `<button class="store-btn" data-url="${esc(a.playStoreUrl)}" style="margin-left:8px">View on Play Store</button>` : ""}

    <div class="detail-section" style="margin-top:12px">
      <p style="font-size:11px;color:var(--color-text-tertiary,#999)">
        Category: ${esc(a.category)} &middot; Last updated: ${formatDate(a.lastUpdated)}
      </p>
    </div>
  `;

  // Store button handlers
  detailContent.querySelectorAll(".store-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = (btn as HTMLElement).dataset.url;
      if (url) app.openLink({ url });
    });
  });
}

// --- Render: Compare view ---
function renderCompareView(apps: AppData[]) {
  toolbarEl.style.display = "none";
  appCountEl.textContent = `Comparing ${apps.length} apps`;

  if (apps.length < 2) {
    resultsEl.innerHTML = '<div class="status"><p>Not enough apps to compare</p></div>';
    return;
  }

  const cols = apps.length + 1; // label col + app cols
  const gridCols = `minmax(80px,100px) repeat(${apps.length}, 1fr)`;

  // Find best values for highlighting
  const bestRating = Math.max(...apps.map((a) => a.rating));
  const lowestPrice = Math.min(...apps.map((a) => a.price));

  let html = `<div class="compare-grid" style="grid-template-columns:${gridCols}">`;

  // Header row: empty + app names with icons
  html += `<div class="compare-row header-row" style="display:grid;grid-template-columns:${gridCols}">`;
  html += `<div class="compare-cell label"></div>`;
  for (const a of apps) {
    html += `<div class="compare-cell"><div class="app-icon-sm">${iconHtml(a, 32)}</div><span style="font-size:12px">${esc(a.name)}</span></div>`;
  }
  html += `</div>`;

  // Rating row
  html += row(gridCols, "Rating", apps.map((a) =>
    `<span class="${a.rating === bestRating ? "best" : ""}">${starHtml(a.rating)} <span class="star-count">${a.rating.toFixed(1)}</span></span>`
  ));

  // Price row
  html += row(gridCols, "Price", apps.map((a) =>
    `<span class="${a.price === lowestPrice ? "best" : ""}">${priceBadge(a.price)}</span>`
  ));

  // Platform row
  html += row(gridCols, "Platform", apps.map((a) => platformPill(a.platform)));

  // Features row
  html += row(gridCols, "Features", apps.map((a) =>
    `<div class="compare-features">${a.features.slice(0, 4).map((f) => `<span class="mini-tag">${esc(f)}</span>`).join("")}</div>`
  ));

  // Pros row
  html += row(gridCols, "Pros", apps.map((a) =>
    a.pros.slice(0, 3).map((p) => `<span style="display:block;font-size:11px">+ ${esc(p)}</span>`).join("")
  ));

  // Cons row
  html += row(gridCols, "Cons", apps.map((a) =>
    a.cons.slice(0, 3).map((c) => `<span style="display:block;font-size:11px">- ${esc(c)}</span>`).join("")
  ));

  html += `</div>`;
  resultsEl.innerHTML = html;
}

function row(gridCols: string, label: string, cells: string[]): string {
  let html = `<div class="compare-row" style="display:grid;grid-template-columns:${gridCols}">`;
  html += `<div class="compare-cell label">${label}</div>`;
  for (const cell of cells) {
    html += `<div class="compare-cell">${cell}</div>`;
  }
  html += `</div>`;
  return html;
}

// --- Render: Alternatives view ---
function renderAlternativesView() {
  toolbarEl.style.display = "none";

  if (!sourceApp) {
    resultsEl.innerHTML = '<div class="status"><p>Source app not found</p></div>';
    return;
  }

  appCountEl.textContent = `${allApps.length} alternatives`;

  let html = "";

  // Source app card
  html += `
    <div class="source-card">
      <div class="icon" style="width:48px;height:48px;border-radius:12px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;background:var(--color-background-secondary,#f0f0f0)">${iconHtml(sourceApp, 48)}</div>
      <div style="flex:1">
        <div class="source-label">Looking for alternatives to</div>
        <div style="font-weight:600;font-size:14px">${esc(sourceApp.name)}</div>
        <div style="font-size:12px;color:var(--color-text-secondary,#666)">${esc(sourceApp.category)} &middot; ${starHtml(sourceApp.rating)} ${sourceApp.rating.toFixed(1)}</div>
      </div>
    </div>
  `;

  html += `<div class="alt-divider">Similar apps (${allApps.length})</div>`;

  // Alternative cards with shared features
  for (const alt of allApps) {
    const shared = alt.features.filter((f) =>
      sourceApp!.features.some(
        (sf) =>
          sf.toLowerCase().includes(f.toLowerCase().split(" ")[0]) ||
          f.toLowerCase().includes(sf.toLowerCase().split(" ")[0])
      )
    );

    html += `
    <div class="app-card" data-app-id="${esc(alt.id)}">
      <div class="icon">${iconHtml(alt, 48)}</div>
      <div class="info">
        <div class="name">${esc(alt.name)}</div>
        <div class="desc">${esc(alt.shortDescription)}</div>
        <div class="meta">
          ${starHtml(alt.rating)}
          <span class="star-count">(${formatCount(alt.reviewCount)})</span>
          ${priceBadge(alt.price)}
          ${platformPill(alt.platform)}
        </div>
        ${shared.length > 0 ? `<div style="margin-top:4px">${shared.slice(0, 3).map((f) => `<span class="shared-tag">${esc(f)}</span>`).join("")}</div>` : ""}
      </div>
    </div>`;
  }

  resultsEl.innerHTML = html;

  // Click handlers for alt cards
  resultsEl.querySelectorAll(".app-card[data-app-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = (card as HTMLElement).dataset.appId;
      const found = allApps.find((a) => a.id === id);
      if (found) showDetailView(found);
    });
  });
}

// --- Navigation ---
function showList() {
  listView.style.display = "block";
  detailView.classList.remove("active");
}

function doSearch() {
  if (currentViewType === "search" || currentViewType === "alternatives") {
    renderSearchView();
  }
}

// Event listeners
searchBtn.addEventListener("click", doSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
backBtn.addEventListener("click", showList);

// --- Helpers ---

function esc(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconHtml(a: AppData, size: number): string {
  if (a.iconUrl) {
    return `<img src="${esc(a.iconUrl)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${Math.round(size * 0.22)}px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span style="display:none;width:${size}px;height:${size}px;align-items:center;justify-content:center;font-size:${Math.round(size * 0.45)}px">${getEmoji(a.category)}</span>`;
  }
  return getEmoji(a.category);
}

function getEmoji(category: string): string {
  const map: Record<string, string> = {
    photography: "\u{1F4F7}",
    photo: "\u{1F4F7}",
    productivity: "\u2705",
    task: "\u2705",
    travel: "\u2708\uFE0F",
    map: "\u{1F5FA}\uFE0F",
    developer: "\u{1F4BB}",
    dev: "\u{1F4BB}",
    writing: "\u270D\uFE0F",
    note: "\u{1F4DD}",
  };
  const lower = (category || "").toLowerCase();
  for (const [key, emoji] of Object.entries(map)) {
    if (lower.includes(key)) return emoji;
  }
  return "\u{1F4F1}";
}

function starHtml(rating: number): string {
  const stars: string[] = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(`<svg class="star-filled" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`);
    } else if (rating >= i - 0.5) {
      stars.push(`<svg class="star-half" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`);
    } else {
      stars.push(`<svg class="star-empty" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`);
    }
  }
  return `<span class="stars">${stars.join("")}</span>`;
}

function priceBadge(price: number): string {
  if (price === 0) {
    return `<span class="price-badge free">FREE</span>`;
  }
  return `<span class="price-badge paid">$${price.toFixed(2)}</span>`;
}

function platformPill(platform: string): string {
  const label = platform === "both" ? "iOS & Android" : platform === "ios" ? "iOS" : "Android";
  return `<span class="platform-pill">${label}</span>`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
