// Loan Calculator app module — registers tools for both HTTP and stdio modes

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { handleCalculateLoan } from "./tools/calculate-loan.js";
import { handleAmortizationSchedule } from "./tools/amortization-schedule.js";
import { handleCompareLoans } from "./tools/compare-loans.js";
import type { McpAppModule } from "../../framework/types.js";

const LOAN_SCENARIO_SCHEMA = z.object({
  principal: z.number().positive().describe("Home price or total loan principal in USD"),
  annual_rate: z.number().min(0).max(30).describe("Annual interest rate as a percentage (e.g., 6.5 for 6.5%)"),
  term_years: z.number().positive().max(50).describe("Loan term in years (e.g., 30)"),
  down_payment: z.number().min(0).optional().describe("Down payment amount in USD"),
  property_tax_rate: z.number().min(0).max(10).optional().describe("Annual property tax rate as percentage (e.g., 1.2 for 1.2%)"),
  annual_insurance: z.number().min(0).optional().describe("Annual homeowner's insurance in USD"),
});

function makeHandler(handler: (params: any) => { text: string; json: Record<string, unknown> }) {
  return async (params: any) => {
    try {
      const result = handler(params);
      return {
        content: [
          { type: "text" as const, text: result.text },
          { type: "text" as const, text: JSON.stringify(result.json) },
        ],
        structuredContent: result.json,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      const errorJson = { __loancalculator__: true, viewType: "error", data: { error: message } };
      return {
        content: [
          { type: "text" as const, text: `Error: ${message}` },
          { type: "text" as const, text: JSON.stringify(errorJson) },
        ],
        structuredContent: errorJson,
      };
    }
  };
}

// All loan tools are pure local computation — no external systems, no side effects.
const LOAN_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

const loanApp: McpAppModule = {
  name: "loan",
  title: "Loan Calculator",
  resourceUri: "ui://loancalculator/view.html",
  resourceDescription: "Interactive loan calculator with charts, sliders, and comparison mode",

  registerTools(server: McpServer, resourceUri: string) {
    registerAppTool(server, "calculate_loan", {
      title: "Calculate Loan",
      description: "Calculate monthly mortgage/loan payment with optional down payment, property tax, and insurance. Returns payment breakdown, total interest, and total cost.",
      annotations: LOAN_ANNOTATIONS,
      inputSchema: {
        principal: z.number().positive().describe("Home price or total loan principal in USD"),
        annual_rate: z.number().min(0).max(30).describe("Annual interest rate as a percentage (e.g., 6.5 for 6.5%)"),
        term_years: z.number().positive().max(50).describe("Loan term in years (e.g., 30)"),
        down_payment: z.number().min(0).optional().describe("Down payment amount in USD"),
        property_tax_rate: z.number().min(0).max(10).optional().describe("Annual property tax rate as percentage (e.g., 1.2)"),
        annual_insurance: z.number().min(0).optional().describe("Annual homeowner's insurance in USD"),
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleCalculateLoan));

    registerAppTool(server, "amortization_schedule", {
      title: "Amortization Schedule",
      description: "Generate a month-by-month amortization schedule showing principal, interest, and remaining balance for each payment.",
      annotations: LOAN_ANNOTATIONS,
      inputSchema: {
        principal: z.number().positive().describe("Home price or total loan principal in USD"),
        annual_rate: z.number().min(0).max(30).describe("Annual interest rate as a percentage (e.g., 6.5)"),
        term_years: z.number().positive().max(50).describe("Loan term in years (e.g., 30)"),
        down_payment: z.number().min(0).optional().describe("Down payment amount in USD"),
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleAmortizationSchedule));

    registerAppTool(server, "compare_loans", {
      title: "Compare Loans",
      description: "Compare 2-4 loan scenarios side by side, highlighting the best monthly payment, lowest total interest, and lowest total cost.",
      annotations: LOAN_ANNOTATIONS,
      inputSchema: {
        scenarios: z.array(LOAN_SCENARIO_SCHEMA).min(2).max(4).describe("2-4 loan scenarios to compare"),
      },
      _meta: { ui: { resourceUri } },
    }, makeHandler(handleCompareLoans));
  },

  registerStdioTools(server: McpServer) {
    server.registerTool("calculate_loan", {
      description: "Calculate monthly mortgage/loan payment with optional down payment, property tax, and insurance.",
      annotations: LOAN_ANNOTATIONS,
      inputSchema: {
        principal: z.number().positive().describe("Home price or total loan principal in USD"),
        annual_rate: z.number().min(0).max(30).describe("Annual interest rate as a percentage (e.g., 6.5)"),
        term_years: z.number().positive().max(50).describe("Loan term in years (e.g., 30)"),
        down_payment: z.number().min(0).optional().describe("Down payment amount in USD"),
        property_tax_rate: z.number().min(0).max(10).optional().describe("Annual property tax rate as percentage"),
        annual_insurance: z.number().min(0).optional().describe("Annual homeowner's insurance in USD"),
      },
    }, makeHandler(handleCalculateLoan));

    server.registerTool("amortization_schedule", {
      description: "Generate a month-by-month amortization schedule for a loan.",
      annotations: LOAN_ANNOTATIONS,
      inputSchema: {
        principal: z.number().positive().describe("Home price or total loan principal in USD"),
        annual_rate: z.number().min(0).max(30).describe("Annual interest rate as a percentage"),
        term_years: z.number().positive().max(50).describe("Loan term in years"),
        down_payment: z.number().min(0).optional().describe("Down payment amount in USD"),
      },
    }, makeHandler(handleAmortizationSchedule));

    server.registerTool("compare_loans", {
      description: "Compare 2-4 loan scenarios side by side, highlighting the best options.",
      annotations: LOAN_ANNOTATIONS,
      inputSchema: {
        scenarios: z.array(LOAN_SCENARIO_SCHEMA).min(2).max(4).describe("2-4 loan scenarios to compare"),
      },
    }, makeHandler(handleCompareLoans));
  },

  async callTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "calculate_loan": return handleCalculateLoan(args as any);
      case "amortization_schedule": return handleAmortizationSchedule(args as any);
      case "compare_loans": return handleCompareLoans(args as any);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  },
};

export default loanApp;
