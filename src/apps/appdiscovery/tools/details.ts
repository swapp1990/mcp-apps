import { getAppByName } from "../data/catalog.js";
import { logQuery } from "../data/logger.js";
import type { App } from "../types.js";
import type { ToolResult } from "../../../framework/types.js";

function formatFullDetails(app: App): string {
  const price = app.price === 0 ? "Free" : `$${app.price.toFixed(2)}`;
  const platform = app.platform === "both" ? "iOS & Android" : app.platform === "ios" ? "iOS" : "Android";

  const lines: string[] = [
    `${app.name}`,
    `${"=".repeat(app.name.length)}`,
    ``,
    `Platform: ${platform}`,
    `Category: ${app.category}`,
    `Price: ${price}`,
    `Rating: ${app.rating.toFixed(1)}/5 (${app.reviewCount.toLocaleString()} reviews)`,
    `Developer: ${app.developer}`,
    `Last Updated: ${app.lastUpdated}`,
    ``,
    `Description:`,
    app.fullDescription,
    ``,
    `Key Features:`,
    ...app.features.map((f) => `  - ${f}`),
  ];

  if (app.pros.length > 0) {
    lines.push(``, `Pros:`);
    lines.push(...app.pros.map((p) => `  + ${p}`));
  }

  if (app.cons.length > 0) {
    lines.push(``, `Cons:`);
    lines.push(...app.cons.map((c) => `  - ${c}`));
  }

  if (app.appStoreUrl) {
    lines.push(``, `App Store: ${app.appStoreUrl}`);
  }

  if (app.playStoreUrl) {
    lines.push(`Play Store: ${app.playStoreUrl}`);
  }

  return lines.join("\n");
}

export async function handleGetAppDetails(params: {
  app_name: string;
}): Promise<ToolResult> {
  const app = getAppByName(params.app_name);

  logQuery(
    "get_app_details",
    params,
    app ? 1 : 0,
    app ? [app.id] : []
  );

  if (!app) {
    const text = `No app found with the name "${params.app_name}". Try searching with search_apps to find the correct name.`;
    return {
      text,
      json: { __appdiscovery__: true, viewType: "detail", data: { app: null } },
    };
  }

  return {
    text: formatFullDetails(app),
    json: { __appdiscovery__: true, viewType: "detail", data: { app } },
  };
}
