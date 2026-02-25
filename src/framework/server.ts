// Shared HTTP server framework for MCP apps
// Each app gets its own MCP endpoint at /<app.name>/mcp
// Shared: CORS, health check, landing page, stateless transport

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { createServer } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import type { McpAppModule } from "./types.js";

export interface ServerConfig {
  name: string;
  version: string;
  port: number;
  apps: McpAppModule[];
  /** Path to the dist/ directory containing bundled View HTML files */
  distDir: string;
  /** Map of app name → bundled HTML filename in dist/ */
  viewFiles: Record<string, string>;
  /** Base URL for display purposes (e.g. "https://appdiscovery.swapp1990.org") */
  baseUrl?: string;
}

/** Load all View HTML files from dist/ */
function loadViewHtml(config: ServerConfig): Record<string, string> {
  const views: Record<string, string> = {};
  for (const [appName, filename] of Object.entries(config.viewFiles)) {
    views[appName] = readFileSync(join(config.distDir, filename), "utf-8");
  }
  return views;
}

/** Create a fresh McpServer for a single app */
function createAppMcpServer(
  app: McpAppModule,
  viewHtml: string | undefined
): McpServer {
  const server = new McpServer({
    name: app.name,
    version: "0.1.0",
  });

  // Register tools
  app.registerTools(server, app.resourceUri);

  // Register View resource
  if (viewHtml) {
    const csp = app.cspResourceDomains
      ? { ui: { csp: { resourceDomains: app.cspResourceDomains } } }
      : undefined;

    registerAppResource(
      server,
      `${app.title} View`,
      app.resourceUri,
      {
        description: app.resourceDescription,
        mimeType: RESOURCE_MIME_TYPE,
      },
      async () => ({
        contents: [{
          uri: app.resourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: viewHtml,
          ...(csp ? { _meta: csp } : {}),
        }],
      })
    );
  }

  return server;
}

