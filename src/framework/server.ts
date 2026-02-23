// Shared HTTP server framework for MCP apps
// Handles: server creation, CORS, health check, landing page, stateless transport

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { createServer } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { McpAppModule } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  name: string;
  version: string;
  port: number;
  apps: McpAppModule[];
  /** Path to the dist/ directory containing bundled View HTML files */
  distDir: string;
  /** Map of app name → bundled HTML filename in dist/ */
  viewFiles: Record<string, string>;
}

/** Load all View HTML files from dist/ */
function loadViewHtml(config: ServerConfig): Record<string, string> {
  const views: Record<string, string> = {};
  for (const [appName, filename] of Object.entries(config.viewFiles)) {
    views[appName] = readFileSync(join(config.distDir, filename), "utf-8");
  }
  return views;
}

/** Create a fresh McpServer with all apps' tools + resources registered */
function createMcpServer(config: ServerConfig, views: Record<string, string>): McpServer {
  const server = new McpServer({
    name: config.name,
    version: config.version,
  });

  for (const app of config.apps) {
    // Register tools
    app.registerTools(server, app.resourceUri);

    // Register View resource
    const viewHtml = views[app.name];
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
  }

  return server;
}

/** Start the HTTP server */
export async function startHttpServer(config: ServerConfig): Promise<void> {
  const views = loadViewHtml(config);
  const appNames = config.apps.map((a) => a.title).join(", ");

  console.error(`MCP Apps HTTP Server — serving: ${appNames}`);

  const httpServer = createServer(async (req, res) => {
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
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        apps: config.apps.map((a) => a.name),
      }));
      return;
    }

    // Browser GET → landing page
    if ((req.url === "/mcp" || req.url === "/") && req.method === "GET") {
      const accept = req.headers.accept || "";
      if (!accept.includes("text/event-stream")) {
        const appList = config.apps.map((a) => `<li><strong>${a.title}</strong> — ${a.resourceDescription}</li>`).join("\n");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>MCP Apps</title></head><body>
<h1>MCP Apps Server</h1>
<p>This server hosts ${config.apps.length} MCP apps:</p>
<ul>${appList}</ul>
<p>Connect via MCP:</p>
<pre>URL: https://appdiscovery.swapp1990.org/mcp</pre>
<p><a href="/health">Health check</a></p>
</body></html>`);
        return;
      }
    }

    // MCP endpoint — stateless mode
    if (req.url === "/mcp" || req.url === "/") {
      const mcpServer = createMcpServer(config, views);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
      } catch (err) {
        console.error("MCP request error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }

      res.on("close", () => {
        transport.close().catch(() => {});
        mcpServer.close().catch(() => {});
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(config.port, () => {
    console.error(`MCP Apps HTTP Server running on http://localhost:${config.port}/mcp`);
    console.error(`Health check: http://localhost:${config.port}/health`);
  });
}
