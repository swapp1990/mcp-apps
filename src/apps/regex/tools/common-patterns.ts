import { getPatterns, CATEGORIES } from "../data/patterns.js";
import type { ToolResult } from "../../../framework/types.js";

export function handleCommonPatterns(input: { category?: string }): ToolResult {
  const category = input.category;
  const patterns = getPatterns(category);

  let text: string;
  if (patterns.length === 0) {
    text = `No patterns found for category "${category}". Available categories: ${CATEGORIES.join(", ")}`;
  } else {
    const heading = category && category !== "All"
      ? `Common regex patterns — ${category} (${patterns.length})`
      : `Common regex patterns — All (${patterns.length})`;

    const lines = patterns.map(
      (p) => `  ${p.name}: /${p.pattern}/${p.flags}\n    ${p.description}\n    Example: ${p.example}`
    );

    text = `${heading}\n\n${lines.join("\n\n")}`;
  }

  return {
    text,
    json: {
      __regexplayground__: true,
      viewType: "cheatsheet",
      data: { patterns, categories: [...CATEGORIES], activeCategory: category || "All" },
    },
  };
}
