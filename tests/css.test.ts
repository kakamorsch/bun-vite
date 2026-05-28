import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { startServer } from "../src/server";
import { resolve } from "path";

const playgroundPath = resolve(import.meta.dir, "../playground");

describe("Bun-Vite Hybrid Server — Pipeline CSS", () => {
  let serverInstance: any;

  beforeAll(async () => {
    serverInstance = await startServer(playgroundPath, 3012);
    await Bun.sleep(500);
  });

  afterAll(() => {
    serverInstance?.stop();
  });

  test("Deve servir CSS de componente Vue como módulo JS com HMR", async () => {
    const response = await fetch(
      `http://localhost:3012/src/App.vue?vue&type=style&index=0&scoped=7a7a37b1&lang.css`
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/javascript/);

    // O Vite envolve o CSS em uma chamada __vite__updateStyle
    expect(text).toInclude("__vite__updateStyle");

    // Os seletores devem conter o atributo de scope do Vue
    expect(text).toInclude("[data-v-7a7a37b1]");

    // Deve incluir o CSS real do componente
    expect(text).toInclude(".container");
    expect(text).toInclude("cursor: pointer");
  });

  test("Deve injetar CSS via client do Vite", async () => {
    const response = await fetch(
      `http://localhost:3012/src/App.vue?vue&type=style&index=0&scoped=7a7a37b1&lang.css`
    );
    const text = await response.text();

    // O módulo JS deve importar o cliente do Vite para usar updateStyle
    expect(text).toInclude("/@vite/client");

    // Deve ter HMR ativo para o CSS
    expect(text).toInclude("import.meta.hot.accept()");
    expect(text).toInclude("__vite__removeStyle");
  });
});
