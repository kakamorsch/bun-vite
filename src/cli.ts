/**
 * O Parser do Terminal
 * Lê as intenções do desenvolvedor via util.parseArgs e roteia
 * para o servidor híbrido (dev) ou para o Vite nativo (build/preview/optimize).
 */

import { parseArgs } from "node:util";
import path from "node:path";
import { startServer } from "./server.ts";

// Parse seguro dos argumentos da linha de comandos
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: { type: "string" },
    host: { type: "boolean" },
    cors: { type: "boolean" },
  },
  strict: false,
  allowPositionals: true,
});

const command = positionals[0] || "dev";
const rootArg = positionals[0] === "dev" ? positionals[1] : positionals[0];
const root = path.resolve(process.cwd(), rootArg || ".");

if (command === "dev" || command === "serve") {
  const port = values.port ? parseInt(values.port as string, 10) : 3000;

  const viteOverrides: Record<string, any> = { server: {} };
  if (values.host) viteOverrides.server.host = true;
  if (values.cors) viteOverrides.server.cors = true;

  await startServer(root, port, viteOverrides);
} else if (
  command === "build" ||
  command === "preview" ||
  command === "optimize"
) {
  // Comandos que não beneficiam do Bun.serve são delegados para o executável padrão
  console.log(`📦 A delegar comando '${command}' para o Vite nativo...`);
  Bun.spawn(["bunx", "vite", command, ...Bun.argv.slice(3)], {
    stdio: ["inherit", "inherit", "inherit"],
  });
}
