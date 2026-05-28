/**
 * O Motor
 * Instancia o Vite em middlewareMode e despacha requisições do Bun.serve
 * através do adapter.ts para a fila de middlewares do Vite.
 */

import { createServer, type ViteDevServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { createNodeContext } from "./adapter.ts";

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
    plugins: [vue()],
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
      const { req: nodeReq, res: nodeRes, responsePromise } =
        createNodeContext(req);

      vite.middlewares.handle(nodeReq, nodeRes, () => {
        // Nenhum middleware tratou a requisição
        if (!nodeRes.writableEnded) {
          nodeRes.statusCode = 404;
          nodeRes.end("Not Found");
        }
      });

      return responsePromise;
    },
  });

  console.log(`🚀 Bun-Vite Hybrid rodando em http://localhost:${server.port}`);

  return {
    stop: () => server.stop(),
    port: server.port,
    vite,
  };
}
