#!/usr/bin/env node

// Unified MCP Apps stdio server

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import appdiscoveryApp from "./apps/appdiscovery/index.js";
import regexApp from "./apps/regex/index.js";
import loanApp from "./apps/loan/index.js";

const server = new McpServer({
  name: "mcp-apps",
  version: "0.1.0",
});

// Register all apps' tools
appdiscoveryApp.registerStdioTools(server);
regexApp.registerStdioTools(server);
loanApp.registerStdioTools(server);

async function main() {
  console.error("MCP Apps Server starting (stdio)...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Apps Server running on stdio — AppDiscovery + Regex Playground + Loan Calculator");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
