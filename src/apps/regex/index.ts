// Regex Playground app module — registers tools for both HTTP and stdio modes

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { handleTestRegex } from "./tools/test-regex.js";
import { handleExplainRegex } from "./tools/explain-regex.js";
import { handleCommonPatterns } from "./tools/common-patterns.js";
import { handleGenerateRegex } from "./tools/generate-regex.js";
import type { McpAppModule } from "../../framework/types.js";

const TEST_CASES_SCHEMA = z.array(
  z.object({
    input: z.string().max(10000).describe("Test string"),
    should_match: z.boolean().describe("Whether the pattern should match this string"),
  })
).min(1).max(50).describe("Array of test cases to validate the pattern against (1-50 cases)");

function makeHandler(handler: (params: any) => { text: string; json: Record<string, unknown> }) {
  return async (params: any) => {
    try {
      const result = handler(params);
      return {
        content: [
          { type: "text" as const, text: result.text },
          { type: "text" as const, text: JSON.stringify(result.json) },
        ],
        structuredContent: result.json,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      const errorJson = { __regexplayground__: true, viewType: "error", data: { error: message } };
      return {
        content: [
          { type: "text" as const, text: `Error: ${message}` },
          { type: "text" as const, text: JSON.stringify(errorJson) },
        ],
        structuredContent: errorJson,
      };
    }
  };
}

// All regex tools are pure local computation — no external systems, no side effects.
const REGEX_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

const regexApp: McpAppModule = {
  name: "regex",
  title: "Regex Playground",
  resourceUri: "ui://regexplayground/view.html",
  resourceDescription: "Interactive regex testing interface",

  registerTools(server: McpServer, resourceUri: string) {
    registerAppTool(server, "test_regex", {
      title: "Test Regex",
      description: "Test a regex pattern against a string. Returns all matches with indices and capture groups.",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        pattern: z.string().min(1).max(5000).describe("The regex pattern (without delimiters)"),
        flags: z.string().max(10).optional().describe("Regex flags (e.g., 'gi', 'gm'). Default: no flags."),
        test_string: z.string().min(1).max(100000).describe("The string to test the pattern against"),
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleTestRegex));

    registerAppTool(server, "explain_regex", {
      title: "Explain Regex",
      description: "Break down a regex pattern into annotated tokens with human-readable descriptions.",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        pattern: z.string().min(1).max(5000).describe("The regex pattern to explain (without delimiters)"),
        flags: z.string().max(10).optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleExplainRegex));

    registerAppTool(server, "common_patterns", {
      title: "Common Patterns",
      description: "Browse a catalog of common regex patterns organized by category.",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        category: z.string().optional().describe("Filter by category: Validation, Extraction, Formatting, Web, Numbers, or All"),
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleCommonPatterns));

    registerAppTool(server, "generate_regex", {
      title: "Validate Regex",
      description: "Validate a regex pattern against test cases (should-match and should-not-match lists).",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        pattern: z.string().min(1).max(5000).describe("The regex pattern to validate"),
        flags: z.string().max(10).optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
        description: z.string().max(500).optional().describe("Human-readable description of what the regex should match"),
        test_cases: TEST_CASES_SCHEMA,
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleGenerateRegex));
  },

  registerStdioTools(server: McpServer) {
    server.registerTool("test_regex", {
      description: "Test a regex pattern against a string. Returns all matches with indices and capture groups.",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        pattern: z.string().min(1).max(5000).describe("The regex pattern (without delimiters)"),
        flags: z.string().max(10).optional().describe("Regex flags (e.g., 'gi', 'gm'). Default: no flags."),
        test_string: z.string().min(1).max(100000).describe("The string to test the pattern against"),
      },
    }, makeHandler(handleTestRegex));

    server.registerTool("explain_regex", {
      description: "Break down a regex pattern into annotated tokens with human-readable descriptions.",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        pattern: z.string().min(1).max(5000).describe("The regex pattern to explain (without delimiters)"),
        flags: z.string().max(10).optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
      },
    }, makeHandler(handleExplainRegex));

    server.registerTool("common_patterns", {
      description: "Browse a catalog of common regex patterns organized by category (Validation, Extraction, Formatting, Web, Numbers).",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        category: z.string().optional().describe("Filter by category: Validation, Extraction, Formatting, Web, Numbers, or All"),
      },
    }, makeHandler(handleCommonPatterns));

    server.registerTool("generate_regex", {
      description: "Validate a regex pattern against test cases (should-match and should-not-match lists).",
      annotations: REGEX_ANNOTATIONS,
      inputSchema: {
        pattern: z.string().min(1).max(5000).describe("The regex pattern to validate"),
        flags: z.string().max(10).optional().describe("Regex flags (e.g., 'gi'). Default: no flags."),
        description: z.string().max(500).optional().describe("Human-readable description of what the regex should match"),
        test_cases: TEST_CASES_SCHEMA,
      },
    }, makeHandler(handleGenerateRegex));
  },
};

export default regexApp;
