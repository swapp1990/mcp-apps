import { getAppByName, getAlternatives } from "../data/catalog.js";
import { logQuery } from "../data/logger.js";
import { formatAppSummary } from "./search.js";
import type { ToolResult } from "../../../framework/types.js";

export async function handleGetAlternatives(params: {
  app_name: string;
}): Promise<ToolResult> {
  const sourceApp = getAppByName(params.app_name);

  if (!sourceApp) {
    logQuery("get_alternatives", params, 0, []);
    const text = `No app found with the name "${params.app_name}". Try searching with search_apps to find the correct name.`;
    return {
      text,
      json: { __appdiscovery__: true, viewType: "alternatives", data: { sourceApp: null, alternatives: [] } },
    };
  }

  const alternatives = getAlternatives(params.app_name);

  logQuery(
    "get_alternatives",
    params,
    alternatives.length,
    alternatives.map((a) => a.id)
  );

  if (alternatives.length === 0) {
    const text = `No alternatives found for ${sourceApp.name} in the ${sourceApp.category} category. The catalog may not have other apps in this category yet.`;
    return {
      text,
      json: { __appdiscovery__: true, viewType: "alternatives", data: { sourceApp, alternatives: [] } },
    };
  }

  const lines: string[] = [
    `Alternatives to ${sourceApp.name} (${sourceApp.category}):`,
    ``,
  ];

  for (let i = 0; i < alternatives.length; i++) {
    const alt = alternatives[i];
    const shared = alt.features.filter((f) =>
      sourceApp.features.some(
        (sf) => sf.toLowerCase().includes(f.toLowerCase().split(" ")[0]) || f.toLowerCase().includes(sf.toLowerCase().split(" ")[0])
      )
    );
    const summary = formatAppSummary(alt);
    const relevance = shared.length > 0
      ? `Similar features: ${shared.slice(0, 3).join(", ")}`
      : `Same category: ${alt.category}`;
    lines.push(`${i + 1}. ${summary}`);
    lines.push(`   Why it's an alternative: ${relevance}`);
    lines.push(``);
  }

  return {
    text: lines.join("\n"),
    json: { __appdiscovery__: true, viewType: "alternatives", data: { sourceApp, alternatives } },
  };
}
