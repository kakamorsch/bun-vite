/**
 * O Motor Agnóstico
 * Instancia o Vite em middlewareMode e despacha requisições do Bun.serve
 * através do adapter.ts para a fila de middlewares do Vite.
 * Não injeta plugins — delega essa responsabilidade ao vite.config.ts do utilizador.
 */

import { createServer, type ViteDevServer } from "vite";
import { createNodeContext } from "./adapter.ts";

export async function startServer(
  root: string,
  port = 3000,
  viteOverrides?: Record<string, any>
) {
  // Configuração base foca estritamente no runtime, deixando
  // os plugins e opções de build para o vite.config.ts do utilizador
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
