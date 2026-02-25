import type { ToolResult } from "../../../framework/types.js";
import { computeLoan, type LoanInput, type LoanResult } from "./calculate-loan.js";

export interface CompareInput {
  scenarios: LoanInput[];
}

export interface CompareResult {
  scenarios: LoanResult[];
  bestMonthly: number;
  bestTotalInterest: number;
  bestTotalCost: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function handleCompareLoans(input: CompareInput): ToolResult {
  if (!input.scenarios || input.scenarios.length < 2) {
    throw new Error("Compare requires at least 2 loan scenarios");
  }
  if (input.scenarios.length > 4) {
    throw new Error("Compare supports at most 4 loan scenarios");
  }

  const results = input.scenarios.map((s) => {
    if (s.principal <= 0) throw new Error("Principal must be positive");
    if (s.annual_rate < 0) throw new Error("Rate cannot be negative");
    if (s.term_years <= 0) throw new Error("Term must be positive");
    return computeLoan(s);
  });

  const bestMonthlyIdx = results.reduce((best, r, i) =>
    r.monthlyTotal < results[best].monthlyTotal ? i : best, 0);
  const bestInterestIdx = results.reduce((best, r, i) =>
    r.totalInterest < results[best].totalInterest ? i : best, 0);
  const bestCostIdx = results.reduce((best, r, i) =>
    r.totalCost < results[best].totalCost ? i : best, 0);

  const compare: CompareResult = {
    scenarios: results,
    bestMonthly: bestMonthlyIdx,
    bestTotalInterest: bestInterestIdx,
    bestTotalCost: bestCostIdx,
  };

  let text = `Loan Comparison — ${results.length} Scenarios:\n\n`;
  results.forEach((r, i) => {
    const label = `Scenario ${i + 1}`;
    text += `${label}: ${fmt(r.loanAmount)} at ${r.annualRate}% for ${r.termYears}yr\n`;
    text += `  Monthly: ${fmt(r.monthlyTotal)}${i === bestMonthlyIdx ? " ← lowest" : ""}\n`;
    text += `  Total Interest: ${fmt(r.totalInterest)}${i === bestInterestIdx ? " ← lowest" : ""}\n`;
    text += `  Total Cost: ${fmt(r.totalCost)}${i === bestCostIdx ? " ← lowest" : ""}\n\n`;
  });

  const interestSaved = results[results.length - 1].totalInterest - results[bestInterestIdx].totalInterest;
  if (interestSaved > 0) {
    text += `Interest savings (best vs last): ${fmt(interestSaved)}`;
  }

  return {
    text,
    json: {
      __loancalculator__: true,
      viewType: "compare",
      data: compare,
    },
  };
}
