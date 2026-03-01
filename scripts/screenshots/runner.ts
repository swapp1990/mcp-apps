#!/usr/bin/env npx tsx
/**
 * MCP App Screenshot Generator
 *
 * Captures retina screenshots of MCP ext-apps views by simulating
 * the host postMessage handshake and injecting fixture data.
 *
 * Usage:
 *   npx tsx scripts/screenshots/runner.ts
 *   npx tsx scripts/screenshots/runner.ts --app=regex
 *   npx tsx scripts/screenshots/runner.ts --app=regex --mode=test --theme=light
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import type { AppScreenshotConfig, ScreenshotFixture } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(ROOT, "dist", "views");
const FIXTURES_DIR = path.join(ROOT, "screenshots", "fixtures");
const OUTPUT_DIR = path.join(ROOT, "screenshots", "output");

const VIEWPORT_WIDTH = 353;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 800;
const DEVICE_SCALE = 2;

// --- CLI arg parsing ---

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--(\w+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

// --- Discover fixture configs ---

async function loadConfigs(appFilter?: string): Promise<AppScreenshotConfig[]> {
  const entries = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".ts"));
  const configs: AppScreenshotConfig[] = [];

  for (const entry of entries) {
    const mod = await import(path.join(FIXTURES_DIR, entry));
    const config: AppScreenshotConfig = mod.default;
    if (!appFilter || config.app === appFilter) {
      configs.push(config);
    }
  }

  return configs;
}

// --- Host harness injected via addInitScript ---

function hostHarness(args: { theme: string; envelope: Record<string, unknown> }) {
  const { theme, envelope } = args;

  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return;

    // Step 1: Respond to ui/initialize request
    if (msg.method === "ui/initialize" && msg.id != null) {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2026-01-26",
          hostInfo: { name: "ScreenshotHarness", version: "1.0.0" },
          hostCapabilities: {},
          hostContext: { theme },
        },
      };
      window.postMessage(response, "*");
      return;
    }

    // Step 2: On ui/notifications/initialized, send tool result
    if (msg.method === "ui/notifications/initialized") {
      // Small delay to let the view finish setting up handlers
      setTimeout(() => {
        const toolResult = {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: {
            content: [
              { type: "text", text: JSON.stringify(envelope) },
            ],
          },
        };
        window.postMessage(toolResult, "*");

        // Give the view time to render, then signal ready
        setTimeout(() => {
          (window as any).__SCREENSHOT_READY__ = true;
        }, 300);
      }, 100);
      return;
    }
  });
}

// --- Main ---

async function main() {
  const args = parseArgs();
  const appFilter = args.app;
  const modeFilter = args.mode;
  const themeFilter = args.theme as "light" | "dark" | undefined;

  const configs = await loadConfigs(appFilter);
  if (configs.length === 0) {
    console.error(`No fixture configs found${appFilter ? ` for app "${appFilter}"` : ""}`);
    process.exit(1);
  }

  // Verify dist/views exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`dist/views/ not found. Run "npm run build:views" first.`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const results: { file: string; width: number; height: number }[] = [];
  const errors: string[] = [];

  for (const config of configs) {
    const htmlPath = path.join(DIST_DIR, `${config.app}.html`);
    if (!fs.existsSync(htmlPath)) {
      errors.push(`View not found: ${htmlPath}`);
      continue;
    }

    const themes = themeFilter
      ? [themeFilter]
      : config.themes || (["light", "dark"] as const);

    const fixtures = modeFilter
      ? config.fixtures.filter((f) => f.name === modeFilter)
      : config.fixtures;

    if (fixtures.length === 0) {
      errors.push(`No fixture named "${modeFilter}" for app "${config.app}"`);
      continue;
    }

    const outputDir = path.join(OUTPUT_DIR, config.app);
    fs.mkdirSync(outputDir, { recursive: true });

    for (const fixture of fixtures) {
      for (const theme of themes) {
        const label = `${config.app}/${fixture.name}-${theme}`;
        process.stdout.write(`  Capturing ${label}...`);

        try {
          const result = await captureScreenshot(
            browser,
            htmlPath,
            fixture,
            theme,
            outputDir,
          );
          results.push(result);
          console.log(` ${result.width}x${result.height}px`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${label}: ${msg}`);
          console.log(` FAILED`);
        }
      }
    }
  }

  await browser.close();

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`Screenshots: ${results.length} captured`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    for (const e of errors) console.log(`  - ${e}`);
  }
  for (const r of results) {
    console.log(`  ${r.file} (${r.width}x${r.height})`);
  }

  if (errors.length > 0) process.exit(1);
}

async function captureScreenshot(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  htmlPath: string,
  fixture: ScreenshotFixture,
  theme: "light" | "dark",
  outputDir: string,
): Promise<{ file: string; width: number; height: number }> {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: MAX_HEIGHT },
    deviceScaleFactor: DEVICE_SCALE,
    colorScheme: theme,
  });

  const page = await context.newPage();

  // Inject harness BEFORE navigation so it runs before the view's module script
  await page.addInitScript(hostHarness, {
    theme,
    envelope: fixture.envelope,
  });

  // Navigate to the built single-file HTML
  await page.goto(`file://${htmlPath}`, { waitUntil: "domcontentloaded" });

  // Wait for the harness to signal ready
  await page.waitForFunction(() => (window as any).__SCREENSHOT_READY__ === true, null, {
    timeout: 10000,
  });

  // Wait for the content-specific selector
  await page.waitForSelector(fixture.readySelector, { timeout: 5000 });

  // Extra settle time for any animations/transitions
  await page.waitForTimeout(200);

  // Measure actual content height using the container element
  // scrollHeight on <html> returns viewport height when content is shorter,
  // so we measure the content container's bottom edge instead.
  const contentHeight = await page.evaluate(() => {
    const content = document.getElementById("content") || document.getElementById("container");
    if (content) {
      const rect = content.getBoundingClientRect();
      // Add some padding below the content
      return Math.ceil(rect.bottom + 16);
    }
    return document.documentElement.scrollHeight;
  });
  const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, contentHeight));

  // Resize viewport to fit content
  await page.setViewportSize({ width: VIEWPORT_WIDTH, height: clampedHeight });
  await page.waitForTimeout(100);

  // Capture screenshot
  const filename = `${fixture.name}-${theme}.png`;
  const filepath = path.join(outputDir, filename);

  await page.screenshot({ path: filepath, type: "png" });

  await context.close();

  // Verify file was created and read dimensions
  const stat = fs.statSync(filepath);
  const actualWidth = VIEWPORT_WIDTH * DEVICE_SCALE;
  const actualHeight = clampedHeight * DEVICE_SCALE;

  return {
    file: path.relative(ROOT, filepath),
    width: actualWidth,
    height: actualHeight,
  };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
