import { describe, expect, test } from "bun:test";
import { createNodeContext } from "../src/adapter";

function collectRequestBody(req: any): Promise<Buffer[]> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(chunks));
  });
}

describe("Adapter — MockNodeRequest", () => {
  test("Deve extrair URL (pathname + search) e method corretamente", async () => {
    const bunReq = new Request("http://localhost:3000/foo?bar=1", {
      method: "POST",
    });

    const { req } = createNodeContext(bunReq);
    expect(req.url).toBe("/foo?bar=1");
    expect(req.method).toBe("POST");
  });

  test("Deve normalizar headers para lowercase", async () => {
    const bunReq = new Request("http://localhost:3000/", {
      headers: {
        "Content-Type": "application/json",
        "X-Custom-Header": "value",
      },
    });

    const { req } = createNodeContext(bunReq);
    expect(req.headers["content-type"]).toBe("application/json");
    expect(req.headers["x-custom-header"]).toBe("value");
  });

  test("Deve agrupar headers repetidos em array", async () => {
    const bunReq = new Request("http://localhost:3000/", {
      headers: {
        "Set-Cookie": "a=1",
      },
    });
    // O construtor Request do Web não permite headers duplicados diretamente,
    // então testamos via Headers append
    const headers = new Headers();
    headers.append("set-cookie", "a=1");
    headers.append("set-cookie", "b=2");

    const bunReq2 = new Request("http://localhost:3000/", { headers });
    const { req } = createNodeContext(bunReq2);

    expect(Array.isArray(req.headers["set-cookie"])).toBe(true);
    expect(req.headers["set-cookie"]).toContain("a=1");
    expect(req.headers["set-cookie"]).toContain("b=2");
  });

  test("Deve emitir apenas 'end' quando não há body", async () => {
    const bunReq = new Request("http://localhost:3000/", { method: "GET" });
    const { req } = createNodeContext(bunReq);

    const chunks = await collectRequestBody(req);
    expect(chunks.length).toBe(0);
  });

  test("Deve reemitir body de texto via eventos data/end", async () => {
    const bodyText = JSON.stringify({ hello: "world" });
    const bunReq = new Request("http://localhost:3000/", {
      method: "POST",
      body: bodyText,
    });

    const { req } = createNodeContext(bunReq);
    const chunks = await collectRequestBody(req);

    const fullBody = Buffer.concat(chunks).toString("utf-8");
    expect(fullBody).toBe(bodyText);
  });

  test("Deve reemitir body binário sem corrupção", async () => {
    const binary = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
    const bunReq = new Request("http://localhost:3000/", {
      method: "PUT",
      body: binary,
    });

    const { req } = createNodeContext(bunReq);
    const chunks = await collectRequestBody(req);

    const result = Buffer.concat(chunks);
    expect(result).toEqual(Buffer.from(binary));
  });
});

describe("Adapter — MockNodeResponse", () => {
  test("Deve capturar statusCode, headers e body", async () => {
    const bunReq = new Request("http://localhost:3000/");
    const { res, responsePromise } = createNodeContext(bunReq);

    res.statusCode = 201;
    res.setHeader("x-custom", "ok");
    res.write("hello ");
    res.end("world");

    const response = await responsePromise;
    expect(response.status).toBe(201);
    expect(response.headers.get("x-custom")).toBe("ok");
    expect(await response.text()).toBe("hello world");
  });

  test("Deve suportar writeHead com headers", async () => {
    const bunReq = new Request("http://localhost:3000/");
    const { res, responsePromise } = createNodeContext(bunReq);

    res.writeHead(302, { location: "/redirect" });
    res.end();

    const response = await responsePromise;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/redirect");
  });

  test("Deve acumular múltiplos writes", async () => {
    const bunReq = new Request("http://localhost:3000/");
    const { res, responsePromise } = createNodeContext(bunReq);

    res.write("chunk1");
    res.write(Buffer.from("chunk2"));
    res.write("chunk3");
    res.end();

    const response = await responsePromise;
    expect(await response.text()).toBe("chunk1chunk2chunk3");
  });

  test("Deve marcar writableEnded como true após end()", async () => {
    const bunReq = new Request("http://localhost:3000/");
    const { res } = createNodeContext(bunReq);

    expect(res.writableEnded).toBe(false);
    res.end();
    expect(res.writableEnded).toBe(true);
  });

  test("Deve resolver responsePromise mesmo sem body", async () => {
    const bunReq = new Request("http://localhost:3000/");
    const { res, responsePromise } = createNodeContext(bunReq);

    res.statusCode = 204;
    res.end();

    const response = await responsePromise;
    expect(response.status).toBe(204);
    const text = await response.text();
    expect(text).toBe("");
  });

  test("Deve preservar headers múltiplos em toResponse()", async () => {
    const bunReq = new Request("http://localhost:3000/");
    const { res, responsePromise } = createNodeContext(bunReq);

    res.setHeader("set-cookie", ["a=1", "b=2", "c=3"]);
    res.end("ok");

    const response = await responsePromise;
    const cookies = response.headers.getSetCookie();
    expect(cookies).toContain("a=1");
    expect(cookies).toContain("b=2");
    expect(cookies).toContain("c=3");
  });
});
