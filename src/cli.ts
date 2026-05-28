/**
 * A Interface do Dev
 * Ponto de entrada executável. Lê a pasta playground/ e inicia o servidor.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../playground");

await startServer(root, 3000);
