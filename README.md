# Bun-Vite Hybrid Adapter

Run **Vite** in `middlewareMode` on **Bun's native web runtime** — no `node:http` server required.

## What is this?

Vite's dev server relies on Connect middlewares that expect Node.js-style `IncomingMessage` / `ServerResponse`. Bun exposes the Web Standard `Request` / `Response`. This adapter bridges the two, letting you run Vite's full dev experience (HMR, Vue SFCs, CSS, proxy) on Bun's `Bun.serve()`.

## Features

- ⚡ **Bun-native** — uses `Bun.serve()` and Web Standard APIs
- 🔥 **HMR** — full Hot Module Replacement via Vite's WebSocket server
- 🎨 **Framework-agnostic** — Vue, React, Svelte, or vanilla; reads your `vite.config.ts`
- 🔄 **Proxy** — Vite's `server.proxy` configuration is fully supported
- 📦 **Zero Node HTTP fallback** — the adapter itself never touches `node:http`
- 🛠️ **CLI drop-in** — supports `dev`, `build`, `preview` and `optimize` commands

## Quick Start

```bash
# Install dependencies
bun install

# Start the dev server (defaults to process.cwd() on port 3000)
bun run src/cli.ts dev

# Or with a custom port
bun run src/cli.ts dev --port 4000
```

Then open `http://localhost:3000`.

## CLI Commands

| Command | Description |
|---|---|
| `dev` (default) | Starts the Bun-Vite hybrid dev server |
| `build` | Passthrough to Vite's native build CLI |
| `preview` | Passthrough to Vite's native preview CLI |
| `optimize` | Passthrough to Vite's native optimize CLI |

### CLI Flags

```bash
bun run src/cli.ts dev --port 4000 --host 0.0.0.0 --cors --mode staging
```

| Flag | Type | Description |
|---|---|---|
| `--port` | `number` | HTTP server port (default: `3000`) |
| `--host` | `string` | Host to bind (default: `localhost`) |
| `--cors` | `boolean` | Enable CORS |
| `--mode` | `string` | Vite mode (e.g. `development`, `staging`) |
| `--clearScreen` | `boolean` | Clear screen on restart |

## Running Tests

```bash
bun test
```

28 tests covering:
- Adapter unit tests (streams, headers, body parsing)
- Server integration (HTML serving, Vue transform, 404)
- HMR WebSocket (connection, file-change notifications)
- CSS pipeline (scoped styles, HMR for CSS)
- Proxy (GET/POST forwarding, header/body preservation, status propagation)
- CLI parser (argument parsing, command routing, passthrough)

## Project Structure

```
src/
  adapter.ts    # Bun Request ↔ Node req/res translator
  server.ts     # Bun.serve + Vite middleware bootstrap
  cli.ts        # CLI entry point with argument parsing
playground/
  vite.config.ts
  src/App.vue   # Demo Vue app for manual testing
tests/
  adapter.test.ts
  server.test.ts
  hmr.test.ts
  css.test.ts
  proxy.test.ts
  cli.test.ts
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
- `cli.ts` parses arguments with `util.parseArgs`, routes `dev` to our server and `build`/`preview`/`optimize` as passthrough to Vite's native CLI.

## License

MIT
