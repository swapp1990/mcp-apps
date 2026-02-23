// Shared View bridge — initializes MCP ext-apps App, handles theming, envelope parsing
// Each app's View imports this and provides its own render function

import {
  App,
  applyHostStyleVariables,
  applyDocumentTheme,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

export type { McpUiHostContext };

export interface ViewBridgeConfig {
  /** App name for the MCP connection */
  name: string;
  version: string;
  /** Envelope key to detect this app's JSON (e.g. "__appdiscovery__") */
  envelopeKey: string;
  /** Called when a matching envelope is received */
  onEnvelope: (data: Record<string, unknown>) => void;
  /** Called with tool input arguments (optional) */
  onToolInput?: (args: Record<string, unknown>) => void;
  /** DOM element to render content into */
  contentEl: HTMLElement;
  /** Ready message shown after connection */
  readyMessage: string;
  /** Waiting message shown if connection fails */
  waitingMessage: string;
}

export interface ViewBridge {
  app: App;
  notifySize: () => void;
}

/** Escape HTML for safe rendering */
export function esc(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape for attribute values */
export function escAttr(str: string): string {
  return esc(str);
}

/** Initialize the View bridge — call this at the top level of each View's .ts file */
export async function initViewBridge(config: ViewBridgeConfig): Promise<ViewBridge> {
  const app = new App(
    { name: config.name, version: config.version },
    {},
    { autoResize: true }
  );

  function applyTheme(ctx: McpUiHostContext) {
    if (ctx.theme) applyDocumentTheme(ctx.theme);
    if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
    if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  }

  app.onhostcontextchanged = (ctx) => applyTheme(ctx);

  if (config.onToolInput) {
    app.ontoolinput = (params) => {
      config.onToolInput!(params.arguments || {});
    };
  }

  app.ontoolresult = (result) => {
    const content = result.content || [];

    for (const block of content) {
      if (block.type === "text" && "text" in block) {
        try {
          const parsed = JSON.parse(block.text as string);
          if (parsed && parsed[config.envelopeKey]) {
            config.onEnvelope(parsed);
            return;
          }
        } catch {
          // Not JSON — skip
        }
      }
    }

    // Fallback: show raw text
    for (const block of content) {
      if (block.type === "text" && "text" in block) {
        config.contentEl.innerHTML = `<div style="white-space:pre-wrap;font-size:13px;padding:12px;line-height:1.6">${esc(block.text as string)}</div>`;
        return;
      }
    }

    config.contentEl.innerHTML = '<div class="status"><p>Received result but no content</p></div>';
  };

  app.ontoolcancelled = () => {
    config.contentEl.innerHTML = '<div class="status"><p>Tool call was cancelled</p></div>';
  };

  function notifySize() {
    requestAnimationFrame(() => {
      app.sendSizeChanged({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      });
    });
  }

  try {
    await app.connect();
    const ctx = app.getHostContext();
    if (ctx) applyTheme(ctx);
    config.contentEl.innerHTML = `<div class="status"><p>${esc(config.readyMessage)}</p></div>`;
  } catch (err) {
    console.error(`${config.name} bridge connect failed:`, err);
    config.contentEl.innerHTML = `<div class="status"><p>${esc(config.waitingMessage)}</p></div>`;
  }

  return { app, notifySize };
}
