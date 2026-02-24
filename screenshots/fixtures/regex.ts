import type { AppScreenshotConfig } from "../../scripts/screenshots/types.js";

const config: AppScreenshotConfig = {
  app: "regex",
  fixtures: [
    // --- Test Mode ---
    {
      name: "test",
      readySelector: ".highlight-output",
      envelope: {
        __regexplayground__: true,
        viewType: "test",
        data: {
          pattern: "\\b[A-Z][a-z]+\\b",
          flags: "g",
          testString: "Hello World from Regex Playground",
          matchCount: 4,
          matches: [
            { index: 0, match: "Hello", groups: [] },
            { index: 6, match: "World", groups: [] },
            { index: 17, match: "Regex", groups: [] },
            { index: 23, match: "Playground", groups: [] },
          ],
        },
      },
    },

    // --- Explain Mode ---
    {
      name: "explain",
      readySelector: ".token-strip",
      envelope: {
        __regexplayground__: true,
        viewType: "explain",
        data: {
          pattern: "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$",
          flags: "",
          tokens: [
            { token: "^", category: "anchor", description: "Start of string" },
            {
              token: "[\\w.-]+",
              category: "character-class",
              description:
                "One or more word characters, dots, or hyphens (local part)",
            },
            { token: "@", category: "literal", description: "Literal @ symbol" },
            {
              token: "[\\w.-]+",
              category: "character-class",
              description:
                "One or more word characters, dots, or hyphens (domain)",
            },
            {
              token: "\\.",
              category: "escape",
              description: "Escaped dot (literal period)",
            },
            {
              token: "[a-zA-Z]{2,}",
              category: "character-class",
              description: "Two or more letters (top-level domain)",
            },
            { token: "$", category: "anchor", description: "End of string" },
          ],
          summary:
            "Matches a basic email address: local part @ domain . TLD. The local part and domain allow word characters, dots, and hyphens. The TLD must be at least 2 letters.",
          flagDescriptions: [],
        },
      },
    },

    // --- Generate Mode ---
    {
      name: "generate",
      readySelector: ".score-badge",
      envelope: {
        __regexplayground__: true,
        viewType: "generate",
        data: {
          pattern: "^\\d{3}-\\d{3}-\\d{4}$",
          flags: "",
          description: "US phone number in XXX-XXX-XXXX format",
          passCount: 5,
          totalCount: 5,
          results: [
            {
              input: "555-123-4567",
              shouldMatch: true,
              didMatch: true,
              passed: true,
            },
            {
              input: "800-555-0199",
              shouldMatch: true,
              didMatch: true,
              passed: true,
            },
            {
              input: "123-456-7890",
              shouldMatch: true,
              didMatch: true,
              passed: true,
            },
            {
              input: "12-345-6789",
              shouldMatch: false,
              didMatch: false,
              passed: true,
            },
            {
              input: "abc-def-ghij",
              shouldMatch: false,
              didMatch: false,
              passed: true,
            },
          ],
        },
      },
    },

    // --- Cheatsheet Mode (4 patterns to fit in viewport) ---
    {
      name: "cheatsheet",
      readySelector: ".pattern-cards",
      envelope: {
        __regexplayground__: true,
        viewType: "cheatsheet",
        data: {
          activeCategory: "All",
          categories: ["All", "Validation", "Web", "Extraction"],
          patterns: [
            {
              name: "Email Address",
              pattern: "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$",
              flags: "",
              category: "Validation",
              description: "Validates basic email format with local part, domain, and TLD",
              example: "user@example.com",
            },
            {
              name: "URL",
              pattern: "https?://[\\w.-]+(?:\\.[a-zA-Z]{2,})(?:/[^\\s]*)?",
              flags: "g",
              category: "Web",
              description: "Matches HTTP and HTTPS URLs with optional path",
              example: "https://example.com/path",
            },
            {
              name: "Hashtags",
              pattern: "#[a-zA-Z_][a-zA-Z0-9_]*",
              flags: "g",
              category: "Extraction",
              description: "Extracts hashtags from social media text",
              example: "#regex #coding",
            },
            {
              name: "Currency Amount",
              pattern: "\\$\\d{1,3}(,\\d{3})*(\\.\\d{2})?",
              flags: "g",
              category: "Extraction",
              description: "Matches US dollar amounts with optional commas and cents",
              example: "$1,234.56",
            },
          ],
        },
      },
    },
  ],
};

export default config;
