import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli";

describe("CLI Parser & Roteamento", () => {
  test("Deve iniciar dev server na porta padrão (3000) com cwd como root", async () => {
    const result = await runCli([]);

    expect(result.type).toBe("dev");
    expect(result.instance.port).toBe(3000);

    result.instance.stop();
  });

  test("Deve iniciar dev server em porta customizada via --port", async () => {
    const result = await runCli(["dev", "--port", "4020"]);

    expect(result.type).toBe("dev");
    expect(result.instance.port).toBe(4020);

    result.instance.stop();
  });

  test("Deve rotear 'build' como passthrough sem iniciar servidor", async () => {
    const result = await runCli(["build"]);

    expect(result.type).toBe("passthrough");
    expect(result.command).toBe("build");
  });

  test("Deve rotear 'preview' como passthrough", async () => {
    const result = await runCli(["preview"]);

    expect(result.type).toBe("passthrough");
    expect(result.command).toBe("preview");
  });

  test("Deve rotear 'optimize' como passthrough", async () => {
    const result = await runCli(["optimize"]);

    expect(result.type).toBe("passthrough");
    expect(result.command).toBe("optimize");
  });

  test("Deve compilar flags do Vite em viteOverrides", async () => {
    const result = await runCli([
      "dev",
      "--port",
      "4030",
      "--host",
      "0.0.0.0",
      "--cors",
      "--mode",
      "staging",
    ]);

    expect(result.type).toBe("dev");
    expect(result.instance.port).toBe(4030);

    const viteConfig = result.instance.vite.config;
    expect(viteConfig.server.host).toBe("0.0.0.0");
    expect(viteConfig.server.cors).toBe(true);
    expect(viteConfig.mode).toBe("staging");

    result.instance.stop();
  });
});
