// ChatGPT Simulator — MCP Apps Demo
// Scripted prompts that trigger real MCP tool calls with interactive Views

import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

interface HostContext {
  theme?: "light" | "dark";
}

// --- Configuration ---

const API_BASE = window.location.origin;

interface AppConfig {
  name: string;
  title: string;
  icon: string;
  description: string;
  prompts: PromptConfig[];
}

interface PromptConfig {
  label: string;
  text: string;
  tool: string;
  args: Record<string, unknown>;
  response: string;
}

const APPS: AppConfig[] = [
  {
    name: "loan",
    title: "Loan Calculator",
    icon: "\u{1f3e0}",
    description: "Calculate mortgage payments, compare loans, amortization",
    prompts: [
      {
        label: "Calculate my mortgage",
        text: "What's the monthly payment on a $350,000 home loan at 6.5% for 30 years?",
        tool: "calculate_loan",
        args: { principal: 350000, annual_rate: 6.5, term_years: 30 },
        response: "Here's your loan calculation for a $350,000 home at 6.5% over 30 years. You can adjust the rate, term, and down payment using the sliders below:",
      },
      {
        label: "Compare 15yr vs 30yr",
        text: "Compare a 15-year vs 30-year mortgage on $400,000 at 6.5%",
        tool: "compare_loans",
        args: {
          scenarios: [
            { principal: 400000, annual_rate: 6.5, term_years: 15 },
            { principal: 400000, annual_rate: 6.5, term_years: 30 },
          ],
        },
        response: "Here's a side-by-side comparison of 15-year vs 30-year terms. The shorter term has higher monthly payments but saves significantly on total interest:",
      },
      {
        label: "Show amortization table",
        text: "Show me the amortization schedule for a $300,000 loan at 7% for 30 years",
        tool: "amortization_schedule",
        args: { principal: 300000, annual_rate: 7, term_years: 30 },
        response: "Here's the full amortization schedule. Click on any year to expand the monthly details. You can switch between chart and table view:",
      },
      {
        label: "Loan with down payment",
        text: "Calculate payment on $500,000 home with 20% down, 5.9% rate, 30yr, 1.2% tax, $1800 insurance",
        tool: "calculate_loan",
        args: { principal: 500000, annual_rate: 5.9, term_years: 30, down_payment: 100000, property_tax_rate: 1.2, annual_insurance: 1800 },
        response: "Here's the complete breakdown including property tax and insurance. The pie chart shows how your monthly payment is split:",
      },
    ],
  },
  {
    name: "regex",
    title: "Regex Playground",
    icon: ".*",
    description: "Test, explain, and validate regular expressions",
    prompts: [
      {
        label: "Test an email regex",
        text: "Test the regex pattern [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,} against 'user@example.com and invalid@.com'",
        tool: "test_regex",
        args: {
          pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
          test_string: "user@example.com and invalid@.com",
          flags: "g",
        },
        response: "Here are the matches for the email regex pattern. The highlighted text shows where matches were found:",
      },
      {
        label: "Explain a regex",
        text: "Explain the regex pattern: ^\\d{3}-\\d{2}-\\d{4}$",
        tool: "explain_regex",
        args: { pattern: "^\\d{3}-\\d{2}-\\d{4}$" },
        response: "Here's a breakdown of each component in the regex pattern:",
      },
      {
        label: "Browse common patterns",
        text: "Show me common regex patterns for validation",
        tool: "common_patterns",
        args: { category: "Validation" },
        response: "Here are commonly used regex patterns for validation. Click 'Try' on any pattern to test it:",
      },
    ],
  },
  {
    name: "appdiscovery",
    title: "App Discovery",
    icon: "\u{1f50d}",
    description: "Search and compare mobile apps",
    prompts: [
      {
        label: "Search photo editors",
        text: "Search for photography apps",
        tool: "search_apps",
        args: { category: "Photography" },
        response: "Here are the top photography apps. Click on any app card to see more details:",
      },
      {
        label: "Compare travel apps",
        text: "Compare Google Maps and Waze",
        tool: "compare_apps",
        args: { apps: ["Google Maps", "Waze"] },
        response: "Here's a side-by-side comparison of Google Maps and Waze:",
      },
    ],
  },
];

// --- State ---
let currentApp: AppConfig = APPS[0];
let currentTheme: "light" | "dark" = "light";
let isProcessing = false;
let activeBridges: Array<{ bridge: AppBridge; iframe: HTMLIFrameElement }> = [];

