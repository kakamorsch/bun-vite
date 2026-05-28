/**
 * O Motor Agnóstico — Smart Router
 * Instancia o Vite em middlewareMode e despacha requisições do Bun.serve
 * através da via mais rápida possível:
 *   1. Assets estáticos  → Bun.file() (zero-copy, sendfile)
 *   2. Código-fonte      → vite.transformRequest() (bypass Connect)
 *   3. Fallback          → adapter.ts + vite.middlewares.handle()
 */

import { createServer, type ViteDevServer } from "vite";
import { createNodeContext } from "./adapter.ts";
import { resolve, extname } from "node:path";

// --- Via 1: Assets Estáticos ---
const STATIC_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp4", ".webm", ".mp3", ".ogg", ".wav",
  ".pdf", ".zip", ".tar", ".gz",
]);

const VITE_DEPS_MARKER = "/.vite/deps/";

function isStaticPath(pathname: string): boolean {
  if (pathname.includes("?")) return false;
  const ext = extname(pathname);
  return STATIC_EXT.has(ext) || pathname.includes(VITE_DEPS_MARKER);
}

function mapToFilePath(pathname: string, root: string): string {
  if (pathname.startsWith("/@fs/")) return pathname.slice(5);
  return resolve(root, pathname.slice(1));
}

// --- Via 2: Transformação Direta ---
const TRANSFORM_EXT = new Set([
  ".vue", ".ts", ".tsx", ".jsx", ".js", ".mjs",
  ".css", ".scss", ".sass", ".less", ".styl", ".stylus",
  ".json",
]);

function isTransformable(pathname: string): boolean {
  const ext = extname(pathname);
  return TRANSFORM_EXT.has(ext);
}

function contentTypeFor(pathname: string): string {
  const ext = extname(pathname);
  switch (ext) {
    case ".css":
    case ".scss":
    case ".sass":
    case ".less":
    case ".styl":
    case ".stylus":
      return "text/css";
    case ".json":
      return "application/json";
    default:
      return "application/javascript";
  }
}

export async function startServer(
  root: string,
  port = 3000,
  viteOverrides?: Record<string, any>
) {
  const config: Record<string, any> = {
    root,
    server: {
      middlewareMode: true,
      hmr: { port: port + 1 },
    },
  };

  if (viteOverrides) {
    if (viteOverrides.server) {
      config.server = { ...config.server, ...viteOverrides.server };
      if (viteOverrides.server.hmr) {
        config.server.hmr = { ...config.server.hmr, ...viteOverrides.server.hmr };
      }
    }
    for (const key of Object.keys(viteOverrides)) {
      if (key !== "server") {
        config[key] = viteOverrides[key];
      }
    }
  }

  const vite: ViteDevServer = await createServer(config);

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // === Via 1: Assets estáticos (zero-copy) ===
      if (isStaticPath(pathname)) {
        const filePath = mapToFilePath(pathname, root);
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file);
        }
      }

      // === Via 2: Transformação direta (bypass Connect) ===
      if (isTransformable(pathname)) {
        try {
          const result = await vite.transformRequest(pathname + url.search);
          if (result) {
            const headers: Record<string, string> = {
              "content-type": contentTypeFor(pathname),
            };
            if (result.etag) headers["etag"] = result.etag;
            return new Response(result.code, { headers });
          }
        } catch {
          // Arquivo não encontrado ou não transformável — cair no fallback
        }
      }

      // === Via 3: Fallback (HTML, proxy, rotas dinâmicas) ===
      const { req: nodeReq, res: nodeRes, responsePromise } =
        createNodeContext(req);

      vite.middlewares.handle(nodeReq, nodeRes, () => {
        if (!nodeRes.writableEnded) {
          nodeRes.statusCode = 404;
          nodeRes.end("Not Found");
        }
      });

      return responsePromise;
    },
  });

  console.log(`🚀 Bun-Vite Hybrid a correr em http://localhost:${server.port}`);

  return {
    stop: () => server.stop(),
    port: server.port,
    vite,
  };
}
