import { searchApps } from "../data/catalog.js";
import { logQuery } from "../data/logger.js";
import type { App } from "../types.js";
import type { ToolResult } from "../../../framework/types.js";

export function formatAppSummary(app: App): string {
  const price = app.price === 0 ? "Free" : `$${app.price.toFixed(2)}`;
  const platform = app.platform === "both" ? "iOS & Android" : app.platform === "ios" ? "iOS" : "Android";
  return [
    `${app.name} (${platform}) — ${price} — ${app.rating.toFixed(1)}/5 (${app.reviewCount.toLocaleString()} reviews)`,
    app.shortDescription,
    `Key features: ${app.features.slice(0, 5).join(", ")}`,
  ].join("\n");
}

export async function handleSearchApps(params: {
  keywords?: string;
  category?: string;
  platform?: "ios" | "android" | "both";
  max_price?: number;
  min_rating?: number;
}): Promise<ToolResult> {
  const results = searchApps(params);

  logQuery("search_apps", params, results.length, results.map((a) => a.id));

  if (results.length === 0) {
    const text = "No apps found matching your criteria. Try broader search terms or fewer filters.";
    return {
      text,
      json: { __appdiscovery__: true, viewType: "search", data: { results: [] } },
    };
  }

  const header = `Found ${results.length} app${results.length === 1 ? "" : "s"}:\n`;
  const formatted = results.map((app, i) => `${i + 1}. ${formatAppSummary(app)}`).join("\n\n");
  const text = header + "\n" + formatted;

  return {
    text,
    json: { __appdiscovery__: true, viewType: "search", data: { results } },
  };
}
