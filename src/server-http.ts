#!/usr/bin/env node

// Unified MCP Apps HTTP server
// Each app gets its own endpoint: /<appname>/mcp

import { startHttpServer } from "./framework/server.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import appdiscoveryApp from "./apps/appdiscovery/index.js";
import regexApp from "./apps/regex/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);

startHttpServer({
  name: "mcp-apps",
  version: "0.1.0",
  port: PORT,
  distDir: join(__dirname, "../dist/views"),
  apps: [appdiscoveryApp, regexApp],
  viewFiles: {
    appdiscovery: "appdiscovery.html",
    regex: "regex.html",
  },
  baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`,
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
