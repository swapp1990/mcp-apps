// Pattern tokenizer/explainer — breaks regex into annotated tokens
// Categories: literal, anchor, quantifier, character-class, group, escape, alternation, flag

export type TokenCategory =
  | "literal"
  | "anchor"
  | "quantifier"
  | "character-class"
  | "group"
  | "escape"
  | "alternation"
  | "flag";

export interface Token {
  token: string;
  category: TokenCategory;
  description: string;
}

export interface ExplainResult {
  pattern: string;
  flags: string;
  tokens: Token[];
  summary: string;
  flagDescriptions: { flag: string; description: string }[];
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  g: "Global — find all matches, not just the first",
  i: "Case-insensitive — ignore upper/lower case",
  m: "Multiline — ^ and $ match line boundaries",
  s: "Dotall — dot (.) matches newlines too",
  u: "Unicode — treat pattern as Unicode code points",
  y: "Sticky — match only at lastIndex position",
  d: "Has indices — include match index info",
};

export function explainRegex(pattern: string, flags: string): ExplainResult {
  const tokens = tokenize(pattern);
  const flagDescriptions = flags
    .split("")
    .filter((f) => FLAG_DESCRIPTIONS[f])
    .map((f) => ({ flag: f, description: FLAG_DESCRIPTIONS[f] }));

  const summary = buildSummary(tokens, flags);

  return { pattern, flags, tokens, summary, flagDescriptions };
}

