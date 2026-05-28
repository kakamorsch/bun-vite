/**
 * O Motor
 * Instancia o Vite em middlewareMode e despacha requisições do Bun.serve
 * através do adapter.ts para a fila de middlewares do Vite.
 */

import { createServer, type ViteDevServer } from "vite";
import { createNodeContext } from "./adapter.ts";

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (isObject(source[key]) && isObject(output[key])) {
      output[key] = deepMerge(output[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export async function startServer(
  root: string,
  port = 3000,
  viteOverrides?: Record<string, any>
) {
  const baseConfig: Record<string, any> = {
    root,
    server: {
      middlewareMode: true,
      hmr: { port: port + 1 },
    },
  };

  const config = viteOverrides ? deepMerge(baseConfig, viteOverrides) : baseConfig;

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
