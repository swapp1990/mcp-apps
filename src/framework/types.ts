// Shared types for the MCP apps framework

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Result returned by tool handlers — text for AI, json for View */
export interface ToolResult {
  text: string;
  json: Record<string, unknown>;
}

/** App module interface — each app exports this */
export interface McpAppModule {
  /** Unique app identifier */
  name: string;
  /** Human-readable title */
  title: string;
  /** Register tools on the server (HTTP mode with View) */
  registerTools(server: McpServer, resourceUri: string): void;
  /** Register tools on the server (stdio mode, no View) */
  registerStdioTools(server: McpServer): void;
  /** Resource URI for this app's View */
  resourceUri: string;
  /** Description for the resource */
  resourceDescription: string;
  /** CSP resource domains needed by the View (optional) */
  cspResourceDomains?: string[];
}