function tokenize(pattern: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    // Anchors
    if (ch === "^") {
      tokens.push({ token: "^", category: "anchor", description: "Start of string (or line in multiline mode)" });
      i++;
      continue;
    }
    if (ch === "$") {
      tokens.push({ token: "$", category: "anchor", description: "End of string (or line in multiline mode)" });
      i++;
      continue;
    }

    // Escape sequences
    if (ch === "\\") {
      if (i + 1 < pattern.length) {
        const next = pattern[i + 1];
        const seq = "\\" + next;

        const escapeMap: Record<string, string> = {
          "\\d": "Any digit (0-9)",
          "\\D": "Any non-digit",
          "\\w": "Any word character (letter, digit, underscore)",
          "\\W": "Any non-word character",
          "\\s": "Any whitespace (space, tab, newline)",
          "\\S": "Any non-whitespace",
          "\\b": "Word boundary",
          "\\B": "Non-word boundary",
          "\\n": "Newline character",
          "\\t": "Tab character",
          "\\r": "Carriage return",
          "\\f": "Form feed",
          "\\v": "Vertical tab",
          "\\0": "Null character",
        };

        if (escapeMap[seq]) {
          const cat: TokenCategory = seq === "\\b" || seq === "\\B" ? "anchor" : "escape";
          tokens.push({ token: seq, category: cat, description: escapeMap[seq] });
        } else if (/[1-9]/.test(next)) {
          tokens.push({ token: seq, category: "escape", description: `Back-reference to group ${next}` });
        } else {
          tokens.push({ token: seq, category: "escape", description: `Escaped '${next}' (literal)` });
        }
        i += 2;
        continue;
      }
      // Trailing backslash
      tokens.push({ token: "\\", category: "literal", description: "Backslash (incomplete escape)" });
      i++;
      continue;
    }

    // Character classes [...]
    if (ch === "[") {
      let cls = "[";
      let j = i + 1;
      let negated = false;
      if (j < pattern.length && pattern[j] === "^") {
        negated = true;
        cls += "^";
        j++;
      }
      // Handle ] as first char in class
      if (j < pattern.length && pattern[j] === "]") {
        cls += "]";
        j++;
      }
      while (j < pattern.length && pattern[j] !== "]") {
        if (pattern[j] === "\\" && j + 1 < pattern.length) {
          cls += "\\" + pattern[j + 1];
          j += 2;
        } else {
          cls += pattern[j];
          j++;
        }
      }
      if (j < pattern.length) {
        cls += "]";
        j++;
      }
      const desc = negated
        ? `Character class (negated): match any character NOT in ${cls}`
        : `Character class: match any character in ${cls}`;
      tokens.push({ token: cls, category: "character-class", description: desc });
      i = j;
      continue;
    }

    // Groups (...) — including named, non-capturing, lookaheads
    if (ch === "(") {
      let groupToken = "(";
      let j = i + 1;
      let desc = "Capturing group";

      if (pattern.substring(j).startsWith("?:")) {
        groupToken = "(?:";
        j += 2;
        desc = "Non-capturing group";
      } else if (pattern.substring(j).startsWith("?=")) {
        groupToken = "(?=";
        j += 2;
        desc = "Positive lookahead";
      } else if (pattern.substring(j).startsWith("?!")) {
        groupToken = "(?!";
        j += 2;
        desc = "Negative lookahead";
      } else if (pattern.substring(j).startsWith("?<=")) {
        groupToken = "(?<=";
        j += 3;
        desc = "Positive lookbehind";
      } else if (pattern.substring(j).startsWith("?<!")) {
        groupToken = "(?<!";
        j += 3;
        desc = "Negative lookbehind";
      } else if (pattern.substring(j).startsWith("?<")) {
        // Named group (?<name>...)
        const nameMatch = pattern.substring(j).match(/^\?<([^>]+)>/);
        if (nameMatch) {
          groupToken = `(?<${nameMatch[1]}>`;
          j += nameMatch[0].length;
          desc = `Named capturing group '${nameMatch[1]}'`;
        }
      }

      tokens.push({ token: groupToken, category: "group", description: desc + " — start" });
      i = j;
      continue;
    }

    if (ch === ")") {
      tokens.push({ token: ")", category: "group", description: "Group — end" });
      i++;
      continue;
    }

    // Alternation
    if (ch === "|") {
      tokens.push({ token: "|", category: "alternation", description: "Alternation — match either the left or right side" });
      i++;
      continue;
    }

    // Quantifiers
    if (ch === "*" || ch === "+" || ch === "?") {
      let token = ch;
      let lazy = false;
      if (i + 1 < pattern.length && pattern[i + 1] === "?") {
        token += "?";
        lazy = true;
      }
      const qDesc: Record<string, string> = {
        "*": "Zero or more",
        "+": "One or more",
        "?": "Zero or one (optional)",
      };
      const desc = qDesc[ch] + (lazy ? " (lazy/non-greedy)" : " (greedy)");
      tokens.push({ token, category: "quantifier", description: desc });
      i += token.length;
      continue;
    }

    // {n}, {n,}, {n,m}
    if (ch === "{") {
      const braceMatch = pattern.substring(i).match(/^\{(\d+)(,(\d*))?\}/);
      if (braceMatch) {
        const token = braceMatch[0];
        const min = braceMatch[1];
        const hasComma = braceMatch[2] !== undefined;
        const max = braceMatch[3];
        let desc: string;
        if (!hasComma) {
          desc = `Exactly ${min} times`;
        } else if (max === undefined || max === "") {
          desc = `${min} or more times`;
        } else {
          desc = `Between ${min} and ${max} times`;
        }

        // Check for lazy modifier
        let fullToken = token;
        if (i + token.length < pattern.length && pattern[i + token.length] === "?") {
          fullToken += "?";
          desc += " (lazy/non-greedy)";
        } else {
          desc += " (greedy)";
        }

        tokens.push({ token: fullToken, category: "quantifier", description: desc });
        i += fullToken.length;
        continue;
      }
    }

    // Dot
    if (ch === ".") {
      tokens.push({ token: ".", category: "character-class", description: "Any character except newline (or any character in dotall mode)" });
      i++;
      continue;
    }

    // Literal character
    tokens.push({ token: ch, category: "literal", description: `Literal '${ch}'` });
    i++;
  }

  return tokens;
}

function buildSummary(tokens: Token[], flags: string): string {
  const parts: string[] = [];

  const hasAnchorStart = tokens.some((t) => t.token === "^");
  const hasAnchorEnd = tokens.some((t) => t.token === "$");
  const groupCount = tokens.filter((t) => t.category === "group" && t.token.startsWith("(")).length;
  const hasAlternation = tokens.some((t) => t.category === "alternation");

  if (hasAnchorStart && hasAnchorEnd) {
    parts.push("This pattern matches the entire string from start to end.");
  } else if (hasAnchorStart) {
    parts.push("This pattern matches at the start of the string.");
  } else if (hasAnchorEnd) {
    parts.push("This pattern matches at the end of the string.");
  } else {
    parts.push("This pattern matches anywhere in the string.");
  }

  if (groupCount > 0) {
    parts.push(`Contains ${groupCount} capture group${groupCount > 1 ? "s" : ""}.`);
  }

  if (hasAlternation) {
    parts.push("Uses alternation (|) to match one of several alternatives.");
  }

  if (flags.includes("i")) parts.push("Case-insensitive matching.");
  if (flags.includes("m")) parts.push("Multiline mode enabled.");
  if (flags.includes("s")) parts.push("Dotall mode — dot matches newlines.");

  return parts.join(" ");
}