/** Handle an MCP request for a specific app */
async function handleMcpRequest(
  app: McpAppModule,
  viewHtml: string | undefined,
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse
): Promise<void> {
  const ua = req.headers["user-agent"] || "unknown";
  console.error(`[${app.name}] ${req.method} from ${ua}`);

  const mcpServer = createAppMcpServer(app, viewHtml);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error(`[${app.name}] MCP request error:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  res.on("close", () => {
    transport.close().catch(() => {});
    mcpServer.close().catch(() => {});
  });
}

// --- Static page templates ---

const PAGE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 17px; margin-top: 28px; }
  p, li { font-size: 14px; }
  a { color: #3b82f6; }
  .updated { color: #666; font-size: 13px; margin-bottom: 24px; }
`;

function pageShell(title: string, body: string, baseUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — MCP Apps</title><style>${PAGE_STYLE}</style></head><body>
${body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb">
<p style="font-size:12px;color:#999"><a href="${baseUrl}">MCP Apps</a> · <a href="${baseUrl}/privacy">Privacy</a> · <a href="${baseUrl}/terms">Terms</a> · <a href="${baseUrl}/support">Support</a></p>
</body></html>`;
}

const staticPages = {
  "/privacy": (baseUrl: string) => pageShell("Privacy Policy", `
<h1>Privacy Policy</h1>
<p class="updated">Last updated: February 23, 2026</p>

<p>MCP Apps ("we", "us") provides MCP server applications including Regex Playground and AppDiscovery. This policy describes how we handle your data.</p>

<h2>Data We Process</h2>
<p>When you use our tools through ChatGPT or Claude, your input (regex patterns, test strings, search queries) is sent to our server, processed, and returned in the response. <strong>We do not store, log, or retain your input data.</strong> Each request is stateless — processed in memory and discarded immediately.</p>

<h2>Data We Do Not Collect</h2>
<ul>
  <li>No user accounts or authentication</li>
  <li>No cookies, tracking pixels, or analytics</li>
  <li>No personal information (names, emails, locations)</li>
  <li>No conversation history or chat content</li>
  <li>No device fingerprinting</li>
</ul>

<h2>Server Logs</h2>
<p>Our server logs HTTP request metadata (timestamp, user-agent, request path) for operational monitoring. Logs do not contain request bodies or your input data. Logs are retained for up to 30 days and are not shared with third parties.</p>

<h2>Third-Party Services</h2>
<p>Regex Playground performs all computation on our server with no external API calls. AppDiscovery queries the Apple App Store API to retrieve publicly available app metadata.</p>

<h2>Data Sharing</h2>
<p>We do not sell, share, or transfer your data to third parties, except as required by law.</p>

<h2>Children's Privacy</h2>
<p>Our services are not directed at children under 13. We do not knowingly collect data from children.</p>

<h2>Changes</h2>
<p>We may update this policy. Changes will be posted at this URL with an updated date.</p>

<h2>Contact</h2>
<p>Questions? Reach us at <a href="${baseUrl}/support">support</a> or email <a href="mailto:privacy@swapp1990.org">privacy@swapp1990.org</a>.</p>
`, baseUrl),

  "/terms": (baseUrl: string) => pageShell("Terms of Service", `
<h1>Terms of Service</h1>
<p class="updated">Last updated: February 23, 2026</p>

<p>By using MCP Apps ("Service"), you agree to these terms.</p>

<h2>Service Description</h2>
<p>MCP Apps provides developer tools (Regex Playground, AppDiscovery) accessible through MCP-compatible AI assistants like ChatGPT and Claude. The tools process your input and return results.</p>

<h2>Acceptable Use</h2>
<p>You may use the Service for any lawful purpose. You agree not to:</p>
<ul>
  <li>Send excessive automated requests that degrade service for others</li>
  <li>Attempt to access systems or data beyond the provided MCP endpoints</li>
  <li>Use the Service to process data you are not authorized to handle</li>
</ul>

<h2>No Warranty</h2>
<p>The Service is provided "as is" without warranties of any kind. Regex results, pattern explanations, and app discovery data are provided for informational purposes and may contain errors.</p>

<h2>Limitation of Liability</h2>
<p>To the maximum extent permitted by law, we are not liable for any damages arising from your use of the Service, including but not limited to incorrect regex results or app data.</p>

<h2>Availability</h2>
<p>We aim to keep the Service available but do not guarantee uptime. We may modify, suspend, or discontinue the Service at any time.</p>

<h2>Changes</h2>
<p>We may update these terms. Continued use after changes constitutes acceptance.</p>

<h2>Contact</h2>
<p>Questions? Reach us at <a href="${baseUrl}/support">support</a>.</p>
`, baseUrl),

  "/support": (baseUrl: string) => pageShell("Support", `
<h1>Support</h1>

<h2>Get Help</h2>
<p>If you're experiencing issues with Regex Playground, AppDiscovery, or any MCP Apps tool:</p>
<ul>
  <li><strong>Report a bug or request a feature:</strong> <a href="https://github.com/swapp1990/mcp-apps/issues">GitHub Issues</a></li>
  <li><strong>Email:</strong> <a href="mailto:support@swapp1990.org">support@swapp1990.org</a></li>
</ul>

<h2>Common Issues</h2>
<ul>
  <li><strong>View not updating after app update?</strong> ChatGPT aggressively caches the UI. Remove the app and re-add it to pick up changes.</li>
  <li><strong>Dark mode not working?</strong> The app reads your ChatGPT theme setting. Make sure you're using the latest version.</li>
</ul>

<h2>Source Code</h2>
<p>MCP Apps is open source: <a href="https://github.com/swapp1990/mcp-apps">github.com/swapp1990/mcp-apps</a></p>
`, baseUrl),
};

/** Start the HTTP server */
export async function startHttpServer(config: ServerConfig): Promise<void> {
  const views = loadViewHtml(config);
  const baseUrl = config.baseUrl || `http://localhost:${config.port}`;

  // Build a lookup: path prefix → app
  const appByPath = new Map<string, McpAppModule>();
  for (const app of config.apps) {
    appByPath.set(`/${app.name}`, app);
  }

  const appNames = config.apps.map((a) => `${a.title} (/${a.name}/mcp)`).join(", ");
  console.error(`MCP Apps HTTP Server — serving: ${appNames}`);

  const httpServer = createServer(async (req, res) => {
    const url = req.url || "/";

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Accept");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        apps: config.apps.map((a) => ({
          name: a.name,
          title: a.title,
          endpoint: `${baseUrl}/${a.name}/mcp`,
        })),
      }));
      return;
    }

    // Root landing page
    if (url === "/" && req.method === "GET") {
      const appList = config.apps.map((a) =>
        `<li><strong>${a.title}</strong> — <code>${baseUrl}/${a.name}/mcp</code><br><em>${a.resourceDescription}</em></li>`
      ).join("\n");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>MCP Apps</title></head><body>
<h1>MCP Apps Server</h1>
<p>This server hosts ${config.apps.length} MCP apps. Connect to each app separately:</p>
<ul>${appList}</ul>
<p><a href="/health">Health check</a></p>
</body></html>`);
      return;
    }

    // Static pages: privacy, terms, support
    if (req.method === "GET" && (url === "/privacy" || url === "/terms" || url === "/support")) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(staticPages[url as "/privacy" | "/terms" | "/support"](baseUrl));
      return;
    }

    // Simulator page
    if (url === "/simulator" && req.method === "GET") {
      const simulatorHtml = views["simulator"];
      if (simulatorHtml) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(simulatorHtml);
      } else {
        res.writeHead(404);
        res.end("Simulator not built");
      }
      return;
    }

    // REST API: POST /api/<app>/tool — call a tool directly
    const apiMatch = url.match(/^\/api\/([^/]+)\/tool$/);
    if (apiMatch && req.method === "POST") {
      const appName = apiMatch[1];
      const app = config.apps.find((a) => a.name === appName);
      if (!app || !app.callTool) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `App not found: ${appName}` }));
        return;
      }

      let body = "";
      req.setEncoding("utf-8");
      for await (const chunk of req) body += chunk;

      try {
        const { tool, arguments: args } = JSON.parse(body);
        const result = await app.callTool(tool, args || {});
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    // REST API: GET /api/<app>/view — get View HTML
    const viewMatch = url.match(/^\/api\/([^/]+)\/view$/);
    if (viewMatch && req.method === "GET") {
      const appName = viewMatch[1];
      const viewHtml = views[appName];
      if (viewHtml) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(viewHtml);
      } else {
        res.writeHead(404);
        res.end("View not found");
      }
      return;
    }

    // Per-app MCP endpoints: /<appname>/mcp or /<appname>
    for (const [prefix, app] of appByPath) {
      const mcpPath = `${prefix}/mcp`;

      if (url === mcpPath || url === prefix) {
        // Browser GET → app-specific landing page
        if (req.method === "GET") {
          const accept = req.headers.accept || "";
          if (!accept.includes("text/event-stream")) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`<!DOCTYPE html><html><head><title>${app.title} MCP</title></head><body>
<h1>${app.title} MCP Server</h1>
<p>${app.resourceDescription}</p>
<p>This is an MCP endpoint. Connect via:</p>
<pre>URL: ${baseUrl}${mcpPath}</pre>
<p><a href="/">All apps</a> | <a href="/health">Health check</a></p>
</body></html>`);
            return;
          }
        }

        // MCP request
        await handleMcpRequest(app, views[app.name], req, res);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(config.port, () => {
    console.error(`MCP Apps HTTP Server running on http://localhost:${config.port}`);
    for (const app of config.apps) {
      console.error(`  ${app.title}: http://localhost:${config.port}/${app.name}/mcp`);
    }
    console.error(`Health check: http://localhost:${config.port}/health`);
  });
}
