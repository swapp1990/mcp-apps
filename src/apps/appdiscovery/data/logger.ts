import { appendFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { QueryLog } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getLogPath(): string {
  if (process.env.LOG_PATH) {
    return resolve(process.env.LOG_PATH);
  }
  const logDir = resolve(__dirname, "../../../logs");
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  return resolve(logDir, "queries.jsonl");
}

export function logQuery(
  tool: string,
  params: Record<string, unknown>,
  resultsCount: number,
  appsReturned: string[]
): void {
  const entry: QueryLog = {
    timestamp: new Date().toISOString(),
    tool,
    params,
    resultsCount,
    appsReturned,
  };

  try {
    appendFileSync(getLogPath(), JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    console.error("Failed to write query log:", err);
  }
}
