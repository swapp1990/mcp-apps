import type { ToolResult } from "../../../framework/types.js";
import { calculateMonthlyPayment } from "./calculate-loan.js";

export interface AmortizationInput {
  principal: number;
  annual_rate: number;
  term_years: number;
  down_payment?: number;
}

export interface AmortizationRow {
  month: number;
  payment: number;
  principalPortion: number;
  interestPortion: number;
  remainingBalance: number;
}

export interface AmortizationResult {
  loanAmount: number;
  annualRate: number;
  termYears: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  schedule: AmortizationRow[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function handleAmortizationSchedule(input: AmortizationInput): ToolResult {
  if (input.principal <= 0) throw new Error("Principal must be positive");
  if (input.annual_rate < 0) throw new Error("Rate cannot be negative");
  if (input.term_years <= 0) throw new Error("Term must be positive");

  const downPayment = input.down_payment ?? 0;
  const loanAmount = input.principal - downPayment;
  const monthlyRate = input.annual_rate / 100 / 12;
  const termMonths = input.term_years * 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyRate, termMonths);

  let balance = loanAmount;
  let totalInterest = 0;
  const schedule: AmortizationRow[] = [];

  for (let month = 1; month <= termMonths; month++) {
    const interestPortion = balance * monthlyRate;
    const principalPortion = monthlyPayment - interestPortion;
    balance -= principalPortion;
    totalInterest += interestPortion;

    schedule.push({
      month,
      payment: round2(monthlyPayment),
      principalPortion: round2(principalPortion),
      interestPortion: round2(interestPortion),
      remainingBalance: round2(Math.max(0, balance)),
    });
  }

  const result: AmortizationResult = {
    loanAmount: round2(loanAmount),
    annualRate: input.annual_rate,
    termYears: input.term_years,
    termMonths,
    monthlyPayment: round2(monthlyPayment),
    totalInterest: round2(totalInterest),
    schedule,
  };

  // Text: show first 12 months + summary
  let text = `Amortization Schedule for ${fmt(loanAmount)} at ${input.annual_rate}% over ${input.term_years} years:\n`;
  text += `Monthly Payment: ${fmt(monthlyPayment)} | Total Interest: ${fmt(totalInterest)}\n\n`;
  text += `Month | Payment    | Principal  | Interest   | Balance\n`;
  text += `------|------------|------------|------------|------------\n`;

  const showMonths = Math.min(12, termMonths);
  for (let i = 0; i < showMonths; i++) {
    const row = schedule[i];
    text += `${String(row.month).padStart(5)} | ${fmt(row.payment).padStart(10)} | ${fmt(row.principalPortion).padStart(10)} | ${fmt(row.interestPortion).padStart(10)} | ${fmt(row.remainingBalance).padStart(10)}\n`;
  }
  if (termMonths > 12) {
    text += `... (${termMonths - 12} more months — ${termMonths} total)\n`;
    const last = schedule[schedule.length - 1];
    text += `\nFinal month (#${last.month}): Principal ${fmt(last.principalPortion)}, Interest ${fmt(last.interestPortion)}, Balance ${fmt(last.remainingBalance)}`;
  }

  return {
    text,
    json: {
      __loancalculator__: true,
      viewType: "amortization",
      data: result,
    },
  };
}
