import { getAppByName } from "../data/catalog.js";
import { logQuery } from "../data/logger.js";
import type { App } from "../types.js";
import type { ToolResult } from "../../../framework/types.js";

function formatComparison(apps: App[]): string {
  const lines: string[] = [`Comparing ${apps.map((a) => a.name).join(" vs ")}`, ``];

  lines.push(`Price:`);
  for (const app of apps) {
    const price = app.price === 0 ? "Free" : `$${app.price.toFixed(2)}`;
    lines.push(`  ${app.name}: ${price}`);
  }

  lines.push(``, `Rating:`);
  for (const app of apps) {
    lines.push(`  ${app.name}: ${app.rating.toFixed(1)}/5 (${app.reviewCount.toLocaleString()} reviews)`);
  }

  lines.push(``, `Platform:`);
  for (const app of apps) {
    const platform = app.platform === "both" ? "iOS & Android" : app.platform === "ios" ? "iOS" : "Android";
    lines.push(`  ${app.name}: ${platform}`);
  }

  lines.push(``, `Key Features:`);
  for (const app of apps) {
    lines.push(`  ${app.name}:`);
    for (const f of app.features.slice(0, 5)) {
      lines.push(`    - ${f}`);
    }
  }

  lines.push(``, `Pros:`);
  for (const app of apps) {
    if (app.pros.length > 0) {
      lines.push(`  ${app.name}:`);
      for (const p of app.pros.slice(0, 3)) {
        lines.push(`    + ${p}`);
      }
    }
  }

  lines.push(``, `Cons:`);
  for (const app of apps) {
    if (app.cons.length > 0) {
      lines.push(`  ${app.name}:`);
      for (const c of app.cons.slice(0, 3)) {
        lines.push(`    - ${c}`);
      }
    }
  }

  lines.push(``, `Summary:`);
  const sorted = [...apps].sort((a, b) => b.rating - a.rating);
  const best = sorted[0];
  const cheapest = [...apps].sort((a, b) => a.price - b.price)[0];
  lines.push(`  Highest rated: ${best.name} (${best.rating.toFixed(1)}/5)`);
  lines.push(`  Most affordable: ${cheapest.name} (${cheapest.price === 0 ? "Free" : `$${cheapest.price.toFixed(2)}`})`);

  return lines.join("\n");
}

export async function handleCompareApps(params: {
  apps: string[];
}): Promise<ToolResult> {
  if (params.apps.length < 2) {
    const text = "Please provide at least 2 app names to compare. Example: compare_apps(apps: [\"App A\", \"App B\"])";
    return {
      text,
      json: { __appdiscovery__: true, viewType: "compare", data: { apps: [] } },
    };
  }

  if (params.apps.length > 4) {
    const text = "Please provide at most 4 apps to compare at a time.";
    return {
      text,
      json: { __appdiscovery__: true, viewType: "compare", data: { apps: [] } },
    };
  }

  const found: App[] = [];
  const notFound: string[] = [];

  for (const name of params.apps) {
    const app = getAppByName(name);
    if (app) {
      found.push(app);
    } else {
      notFound.push(name);
    }
  }

  logQuery(
    "compare_apps",
    params,
    found.length,
    found.map((a) => a.id)
  );

  if (found.length < 2) {
    const msg = notFound.length > 0
      ? `Could not find: ${notFound.join(", ")}. `
      : "";
    const text = `${msg}Need at least 2 apps to compare. Try searching with search_apps to find the correct names.`;
    return {
      text,
      json: { __appdiscovery__: true, viewType: "compare", data: { apps: [] } },
    };
  }

  let text = formatComparison(found);
  if (notFound.length > 0) {
    text += `\n\nNote: Could not find these apps in the catalog: ${notFound.join(", ")}`;
  }

  return {
    text,
    json: { __appdiscovery__: true, viewType: "compare", data: { apps: found } },
  };
}
