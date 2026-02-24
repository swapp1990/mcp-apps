import { explainRegex } from "../engine/regex-explainer.js";
import type { ToolResult } from "../../../framework/types.js";

export function handleExplainRegex(input: {
  pattern: string;
  flags?: string;
}): ToolResult {
  const flags = input.flags ?? "";

  // Validate regex is parseable before explaining
  try {
    new RegExp(input.pattern, flags);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid regex pattern";
    return {
      text: `Invalid regex: ${message}`,
      json: { __regexplayground__: true, viewType: "error", data: { error: message, pattern: input.pattern, flags } },
    };
  }

  const result = explainRegex(input.pattern, flags);

  const tokenLines = result.tokens.map(
    (t) => `  ${t.token} — ${t.description} [${t.category}]`
  );

  let text = `Regex breakdown for /${input.pattern}/${flags}:\n\n`;
  text += tokenLines.join("\n");
  text += `\n\n${result.summary}`;

  if (result.flagDescriptions.length > 0) {
    text += "\n\nFlags:";
    for (const f of result.flagDescriptions) {
      text += `\n  ${f.flag} — ${f.description}`;
    }
  }

  return { text, json: { __regexplayground__: true, viewType: "explain", data: result } };
}
