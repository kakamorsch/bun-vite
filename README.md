# Bun-Vite Hybrid Adapter

Run **Vite** in `middlewareMode` on **Bun's native web runtime** — no `node:http` server required.

## What is this?

Vite's dev server relies on Connect middlewares that expect Node.js-style `IncomingMessage` / `ServerResponse`. Bun exposes the Web Standard `Request` / `Response`. This adapter bridges the two, letting you run Vite's full dev experience (HMR, Vue SFCs, CSS, proxy) on Bun's `Bun.serve()`.

## Features

- ⚡ **Bun-native** — uses `Bun.serve()` and Web Standard APIs
- 🔥 **HMR** — full Hot Module Replacement via Vite's WebSocket server
- 🎨 **Vue SFCs** — `<script setup>`, `<style scoped>`, and CSS modules work out of the box
- 🔄 **Proxy** — Vite's `server.proxy` configuration is fully supported
- 📦 **Zero Node HTTP fallback** — the adapter itself never touches `node:http`

## Quick Start

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

Then open `http://localhost:3000`.

## Running Tests

```bash
bun test
```

22 tests covering:
- Adapter unit tests (streams, headers, body parsing)
- Server integration (HTML serving, Vue transform, 404)
- HMR WebSocket (connection, file-change notifications)
- CSS pipeline (scoped styles, HMR for CSS)
- Proxy (GET/POST forwarding, header/body preservation, status propagation)

## Project Structure

```
src/
  adapter.ts    # Bun Request ↔ Node req/res translator
  server.ts     # Bun.serve + Vite middleware bootstrap
  cli.ts        # Dev server entry point
playground/
  src/App.vue   # Demo Vue app for manual testing
tests/
  adapter.test.ts
  server.test.ts
  hmr.test.ts
  css.test.ts
  proxy.test.ts
```

## How it works

```
Browser ──► Bun.serve() ──► adapter.ts ──► Vite middlewares (Connect)
                                     └──► Vite WS server (HMR)
```

- `adapter.ts` creates lightweight mocks that implement the surface area Vite/Connect needs:
  - `MockNodeRequest` — wraps the Web `Request` body using `Readable.fromWeb()` for zero-copy streaming
  - `MockNodeResponse` — extends Node's `Writable` to capture status, headers, and body chunks
- `server.ts` boots Vite in `middlewareMode: true`, configures the HMR WebSocket on a derived port (`httpPort + 1`), and wires Bun's `fetch` handler into Vite's middleware stack.

## License

MIT
