# Loan Calculator MCP App + ChatGPT Simulator

## 1. Problem Statement

People already ask ChatGPT questions like "What's the monthly payment on a $400k mortgage at 6.5%?" and get back plain text numbers. A visual, interactive loan calculator embedded directly in the chat thread would let users adjust parameters (rate, term, down payment) and instantly see updated charts and comparisons — no copy-pasting into spreadsheets. Additionally, there's no way to showcase MCP apps outside ChatGPT/Claude. A ChatGPT-clone simulator on our own website would let anyone experience MCP apps without needing a ChatGPT account, and serve as a portfolio demo.

## 2. Solution Overview

Build two things: (1) A **Loan Calculator** MCP app in the mcp-apps monorepo following the same pattern as Regex Playground — tools that compute loan math, a View that renders interactive charts and sliders, deployed alongside existing apps on the same server. (2) A **ChatGPT Simulator** — a standalone web page hosted on our website that mimics ChatGPT's chat interface, connects to our MCP server over HTTP, embeds MCP app Views in iframes using the official ext-apps AppBridge SDK, and demonstrates the full tool-call-to-interactive-view flow. The simulator is NOT an AI chatbot — it's a scripted demo that shows pre-defined prompts triggering real MCP tool calls with real interactive Views.

## 3. Comparison: Loan Calculator vs Other Finance Tools

| Aspect | Loan Calculator | Savings Calculator | Investment Tracker |
|--------|----------------|-------------------|--------------------|
| Audience breadth | Very wide (homebuyers, car buyers, students) | Moderate (savers) | Narrow (investors) |
| Visual payoff | High (amortization chart, payment breakdown) | Medium (growth curve) | High but needs live data |
| Complexity | Low (pure math, no APIs) | Low | High (market data APIs) |
| Self-contained | Yes | Yes | No (needs external data) |
| "Wow" factor in demo | High — sliders updating charts in real-time | Medium | Medium |

## 4. User Flow

### Loan Calculator (in ChatGPT or Simulator)

1. User types: "What's the monthly payment on a $350,000 home loan at 6.5% for 30 years?"
2. AI calls `calculate_loan` tool with principal, rate, term
3. View renders: monthly payment hero number, payment breakdown pie chart (principal vs interest vs taxes), amortization schedule chart
4. User adjusts sliders in the View: changes rate from 6.5% to 5.9%, term from 30yr to 15yr
5. View recalculates client-side and updates all visualizations instantly
6. User clicks "Compare Scenarios" — View shows side-by-side comparison of original vs adjusted terms
7. User types: "What if I put 20% down?" — AI calls tool again with new parameters, View updates

### Loan Calculator — Additional Tools

8. User asks "Show me an amortization table for this loan" — AI calls `amortization_schedule` tool
9. View renders month-by-month table: payment number, principal portion, interest portion, remaining balance
10. User can toggle between chart view and table view

11. User asks "Compare a 15-year vs 30-year mortgage on $400k" — AI calls `compare_loans` tool
12. View renders side-by-side: two loan summaries with total interest paid, monthly payment, total cost highlighted

### ChatGPT Simulator

1. User visits the simulator page on our website
2. Page shows a ChatGPT-like chat interface with a greeting message and suggested prompts
3. User clicks a suggested prompt (e.g., "Calculate my mortgage payment") or types their own
4. Simulator shows a "thinking" animation, then displays the AI's text response
5. Below the text response, the MCP app View loads in an iframe — showing the interactive loan calculator
6. User interacts with the View (sliders, tabs, comparisons) — all working live
7. Sidebar shows available apps: Loan Calculator, Regex Playground, App Discovery
8. User can switch apps or try different prompts

## 5. Scope

### P0 — Must Have

**Loan Calculator App**
- `calculate_loan` tool: accepts principal, annual rate, term (years), down payment (optional), property tax rate (optional), insurance (optional)
- `compare_loans` tool: accepts 2-3 loan scenarios, returns side-by-side comparison
- `amortization_schedule` tool: returns month-by-month breakdown for a single loan
- View: monthly payment display, principal-vs-interest pie chart, amortization line chart
- View: interactive sliders for rate, term, down payment — client-side recalculation
- View: compare mode showing 2-3 scenarios side by side
- View: responsive layout, light/dark theme support via host CSS variables
- Follows McpAppModule interface (registerTools, registerStdioTools, resourceUri)
- Deployed alongside regex and appdiscovery apps on the same server

**ChatGPT Simulator**
- Single-page web app with ChatGPT-like chat UI (message bubbles, input bar, sidebar)
- Connects to our MCP server via HTTP
- Uses official AppBridge + PostMessageTransport from ext-apps SDK to embed Views
- Pre-scripted prompts that trigger real MCP tool calls (not mocked)
- Shows the interactive View iframe below the text response, exactly like ChatGPT
- Handles View resize events (auto-height iframe)
- Passes theme context (light/dark toggle)
- Works with all three apps: Loan Calculator, Regex Playground, App Discovery
- Hosted on our website as a static page

### P1 — Should Have

- Simulator: typing animation for the "AI response" text
- Simulator: suggested prompt chips that change per-app
- Loan Calculator: extra-payment scenario (what if I pay $200/month extra?)
- Loan Calculator: affordability calculator mode ("I can pay $2000/month, what can I afford?")
- Simulator: mobile-responsive layout

