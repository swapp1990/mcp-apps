import type { ToolResult } from "../../../framework/types.js";

export interface LoanInput {
  principal: number;
  annual_rate: number;
  term_years: number;
  down_payment?: number;
  property_tax_rate?: number;
  annual_insurance?: number;
}

export interface LoanResult {
  principal: number;
  loanAmount: number;
  downPayment: number;
  annualRate: number;
  termYears: number;
  termMonths: number;
  monthlyPrincipalInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyTotal: number;
  totalInterest: number;
  totalCost: number;
  propertyTaxRate: number;
  annualInsurance: number;
}

/** Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1] */
export function calculateMonthlyPayment(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  if (monthlyRate === 0) return principal / termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return principal * (monthlyRate * factor) / (factor - 1);
}

export function computeLoan(input: LoanInput): LoanResult {
  const downPayment = input.down_payment ?? 0;
  const loanAmount = input.principal - downPayment;
  const monthlyRate = input.annual_rate / 100 / 12;
  const termMonths = input.term_years * 12;

  const monthlyPI = calculateMonthlyPayment(loanAmount, monthlyRate, termMonths);
  const monthlyTax = input.property_tax_rate
    ? (input.principal * (input.property_tax_rate / 100)) / 12
    : 0;
  const monthlyInsurance = input.annual_insurance
    ? input.annual_insurance / 12
    : 0;

  const monthlyTotal = monthlyPI + monthlyTax + monthlyInsurance;
  const totalInterest = monthlyPI * termMonths - loanAmount;
  const totalCost = monthlyTotal * termMonths + downPayment;

  return {
    principal: input.principal,
    loanAmount,
    downPayment,
    annualRate: input.annual_rate,
    termYears: input.term_years,
    termMonths,
    monthlyPrincipalInterest: round2(monthlyPI),
    monthlyTax: round2(monthlyTax),
    monthlyInsurance: round2(monthlyInsurance),
    monthlyTotal: round2(monthlyTotal),
    totalInterest: round2(totalInterest),
    totalCost: round2(totalCost),
    propertyTaxRate: input.property_tax_rate ?? 0,
    annualInsurance: input.annual_insurance ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function handleCalculateLoan(input: LoanInput): ToolResult {
  if (input.principal <= 0) throw new Error("Principal must be positive");
  if (input.annual_rate < 0) throw new Error("Rate cannot be negative");
  if (input.term_years <= 0) throw new Error("Term must be positive");
  if (input.down_payment && input.down_payment >= input.principal) {
    throw new Error("Down payment must be less than principal");
  }

  const result = computeLoan(input);

  let text = `Loan Calculation:\n`;
  text += `  Home Price: ${fmt(result.principal)}\n`;
  if (result.downPayment > 0)
    text += `  Down Payment: ${fmt(result.downPayment)} (${((result.downPayment / result.principal) * 100).toFixed(1)}%)\n`;
  text += `  Loan Amount: ${fmt(result.loanAmount)}\n`;
  text += `  Rate: ${result.annualRate}% | Term: ${result.termYears} years\n\n`;
  text += `  Monthly Payment: ${fmt(result.monthlyTotal)}\n`;
  text += `    Principal & Interest: ${fmt(result.monthlyPrincipalInterest)}\n`;
  if (result.monthlyTax > 0) text += `    Property Tax: ${fmt(result.monthlyTax)}\n`;
  if (result.monthlyInsurance > 0) text += `    Insurance: ${fmt(result.monthlyInsurance)}\n`;
  text += `\n  Total Interest: ${fmt(result.totalInterest)}\n`;
  text += `  Total Cost: ${fmt(result.totalCost)}`;

  return {
    text,
    json: {
      __loancalculator__: true,
      viewType: "calculate",
      data: result,
    },
  };
}