// --- DOM refs ---
const chatMessages = document.getElementById("chat-messages")!;
const chatInput = document.getElementById("chat-input") as HTMLInputElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const sidebarApps = document.getElementById("sidebar-apps")!;
const chatTitle = document.getElementById("chat-title")!;
const themeToggle = document.getElementById("theme-toggle")!;

// --- Theme ---
function getHostContext(): HostContext {
  return {
    theme: currentTheme,
  };
}

function setTheme(theme: "light" | "dark") {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "light" ? "Dark" : "Light";

  // Update all active bridges
  for (const { bridge } of activeBridges) {
    try {
      bridge.setHostContext(getHostContext());
    } catch { /* bridge may be closed */ }
  }
}

themeToggle.addEventListener("click", () => {
  setTheme(currentTheme === "light" ? "dark" : "light");
});

// Detect OS preference
if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
  setTheme("dark");
}

// --- Sidebar ---
function renderSidebar() {
  sidebarApps.innerHTML = "";
  for (const app of APPS) {
    const el = document.createElement("div");
    el.className = `app-item ${app.name === currentApp.name ? "active" : ""}`;
    el.innerHTML = `
      <div style="display:flex;align-items:center">
        <span class="app-item-icon">${app.icon}</span>
        <div>
          <div class="app-item-name">${app.title}</div>
          <div class="app-item-desc">${app.description}</div>
        </div>
      </div>
    `;
    el.addEventListener("click", () => switchApp(app));
    sidebarApps.appendChild(el);
  }
}

function switchApp(app: AppConfig) {
  currentApp = app;
  chatTitle.textContent = app.title;
  renderSidebar();
  clearChat();
  showWelcome();
}

// --- Chat ---
function clearChat() {
  chatMessages.innerHTML = "";
  // Clean up bridges
  for (const { bridge } of activeBridges) {
    try { bridge.close(); } catch { /* ignore */ }
  }
  activeBridges = [];
}

function addMessage(role: "user" | "assistant", text: string): HTMLElement {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.innerHTML = `
    <div class="message-avatar">${role === "user" ? "S" : "A"}</div>
    <div class="message-content">
      <div class="message-text"></div>
    </div>
  `;
  const textEl = msg.querySelector(".message-text")!;
  textEl.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function addThinking(): HTMLElement {
  const msg = document.createElement("div");
  msg.className = "message assistant";
  msg.innerHTML = `
    <div class="message-avatar">A</div>
    <div class="message-content">
      <div class="thinking">
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
      </div>
    </div>
  `;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

async function typeText(element: HTMLElement, text: string, speed = 15) {
  const textEl = element.querySelector(".message-text")!;
  textEl.textContent = "";
  for (let i = 0; i < text.length; i++) {
    textEl.textContent += text[i];
    if (i % 3 === 0) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
      await sleep(speed);
    }
  }
}

function addViewFrame(parentMsg: HTMLElement): HTMLIFrameElement {
  const frame = document.createElement("div");
  frame.className = "view-frame";
  const iframe = document.createElement("iframe");
  iframe.style.height = "400px";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.appendChild(iframe);
  parentMsg.querySelector(".message-content")!.appendChild(frame);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return iframe;
}

function showWelcome() {
  const msg = document.createElement("div");
  msg.className = "message assistant";
  msg.innerHTML = `
    <div class="message-avatar">A</div>
    <div class="message-content">
      <div class="message-text">Hi! I'm the ${currentApp.title} assistant. Try one of these prompts or type your own:</div>
      <div class="suggested-prompts" id="suggested-prompts"></div>
    </div>
  `;
  chatMessages.appendChild(msg);

  const promptsEl = msg.querySelector("#suggested-prompts")!;
  for (const prompt of currentApp.prompts) {
    const chip = document.createElement("button");
    chip.className = "prompt-chip";
    chip.textContent = prompt.label;
    chip.addEventListener("click", () => handlePrompt(prompt));
    promptsEl.appendChild(chip);
  }
}

// --- Tool calling ---
async function callTool(appName: string, tool: string, args: Record<string, unknown>): Promise<{ text: string; json: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/api/${appName}/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, arguments: args }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Tool call failed");
  }
  return res.json();
}