### v2+ — Out of Scope

- Actual AI/LLM integration in the simulator (it's scripted, not a real chatbot)
- User accounts or saved calculations
- Real-time rate data from external APIs
- PDF export of loan reports
- Simulator as a reusable embeddable widget for other sites
- Double-iframe sandbox security model (overkill for a demo site we control)

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Charting library adds significant bundle size to View HTML | Medium — View must be a single HTML file | Use lightweight canvas-based charting (Chart.js is ~70KB gzipped) or SVG-only charts with no library |
| AppBridge SDK version mismatch between simulator host and MCP server | High — broken handshake | Pin same ext-apps version in both simulator and server |
| Client-side loan recalculation produces different results than server tool | Low — confusing UX | Use identical formulas; server is source of truth, client is for preview only |
| ChatGPT-like UI could confuse users into thinking it's real ChatGPT | Medium — brand confusion | Clear branding: "MCP Apps Demo" title, no OpenAI logos, disclaimer banner |
| CORS issues when simulator (our website) calls MCP server (different origin) | High — blocks entire demo | Server already has CORS headers; verify simulator origin is allowed |

## 7. Success Criteria Checklist

### Loan Calculator — Core Tools
- [ ] `calculate_loan` returns correct monthly payment matching standard amortization formula
- [ ] `calculate_loan` handles optional down payment, property tax, insurance
- [ ] `compare_loans` accepts 2-3 scenarios and returns structured comparison data
- [ ] `amortization_schedule` returns correct month-by-month breakdown for full loan term
- [ ] All tools return dual-format: plain text for AI + JSON envelope for View
- [ ] All tools work in both HTTP mode (with View) and stdio mode (without View)

### Loan Calculator — View
- [ ] Monthly payment displays prominently as hero number with currency formatting
- [ ] Pie chart shows principal vs interest (vs taxes/insurance if provided)
- [ ] Amortization chart shows principal and interest portions over time
- [ ] Sliders for rate, term, down payment update all visualizations client-side without server round-trip
- [ ] Compare mode shows 2-3 scenarios side by side with best-value highlighting
- [ ] Amortization table mode shows scrollable month-by-month breakdown
- [ ] View adapts to light/dark theme from host CSS variables
- [ ] View reports correct size to host via autoResize / size-changed notification
- [ ] View renders correctly in ChatGPT, Claude, and the Simulator

### ChatGPT Simulator — Host
- [ ] Chat UI renders with message bubbles (user on right, assistant on left)
- [ ] Input bar at bottom accepts text and sends on Enter
- [ ] Sidebar shows available MCP apps with icons
- [ ] Clicking a suggested prompt triggers a real MCP tool call to our server
- [ ] Tool response text appears as an assistant message bubble
- [ ] View iframe appears below the text response and renders correctly
- [ ] AppBridge handshake completes (initialized event fires)
- [ ] Tool input and tool result are sent to View via AppBridge
- [ ] View iframe auto-resizes based on content
- [ ] Light/dark toggle updates both chat UI and View theme via setHostContext
- [ ] Works with Loan Calculator, Regex Playground, and App Discovery apps
- [ ] No CORS errors when calling MCP server

### Integration
- [ ] Loan Calculator app follows McpAppModule interface and registers in server alongside existing apps
- [ ] Simulator page loads in under 3 seconds on broadband
- [ ] Simulator works in Chrome, Safari, Firefox latest versions

## 8. End-to-End Test List

- **E2E-1**: Simulator loads → click "Calculate mortgage" prompt → text response appears → loan calculator View renders with correct payment → adjust rate slider → payment updates
- **E2E-2**: Simulator → switch to Regex Playground via sidebar → click regex prompt → regex View renders with match highlighting
- **E2E-3**: Simulator → switch to App Discovery → click search prompt → app cards render with ratings and icons
- **E2E-4**: Simulator → toggle dark mode → both chat UI and embedded View switch to dark theme
- **E2E-5**: Loan Calculator in real ChatGPT → ask "monthly payment on $300k at 7%" → View renders, sliders work, compare mode works
- **E2E-6**: Loan Calculator in Claude Desktop → same query → text-only response is readable and correct (no View in stdio mode)
- **E2E-7**: `compare_loans` → provide 15yr and 30yr scenarios → compare View renders with total interest highlighted
- **E2E-8**: `amortization_schedule` → 30-year loan → table renders all 360 rows, scrollable

## 9. Manual Testing Checklist

### Smoke Test (2 min)
- [ ] Visit simulator URL — page loads with chat UI
- [ ] Click any suggested prompt — response and View appear
- [ ] Interact with View (click/slide something) — it responds

### Feature Test (5 min)
- [ ] Calculate a loan with all optional fields (tax, insurance, down payment)
- [ ] Adjust each slider independently — values and charts update
- [ ] Compare 2 scenarios — side-by-side renders with highlighting
- [ ] Switch between chart and table view in amortization
- [ ] Toggle light/dark mode — everything adapts
- [ ] Try all 3 apps in the simulator (loan, regex, appdiscovery)
- [ ] Type a custom prompt in simulator input

### Regression (2 min)
- [ ] Regex Playground still works in ChatGPT after adding loan calculator
- [ ] App Discovery still works in ChatGPT after adding loan calculator
- [ ] stdio mode (Claude Code) still works for all tools
