import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { startServer } from "../src/server";
import { resolve } from "path";

const playgroundPath = resolve(import.meta.dir, "../playground");

describe("Bun-Vite Hybrid Server — HMR", () => {
  let serverInstance: any;

  beforeAll(async () => {
    serverInstance = await startServer(playgroundPath, 3010);
    await Bun.sleep(500);
  });

  afterAll(() => {
    serverInstance?.stop();
  });

  test("Deve conectar ao WebSocket HMR e receber 'connected'", async () => {
    const hmrPort = 3011;
    const ws = new WebSocket(`ws://localhost:${hmrPort}/`, ["vite-hmr"]);

    const message = await new Promise<string>((resolve, reject) => {
      ws.onopen = () => {};
      ws.onmessage = (e) => resolve(String(e.data));
      ws.onerror = (e) => reject(e);
      setTimeout(() => reject(new Error("WS timeout")), 3000);
    });

    ws.close();
    expect(message).toInclude('"type":"connected"');
  });

  test("Deve notificar mudança de arquivo via WebSocket HMR", async () => {
    const hmrPort = 3011;
    const ws = new WebSocket(`ws://localhost:${hmrPort}/`, ["vite-hmr"]);

    // Aguarda conexão
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
      setTimeout(() => reject(new Error("WS timeout")), 3000);
    });

    // Coleta mensagens
    const messages: string[] = [];
    ws.onmessage = (e) => messages.push(String(e.data));

    // Modifica um arquivo existente para disparar o watcher
    const appVuePath = resolve(playgroundPath, "src/App.vue");
    const originalContent = await Bun.file(appVuePath).text();
    const modifiedContent = originalContent.replace(
      "Bun-Vite Hybrid",
      "Bun-Vite Hybrid HMR-TEST"
    );
    await Bun.write(appVuePath, modifiedContent);

    // Aguarda notificação
    let found = false;
    for (let i = 0; i < 30; i++) {
      if (messages.some((m) => m.includes("update") || m.includes("file-changed"))) {
        found = true;
        break;
      }
      await Bun.sleep(100);
    }

    // Restaura
    await Bun.write(appVuePath, originalContent);
    ws.close();

    expect(found).toBe(true);
  });
});
