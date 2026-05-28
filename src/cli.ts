/**
 * CLI Interface
 * Drop-in replacement para o Vite que intercepta argumentos de linha
 * de comando e roteia para nosso servidor dev (dev) ou para o Vite
 * nativo (build, preview, optimize).
 */

import { parseArgs } from "node:util";
import { startServer } from "./server.ts";

const COMMANDS_PASSTHROUGH = new Set(["build", "preview", "optimize"]);

export async function runCli(rawArgs: string[]): Promise<{ type: "dev"; instance: any } | { type: "passthrough"; command: string }> {
  const { values, positionals } = parseArgs({
    args: rawArgs,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      cors: { type: "boolean" },
      clearScreen: { type: "boolean" },
      mode: { type: "string" },
    },
    allowPositionals: true,
  });

  const command = positionals[0] ?? "dev";

  // Passthrough transparente para comandos que não são dev
  if (COMMANDS_PASSTHROUGH.has(command)) {
    if (import.meta.main) {
      const proc = Bun.spawn(["bun", "vite", ...rawArgs], {
        stdio: ["inherit", "inherit", "inherit"],
      });
      const exitCode = await proc.exited;
      process.exit(exitCode);
    }
    return { type: "passthrough", command };
  }

  // Compila opções para o dev server
  const port = values.port ? parseInt(values.port, 10) : 3000;
  const root = process.cwd();

  const viteOverrides: Record<string, any> = {};

  if (values.host !== undefined) viteOverrides.server ??= {};
  if (values.host !== undefined) viteOverrides.server.host = values.host;
  if (values.cors !== undefined) viteOverrides.server ??= {};
  if (values.cors !== undefined) viteOverrides.server.cors = values.cors;
  if (values.mode !== undefined) viteOverrides.mode = values.mode;
  if (values.clearScreen !== undefined) viteOverrides.clearScreen = values.clearScreen;

  const instance = await startServer(root, port, viteOverrides);
  return { type: "dev", instance };
}

// Executa apenas quando chamado diretamente (não importado)
if (import.meta.main) {
  await runCli(process.argv.slice(2));
}
