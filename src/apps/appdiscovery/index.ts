// AppDiscovery app module — registers tools for both HTTP and stdio modes

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { handleSearchApps } from "./tools/search.js";
import { handleGetAppDetails } from "./tools/details.js";
import { handleCompareApps } from "./tools/compare.js";
import { handleGetAlternatives } from "./tools/alternatives.js";
import { loadCatalog } from "./data/catalog.js";
import type { McpAppModule } from "../../framework/types.js";

const SEARCH_SCHEMA = {
  keywords: z.string().optional().describe("Search keywords"),
  category: z.string().optional().describe("App category (e.g., Photography, Productivity, Travel)"),
  platform: z.enum(["ios", "android", "both"]).optional().describe("Target platform"),
  max_price: z.number().optional().describe("Maximum price in USD (0 for free only)"),
  min_rating: z.number().optional().describe("Minimum star rating (1-5)"),
};

function makeHandler(handler: (params: any) => Promise<{ text: string; json: Record<string, unknown> }>) {
  return async (params: any) => {
    const result = await handler(params);
    return {
      content: [
        { type: "text" as const, text: result.text },
        { type: "text" as const, text: JSON.stringify(result.json) },
      ],
      structuredContent: result.json,
    };
  };
}

const appdiscoveryApp: McpAppModule = {
  name: "appdiscovery",
  title: "AppDiscovery",
  resourceUri: "ui://appdiscovery/view.html",
  resourceDescription: "Interactive app discovery interface",
  cspResourceDomains: ["https://is1-ssl.mzstatic.com"],

  registerTools(server: McpServer, resourceUri: string) {
    registerAppTool(server, "search_apps", {
      title: "Search Apps",
      description: "Search for mobile apps by keywords, category, platform, price, or rating. Returns matching apps with name, description, rating, price, and key features.",
      inputSchema: SEARCH_SCHEMA,
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleSearchApps));

    registerAppTool(server, "get_app_details", {
      title: "App Details",
      description: "Get full details for a specific app by name.",
      inputSchema: { app_name: z.string().describe("The name of the app to look up") },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleGetAppDetails));

    registerAppTool(server, "compare_apps", {
      title: "Compare Apps",
      description: "Compare 2-4 apps side by side.",
      inputSchema: { apps: z.array(z.string()).min(2).max(4).describe("App names to compare") },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleCompareApps));

    registerAppTool(server, "get_alternatives", {
      title: "App Alternatives",
      description: "Find alternative apps similar to a given app.",
      inputSchema: { app_name: z.string().describe("The app to find alternatives for") },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleGetAlternatives));
  },

  registerStdioTools(server: McpServer) {
    server.registerTool("search_apps", {
      description: "Search for mobile apps by keywords, category, platform, price, or rating. Returns matching apps with name, description, rating, price, and key features. Use this when a user asks for app recommendations, wants to find apps in a category, or is looking for specific types of apps.",
      inputSchema: SEARCH_SCHEMA,
    }, makeHandler(handleSearchApps));

    server.registerTool("get_app_details", {
      description: "Get full details for a specific app by name. Returns complete information including description, features, pros/cons, pricing, ratings, and store links. Use this when a user wants to know more about a specific app.",
      inputSchema: { app_name: z.string().describe("The name of the app to look up") },
    }, makeHandler(handleGetAppDetails));

    server.registerTool("compare_apps", {
      description: "Compare 2-4 apps side by side. Returns a comparison of price, rating, features, pros, and cons for each app. Use this when a user wants to decide between multiple apps or asks 'which is better'.",
      inputSchema: { apps: z.array(z.string()).min(2).max(4).describe("Array of app names to compare (2-4 apps)") },
    }, makeHandler(handleCompareApps));

    server.registerTool("get_alternatives", {
      description: "Find alternative apps similar to a given app. Returns apps in the same category with relevance reasoning. Use this when a user asks for alternatives, replacements, or 'apps like X'.",
      inputSchema: { app_name: z.string().describe("The name of the app to find alternatives for") },
    }, makeHandler(handleGetAlternatives));
  },
};

// Pre-load catalog on import
loadCatalog();

export default appdiscoveryApp;
