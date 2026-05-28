import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { startServer } from "../src/server";
import { resolve } from "path";

const playgroundPath = resolve(import.meta.dir, "../playground");

describe("Bun-Vite Hybrid Server — Proxy", () => {
  let serverInstance: any;
  let backend: any;

  beforeAll(async () => {
    // Backend mock que responde a /hello
    backend = Bun.serve({
      port: 3020,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/hello") {
          const body = req.method === "POST" ? await req.text() : null;
          return new Response(
            JSON.stringify({
              source: "backend",
              path: url.pathname,
              method: req.method,
              headers: Object.fromEntries(req.headers.entries()),
              body,
            }),
            { headers: { "content-type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    // Vite com proxy configurado
    serverInstance = await startServer(playgroundPath, 3014, {
      server: {
        proxy: {
          "/api": {
            target: `http://localhost:${backend.port}`,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api/, ""),
          },
        },
      },
    });
    await Bun.sleep(500);
  });

  afterAll(() => {
    serverInstance?.stop();
    backend?.stop();
  });

  test("Deve proxyar requisições /api para o backend", async () => {
    const response = await fetch(`http://localhost:3014/api/hello`);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.source).toBe("backend");
    expect(json.path).toBe("/hello");
  });

  test("Deve preservar headers e body em requisições POST proxyadas", async () => {
    const response = await fetch(`http://localhost:3014/api/hello`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-custom": "ok" },
      body: JSON.stringify({ foo: "bar" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.source).toBe("backend");
    expect(json.method).toBe("POST");
    expect(json.body).toBe(JSON.stringify({ foo: "bar" }));
    expect(json.headers["x-custom"]).toBe("ok");
  });

  test("Deve propagar status 404 do backend", async () => {
    const response = await fetch(`http://localhost:3014/api/inexistente`);
    expect(response.status).toBe(404);
  });
});
