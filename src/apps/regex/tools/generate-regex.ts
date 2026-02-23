import { validateRegex, type ValidationCase } from "../engine/regex-engine.js";
import type { ToolResult } from "../../../framework/types.js";

export function handleGenerateRegex(input: {
  pattern: string;
  flags?: string;
  description?: string;
  test_cases: { input: string; should_match: boolean }[];
}): ToolResult {
  const flags = input.flags ?? "";
  const cases: ValidationCase[] = input.test_cases.map((c) => ({
    input: c.input,
    shouldMatch: c.should_match,
  }));

  const result = validateRegex(input.pattern, flags, cases);

  if (result.error) {
    return {
      text: `Error: Invalid regex /${input.pattern}/${flags} — ${result.error}`,
      json: { __regexplayground__: true, viewType: "generate", data: { ...result, description: input.description || "" } },
    };
  }

  const resultLines = result.results.map((r) => {
    const icon = r.passed ? "PASS" : "FAIL";
    const expected = r.shouldMatch ? "should match" : "should NOT match";
    const actual = r.didMatch ? "matched" : "did not match";
    return `  [${icon}] "${r.input}" — ${expected}, ${actual}`;
  });

  const score = `${result.passCount}/${result.totalCount}`;
  let text = `Regex validation for /${input.pattern}/${flags}`;
  if (input.description) text += ` (${input.description})`;
  text += `\nScore: ${score}\n\n${resultLines.join("\n")}`;

  return {
    text,
    json: { __regexplayground__: true, viewType: "generate", data: { ...result, description: input.description || "" } },
  };
}
