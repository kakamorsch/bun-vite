/**
 * Benchmark Comparativo
 * Bun-Vite Hybrid vs Vite nativo (Node.js)
 */

import autocannon from "autocannon";
import { resolve } from "path";

const PLAYGROUND = resolve(import.meta.dir, "../playground");
const HYBRID_PORT = 5001;
const NODE_PORT = 5002;

interface ServerResult {
  name: string;
  coldStartMs: number;
  rpsRoot: number;
  latencyAvg: number;
  latencyP99: number;
}

function killPort(port: number): void {
  try {
    const out = new TextDecoder()
      .decode(Bun.spawnSync(["sh", "-c", `lsof -t -i:${port} 2>/dev/null || echo ""`]).stdout)
      .trim();
    if (!out) return;
    for (const pid of out.split("\n")) {
      try { process.kill(parseInt(pid, 10), 9); } catch {}
    }
  } catch {}
}

async function spawnServer(
  cmd: string[],
  _port: number,
  readyPattern: RegExp
): Promise<{ proc: any; coldStartMs: number }> {
  const start = performance.now();
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    cwd: resolve(import.meta.dir, ".."),
  });

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const timeout = setTimeout(() => {
    proc.kill();
  }, 30000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (readyPattern.test(buffer)) {
        clearTimeout(timeout);
        return { proc, coldStartMs: performance.now() - start };
      }
    }
  } finally {
    reader.releaseLock();
  }

  clearTimeout(timeout);
  throw new Error("Servidor terminou antes de estar pronto");
}

async function runLoadTest(port: number): Promise<{
  rps: number;
  latencyAvg: number;
  latencyP99: number;
}> {
  const result = await autocannon({
    url: `http://localhost:${port}/`,
    connections: 100,
    duration: 5,
    pipelining: 1,
  });

  return {
    rps: result.requests.average,
    latencyAvg: result.latency.average,
    latencyP99: result.latency.p99,
  };
}

function nodeVersionOk(): boolean {
  try {
    const v = process.version.slice(1).split(".").map(Number);
    return v[0] >= 20;
  } catch {
    return false;
  }
}

async function runBenchmark(): Promise<void> {
  console.log("🔥 A iniciar benchmark comparativo...\n");

  killPort(HYBRID_PORT);
  killPort(NODE_PORT);
  await Bun.sleep(500);

  // 1. Cold Start — Bun-Vite Hybrid
  console.log(`⚡ A arrancar Bun-Vite Hybrid na porta ${HYBRID_PORT}...`);
  let hybrid: { proc: any; coldStartMs: number };
  try {
    hybrid = await spawnServer(
      ["bun", resolve(import.meta.dir, "../src/cli.ts"), "dev", PLAYGROUND, "--port", String(HYBRID_PORT)],
      HYBRID_PORT,
      /a correr em/
    );
  } catch (err: any) {
    console.error("   ❌ Falha no Bun-Vite Hybrid:", err.message);
    process.exit(1);
  }
  console.log(`   ✅ Arranque em ${hybrid.coldStartMs.toFixed(0)}ms\n`);

  await Bun.sleep(500);

  // 2. Load Test — Bun-Vite Hybrid
  console.log("🚀 A executar carga no Bun-Vite Hybrid (5s, 100 conexões)...");
  const hybridLoad = await runLoadTest(HYBRID_PORT);
  console.log(`   ✅ ${hybridLoad.rps.toFixed(0)} req/sec\n`);

  // 3. Vite Node — só se Node.js >= 20
  let node: { proc: any; coldStartMs: number } | null = null;
  let nodeLoad: { rps: number; latencyAvg: number; latencyP99: number } | null = null;

  if (nodeVersionOk()) {
    console.log(`⚡ A arrancar Vite (Node) na porta ${NODE_PORT}...`);
    try {
      node = await spawnServer(
        ["npx", "vite", "dev", PLAYGROUND, "--port", String(NODE_PORT)],
        NODE_PORT,
        /ready in/
      );
      console.log(`   ✅ Arranque em ${node.coldStartMs.toFixed(0)}ms\n`);

      await Bun.sleep(500);

      console.log("🚀 A executar carga no Vite (Node) (5s, 100 conexões)...");
      nodeLoad = await runLoadTest(NODE_PORT);
      console.log(`   ✅ ${nodeLoad.rps.toFixed(0)} req/sec\n`);
    } catch (err: any) {
      console.error("   ⚠️ Falha no Vite (Node):", err.message);
    }
  } else {
    console.log("⚡ Vite (Node) ignorado — Node.js >= 20 necessário\n");
  }

  // 4. Cleanup
  hybrid.proc.kill();
  if (node) node.proc.kill();
  await Promise.all([hybrid.proc.exited, node?.proc.exited].filter(Boolean));

  // 5. Resultados
  const hybridResult: ServerResult = {
    name: "Bun-Vite Hybrid",
    coldStartMs: hybrid.coldStartMs,
    rpsRoot: hybridLoad.rps,
    rpsAsset: 0,
    latencyAvg: hybridLoad.latencyAvg,
    latencyP99: hybridLoad.latencyP99,
  };

  if (node && nodeLoad) {
    const nodeResult: ServerResult = {
      name: "Vite (Node)",
      coldStartMs: node.coldStartMs,
      rpsRoot: nodeLoad.rps,
      rpsAsset: 0,
      latencyAvg: nodeLoad.latencyAvg,
      latencyP99: nodeLoad.latencyP99,
    };
    printResults(hybridResult, nodeResult);
  } else {
    printSingleResult(hybridResult);
  }
}