async function fetchViewHtml(appName: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/${appName}/view`);
  if (!res.ok) throw new Error("Failed to load view");
  return res.text();
}

// --- View bridge ---
async function setupViewBridge(
  iframe: HTMLIFrameElement,
  viewHtml: string,
  toolResult: { text: string; json: Record<string, unknown> }
) {
  // Write HTML into iframe via srcdoc
  iframe.srcdoc = viewHtml;

  // Wait for iframe to load
  await new Promise<void>((resolve) => {
    iframe.addEventListener("load", () => resolve(), { once: true });
  });

  const cw = iframe.contentWindow;
  if (!cw) return;

  // Create AppBridge (no MCP client — we handle tool calls manually)
  const bridge = new AppBridge(
    null,
    { name: "MCPSimulator", version: "1.0.0" },
    { openLinks: {}, logging: {} },
    { hostContext: getHostContext() }
  );

  // Handle size changes
  bridge.onsizechange = ({ height }) => {
    if (height != null) {
      iframe.style.height = `${Math.min(height + 4, 800)}px`;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  };

  // Handle open link requests
  bridge.onopenlink = async ({ url }) => {
    window.open(url, "_blank", "noopener,noreferrer");
    return {};
  };

  // When view is initialized, send the tool result
  bridge.oninitialized = () => {
    bridge.setHostContext(getHostContext());

    // Send tool result with content matching the server format
    bridge.sendToolResult({
      content: [
        { type: "text", text: toolResult.text },
        { type: "text", text: JSON.stringify(toolResult.json) },
      ],
    });
  };

  // Connect bridge to iframe via PostMessageTransport
  const transport = new PostMessageTransport(cw, cw);
  await bridge.connect(transport);

  activeBridges.push({ bridge, iframe });
}

// --- Prompt handling ---
async function handlePrompt(prompt: PromptConfig) {
  if (isProcessing) return;
  isProcessing = true;
  sendBtn.disabled = true;

  // Show user message
  addMessage("user", prompt.text);

  // Show thinking
  const thinkingEl = addThinking();

  try {
    // Call tool on server
    const [toolResult, viewHtml] = await Promise.all([
      callTool(currentApp.name, prompt.tool, prompt.args),
      fetchViewHtml(currentApp.name),
    ]);

    // Remove thinking, show response
    thinkingEl.remove();
    const assistantMsg = addMessage("assistant", "");
    await typeText(assistantMsg, prompt.response);

    // Add View iframe
    const iframe = addViewFrame(assistantMsg);
    await setupViewBridge(iframe, viewHtml, toolResult);
  } catch (err) {
    thinkingEl.remove();
    const errMsg = err instanceof Error ? err.message : "Something went wrong";
    addMessage("assistant", `Sorry, there was an error: ${errMsg}`);
  }

  isProcessing = false;
  sendBtn.disabled = false;
}

// --- Input handling ---
chatInput.addEventListener("input", () => {
  sendBtn.disabled = !chatInput.value.trim() || isProcessing;
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && chatInput.value.trim()) {
    e.preventDefault();
    handleCustomInput();
  }
});

sendBtn.addEventListener("click", handleCustomInput);

async function handleCustomInput() {
  const text = chatInput.value.trim();
  if (!text || isProcessing) return;

  chatInput.value = "";
  sendBtn.disabled = true;

  // Find closest matching prompt
  const prompt = findBestPrompt(text);
  if (prompt) {
    await handlePrompt({ ...prompt, text });
  } else {
    // No matching prompt — show a friendly message
    addMessage("user", text);
    addMessage("assistant", `This is a demo with pre-configured scenarios. Try clicking one of the suggested prompts, or switch apps using the sidebar. In a real integration, this would call the AI to determine which tool to use.`);
    isProcessing = false;
    sendBtn.disabled = false;
  }
}

function findBestPrompt(input: string): PromptConfig | null {
  const lower = input.toLowerCase();
  // Simple keyword matching
  for (const prompt of currentApp.prompts) {
    const keywords = prompt.label.toLowerCase().split(/\s+/);
    const matchCount = keywords.filter((k) => lower.includes(k)).length;
    if (matchCount >= 2 || lower.includes(prompt.tool.replace(/_/g, " "))) {
      return prompt;
    }
  }
  // Fall back to first prompt for any loan/mortgage/calculate keywords
  if (currentApp.name === "loan" && /loan|mortgage|payment|calcul|month/i.test(lower)) {
    return currentApp.prompts[0];
  }
  if (currentApp.name === "regex" && /regex|pattern|match|test/i.test(lower)) {
    return currentApp.prompts[0];
  }
  if (currentApp.name === "appdiscovery" && /app|search|find|discover/i.test(lower)) {
    return currentApp.prompts[0];
  }
  return null;
}

// --- Helpers ---
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Init ---
renderSidebar();
showWelcome();
