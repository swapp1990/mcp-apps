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
