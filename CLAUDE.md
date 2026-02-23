# MCP Apps

Monorepo for MCP servers with ext-apps Views (AppDiscovery + Regex Playground). Deployed on EC2 as `mcp-apps.service` on port 8006.

## Build & Deploy

- Vite requires Node 20+: `nvm use 20.20.0`
- Views bundle via Vite + vite-plugin-singlefile into `dist/views/`
- `view.ts` files are inlined INTO the HTML — changes to `view-bridge.ts` don't affect views unless they import it
- Deploy: `tar czf` → `scp` → `tar xzf` → `systemctl restart mcp-apps`

## ChatGPT Compatibility

- **View HTML caching**: ChatGPT aggressively caches View HTML. Disconnect/reconnect does NOT refresh it. User must **remove the app and re-add it** to pick up HTML changes.
- **Theming**: ChatGPT sends `ctx.theme` and `window.openai.theme` but NOT `styles.variables`. Dark mode CSS must use `[data-theme="dark"]` selectors. `@media (prefers-color-scheme: dark)` only checks OS, not ChatGPT's app setting.
- **Tool responses**: Put JSON in both `structuredContent` (for ChatGPT) AND `content[1]` (for Claude View). Claude View reads `content` blocks; ChatGPT reads `structuredContent`.

## Gotchas

- Never consume `req` body with `on('data')` in server middleware — it steals data from the MCP StreamableHTTPServerTransport.
