import { testRegex } from "../engine/regex-engine.js";
import type { ToolResult } from "../../../framework/types.js";

export function handleTestRegex(input: {
  pattern: string;
  flags?: string;
  test_string: string;
}): ToolResult {
  const flags = input.flags ?? "";
  const result = testRegex(input.pattern, flags, input.test_string);

  if (result.error) {
    return {
      text: `Error: Invalid regex /${input.pattern}/${flags} — ${result.error}`,
      json: { __regexplayground__: true, viewType: "test", data: result },
    };
  }

  let text: string;
  if (result.matchCount === 0) {
    text = `No matches found for /${input.pattern}/${flags} in the test string.`;
  } else {
    const matchLines = result.matches.map((m, i) => {
      let line = `  ${i + 1}. "${m.match}" at index ${m.index}`;
      if (m.groups.length > 0) {
        line += ` — groups: [${m.groups.map((g) => `"${g}"`).join(", ")}]`;
      }
      return line;
    });
    text = `Found ${result.matchCount} match${result.matchCount > 1 ? "es" : ""} for /${input.pattern}/${flags}:\n${matchLines.join("\n")}`;
  }

  return { text, json: { __regexplayground__: true, viewType: "test", data: result } };
}
