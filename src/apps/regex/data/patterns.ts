// Hardcoded catalog of 25 common regex patterns in 5 categories

export interface PatternEntry {
  name: string;
  pattern: string;
  flags: string;
  category: "Validation" | "Extraction" | "Formatting" | "Web" | "Numbers";
  description: string;
  example: string;
}

export const PATTERNS: PatternEntry[] = [
  // --- Validation (6) ---
  {
    name: "Email Address",
    pattern: "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$",
    flags: "",
    category: "Validation",
    description: "Validates a basic email address format",
    example: "user@example.com",
  },
  {
    name: "US Phone Number",
    pattern: "^\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$",
    flags: "",
    category: "Validation",
    description: "Matches US phone numbers with optional formatting",
    example: "(555) 123-4567",
  },
  {
    name: "US Zip Code",
    pattern: "^\\d{5}(-\\d{4})?$",
    flags: "",
    category: "Validation",
    description: "Matches 5-digit or 9-digit US zip codes",
    example: "12345 or 12345-6789",
  },
  {
    name: "Strong Password",
    pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*]).{8,}$",
    flags: "",
    category: "Validation",
    description: "At least 8 chars with uppercase, lowercase, digit, and special char",
    example: "P@ssw0rd!",
  },
  {
    name: "Username",
    pattern: "^[a-zA-Z][a-zA-Z0-9_-]{2,15}$",
    flags: "",
    category: "Validation",
    description: "Alphanumeric username, 3-16 chars, starts with letter",
    example: "john_doe99",
  },
  {
    name: "Date (YYYY-MM-DD)",
    pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
    flags: "",
    category: "Validation",
    description: "ISO 8601 date format",
    example: "2026-02-23",
  },

  // --- Extraction (5) ---
  {
    name: "Extract Emails",
    pattern: "[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    category: "Extraction",
    description: "Find all email addresses in text",
    example: "Contact us at info@test.com or help@site.org",
  },
  {
    name: "Extract Hashtags",
    pattern: "#[a-zA-Z]\\w*",
    flags: "g",
    category: "Extraction",
    description: "Find all hashtags in text",
    example: "Loving #regex and #coding today!",
  },
  {
    name: "Extract Quoted Strings",
    pattern: '"([^"]*)"',
    flags: "g",
    category: "Extraction",
    description: "Extract text between double quotes",
    example: 'He said "hello" and "goodbye"',
  },
  {
    name: "Extract HTML Tags",
    pattern: "<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>",
    flags: "g",
    category: "Extraction",
    description: "Find opening HTML tags (not for full parsing)",
    example: '<div class="main"><p>Hello</p></div>',
  },
  {
    name: "Extract Dates",
    pattern: "\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}",
    flags: "g",
    category: "Extraction",
    description: "Find dates in various formats (MM/DD/YYYY, DD-MM-YY, etc.)",
    example: "Born on 03/15/1990, moved on 12-25-2020",
  },

  // --- Formatting (4) ---
  {
    name: "Trim Whitespace",
    pattern: "^\\s+|\\s+$",
    flags: "g",
    category: "Formatting",
    description: "Match leading and trailing whitespace (for removal)",
    example: "  hello world  ",
  },
  {
    name: "Multiple Spaces",
    pattern: "\\s{2,}",
    flags: "g",
    category: "Formatting",
    description: "Match two or more consecutive whitespace characters",
    example: "too   many    spaces",
  },
  {
    name: "CamelCase Split",
    pattern: "([a-z])([A-Z])",
    flags: "g",
    category: "Formatting",
    description: "Find camelCase boundaries (for splitting/converting)",
    example: "myVariableName",
  },
  {
    name: "Thousand Separator Position",
    pattern: "\\B(?=(\\d{3})+(?!\\d))",
    flags: "g",
    category: "Formatting",
    description: "Find positions for inserting thousand separators",
    example: "1234567890",
  },

  // --- Web (5) ---
  {
    name: "URL",
    pattern: "https?://[\\w.-]+(?:\\.[a-zA-Z]{2,})(?:/[^\\s]*)?",
    flags: "g",
    category: "Web",
    description: "Match HTTP/HTTPS URLs",
    example: "Visit https://example.com/path?q=1",
  },
  {
    name: "IPv4 Address",
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b",
    flags: "",
    category: "Web",
    description: "Match valid IPv4 addresses (0.0.0.0 to 255.255.255.255)",
    example: "192.168.1.1",
  },
  {
    name: "MAC Address",
    pattern: "([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}",
    flags: "",
    category: "Web",
    description: "Match MAC addresses (colon or dash separated)",
    example: "00:1A:2B:3C:4D:5E",
  },
  {
    name: "Slug",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    flags: "",
    category: "Web",
    description: "Match URL-friendly slugs (lowercase, hyphen-separated)",
    example: "my-blog-post-title",
  },
  {
    name: "Hex Color",
    pattern: "#(?:[0-9A-Fa-f]{3}){1,2}\\b",
    flags: "g",
    category: "Web",
    description: "Match hex color codes (#RGB or #RRGGBB)",
    example: "Colors: #fff, #3b82f6, #1a1a1a",
  },

  // --- Numbers (5) ---
  {
    name: "Integer",
    pattern: "^-?\\d+$",
    flags: "",
    category: "Numbers",
    description: "Match positive or negative integers",
    example: "42 or -7",
  },
  {
    name: "Decimal Number",
    pattern: "^-?\\d+\\.\\d+$",
    flags: "",
    category: "Numbers",
    description: "Match decimal numbers with required fractional part",
    example: "3.14 or -0.5",
  },
  {
    name: "Scientific Notation",
    pattern: "^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$",
    flags: "",
    category: "Numbers",
    description: "Match numbers in scientific notation",
    example: "1.5e10 or -2.3E-4",
  },
  {
    name: "Currency (USD)",
    pattern: "\\$\\d{1,3}(,\\d{3})*(\\.\\d{2})?",
    flags: "g",
    category: "Numbers",
    description: "Match US dollar amounts with optional cents",
    example: "$1,234.56 or $99",
  },
  {
    name: "Percentage",
    pattern: "\\d+(\\.\\d+)?%",
    flags: "g",
    category: "Numbers",
    description: "Match percentage values",
    example: "50% off, save 12.5%!",
  },
];

export function getPatterns(category?: string): PatternEntry[] {
  if (!category || category === "All") return PATTERNS;
  return PATTERNS.filter((p) => p.category === category);
}

export const CATEGORIES = ["All", "Validation", "Extraction", "Formatting", "Web", "Numbers"] as const;