function printResults(h: ServerResult, n: ServerResult): void {
  const deltaCold = ((h.coldStartMs - n.coldStartMs) / n.coldStartMs * 100);
  const deltaRps = ((h.rpsRoot - n.rpsRoot) / n.rpsRoot * 100);
  const deltaLat = ((n.latencyAvg - h.latencyAvg) / n.latencyAvg * 100);

  console.log("## Resultados do Benchmark\n");
  console.log("| Métrica | Bun-Vite Hybrid | Vite (Node) | Delta |");
  console.log("|---|---|---|---|");
  console.log(`| Cold Start (ms) | ${h.coldStartMs.toFixed(0)} | ${n.coldStartMs.toFixed(0)} | ${deltaCold > 0 ? "+" : ""}${deltaCold.toFixed(0)}% |`);
  console.log(`| Req/Sec (/) | ${h.rpsRoot.toFixed(0)} | ${n.rpsRoot.toFixed(0)} | ${deltaRps > 0 ? "+" : ""}${deltaRps.toFixed(0)}% |`);
  console.log(`| Latência Avg (ms) | ${h.latencyAvg.toFixed(2)} | ${n.latencyAvg.toFixed(2)} | ${deltaLat > 0 ? "+" : ""}${deltaLat.toFixed(0)}% |`);
  console.log(`| Latência P99 (ms) | ${h.latencyP99.toFixed(2)} | ${n.latencyP99.toFixed(2)} | — |`);
  console.log("");
}

function printSingleResult(h: ServerResult): void {
  console.log("## Resultados do Benchmark (Bun-Vite Hybrid apenas)\n");
  console.log("| Métrica | Bun-Vite Hybrid |");
  console.log("|---|---|");
  console.log(`| Cold Start (ms) | ${h.coldStartMs.toFixed(0)} |`);
  console.log(`| Req/Sec (/) | ${h.rpsRoot.toFixed(0)} |`);
  console.log(`| Latência Avg (ms) | ${h.latencyAvg.toFixed(2)} |`);
  console.log(`| Latência P99 (ms) | ${h.latencyP99.toFixed(2)} |`);
  console.log("");
}

if (import.meta.main) {
  await runBenchmark();
}
