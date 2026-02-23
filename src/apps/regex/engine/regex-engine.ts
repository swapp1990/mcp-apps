// Pure JS regex execution — shared between server tools and View (via Vite)

export interface RegexMatch {
  index: number;
  match: string;
  groups: string[];
  namedGroups?: Record<string, string>;
}

export interface RegexTestResult {
  pattern: string;
  flags: string;
  testString: string;
  matches: RegexMatch[];
  matchCount: number;
  error?: string;
}

export function testRegex(
  pattern: string,
  flags: string,
  testString: string
): RegexTestResult {
  try {
    // Ensure 'g' flag for finding all matches
    const effectiveFlags = flags.includes("g") ? flags : flags + "g";
    const re = new RegExp(pattern, effectiveFlags);

    const matches: RegexMatch[] = [];
    let m: RegExpExecArray | null;
    let safety = 0;

    while ((m = re.exec(testString)) !== null && safety < 100) {
      safety++;
      const groups: string[] = [];
      for (let i = 1; i < m.length; i++) {
        groups.push(m[i] ?? "");
      }

      const named: Record<string, string> = {};
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          named[k] = v ?? "";
        }
      }

      matches.push({
        index: m.index,
        match: m[0],
        groups,
        namedGroups: Object.keys(named).length > 0 ? named : undefined,
      });

      // Prevent infinite loop on zero-length matches
      if (m[0].length === 0) {
        re.lastIndex++;
      }
    }

    return {
      pattern,
      flags,
      testString,
      matches,
      matchCount: matches.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      pattern,
      flags,
      testString,
      matches: [],
      matchCount: 0,
      error: msg,
    };
  }
}

export interface ValidationCase {
  input: string;
  shouldMatch: boolean;
}

export interface ValidationResult {
  input: string;
  shouldMatch: boolean;
  didMatch: boolean;
  passed: boolean;
}

export interface GenerateResult {
  pattern: string;
  flags: string;
  results: ValidationResult[];
  passCount: number;
  totalCount: number;
  error?: string;
}

export function validateRegex(
  pattern: string,
  flags: string,
  cases: ValidationCase[]
): GenerateResult {
  try {
    const re = new RegExp(pattern, flags);

    const results: ValidationResult[] = cases.map((c) => {
      const didMatch = re.test(c.input);
      return {
        input: c.input,
        shouldMatch: c.shouldMatch,
        didMatch,
        passed: didMatch === c.shouldMatch,
      };
    });

    return {
      pattern,
      flags,
      results,
      passCount: results.filter((r) => r.passed).length,
      totalCount: results.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      pattern,
      flags,
      results: [],
      passCount: 0,
      totalCount: cases.length,
      error: msg,
    };
  }
}
