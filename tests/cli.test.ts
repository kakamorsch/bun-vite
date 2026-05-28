import { describe, expect, test } from "bun:test";
import { resolve } from "path";

const CLI_PATH = resolve(import.meta.dir, "../src/cli.ts");
const PLAYGROUND_PATH = resolve(import.meta.dir, "../playground");

describe("CLI Parser & Roteamento", () => {
  test("Deve iniciar dev server em porta customizada via --port", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH, "dev", PLAYGROUND_PATH, "--port", "4050"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Aguarda o servidor estar pronto (mensagem no stdout ou timeout)
    const stdout = await new Promise<string>((resolve) => {
      let buffer = "";
      const reader = proc.stdout.getReader();
      const timer = setTimeout(() => {
        reader.cancel();
        resolve(buffer);
      }, 2000);

      function pump() {
        reader.read().then(({ done, value }) => {
          if (done) {
            clearTimeout(timer);
            resolve(buffer);
            return;
          }
          buffer += new TextDecoder().decode(value);
          if (buffer.includes("a correr em")) {
            clearTimeout(timer);
            reader.cancel();
            resolve(buffer);
            return;
          }
          pump();
        });
      }
      pump();
    });

    expect(stdout).toInclude("4050");

    // Verifica que responde a requisições
    const response = await fetch("http://localhost:4050/");
    expect(response.status).toBe(200);

    proc.kill();
    await proc.exited;
  });

  test("Deve rotear 'build' como passthrough para o Vite nativo", async () => {
    // Executa num diretório vazio temporário para não interferir no playground
    const tmpDir = "/tmp/bvh-test-build-" + Date.now();
    await import("node:fs/promises").then((fs) =>
      fs.mkdir(tmpDir, { recursive: true })
    );
    await Bun.write(tmpDir + "/package.json", JSON.stringify({ name: "test" }));

    const proc = Bun.spawn(["bun", CLI_PATH, "build"], {
      cwd: tmpDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Promise<string>((resolve) => {
      let buffer = "";
      const reader = proc.stdout.getReader();
      const timer = setTimeout(() => {
        reader.cancel();
        resolve(buffer);
      }, 3000);

      function pump() {
        reader.read().then(({ done, value }) => {
          if (done) {
            clearTimeout(timer);
            resolve(buffer);
            return;
          }
          buffer += new TextDecoder().decode(value);
          if (buffer.includes("A delegar comando 'build'")) {
            clearTimeout(timer);
            reader.cancel();
            resolve(buffer);
            return;
          }
          pump();
        });
      }
      pump();
    });

    expect(stdout).toInclude("A delegar comando 'build'");

    proc.kill();
    await proc.exited;
  });
});
