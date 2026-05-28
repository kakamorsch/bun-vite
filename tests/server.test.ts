import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { startServer } from "../src/server";
import { resolve } from "path";

const playgroundPath = resolve(import.meta.dir, "../playground");

describe("Bun-Vite Hybrid Server — Modo SPA", () => {
  let serverInstance: any;

  beforeAll(async () => {
    serverInstance = await startServer(playgroundPath, 0, {
      server: { ws: false },
    });
    await Bun.sleep(100);
  });

  afterAll(() => {
    serverInstance?.stop();
  });

  test("Deve servir o index.html com o cliente do Vite injetado", async () => {
    const response = await fetch(`http://localhost:${serverInstance.port}/`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toInclude("text/html");
    expect(text).toInclude("/@vite/client");
  });

  test("Deve transformar um componente Vue em JavaScript nativo", async () => {
    const response = await fetch(
      `http://localhost:${serverInstance.port}/src/App.vue`
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/javascript/);
    expect(text).toInclude("createElementBlock");
  });
});

describe("Bun-Vite Hybrid Server — Modo Custom (404)", () => {
  let serverInstance: any;

  beforeAll(async () => {
    serverInstance = await startServer(playgroundPath, 0, {
      appType: "custom",
      server: { ws: false },
    });
    await Bun.sleep(100);
  });

  afterAll(() => {
    serverInstance?.stop();
  });

  test("Deve retornar 404 para rotas inexistentes", async () => {
    const response = await fetch(
      `http://localhost:${serverInstance.port}/rota-fantasma.js`
    );
    expect(response.status).toBe(404);
  });
});
