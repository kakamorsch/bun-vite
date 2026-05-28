/**
 * Tradutor de Request/Response do padrão Web (Bun) para o estilo Node.js
 * que os middlewares do Connect (Vite) esperam consumir.
 */

import { Readable, Writable } from "node:stream";

class MockNodeRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[]>;
  private _readable: Readable;

  constructor(bunReq: Request) {
    const parsed = new URL(bunReq.url);
    this.url = parsed.pathname + parsed.search;
    this.method = bunReq.method;
    this.headers = {};

    bunReq.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      const existing = this.headers[k];
      if (Array.isArray(existing)) {
        this.headers[k] = [...existing, value];
      } else if (existing !== undefined) {
        this.headers[k] = [existing, value];
      } else {
        this.headers[k] = value;
      }
    });

    this._readable = bunReq.body
      ? Readable.fromWeb(bunReq.body as any)
      : Readable.from([]);
  }

  on(event: string, listener: (...args: any[]) => void) {
    this._readable.on(event, listener);
    return this;
  }

  pipe(destination: any, options?: any) {
    return this._readable.pipe(destination, options);
  }
}

class MockNodeResponse extends Writable {
  statusCode = 200;
  private headers: Record<string, string | string[]> = {};
  private chunks: Buffer[] = [];
  writableEnded = false;

  constructor() {
    super();
  }

  _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  setHeader(name: string, value: string | string[]) {
    this.headers[name.toLowerCase()] = value;
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  writeHead(statusCode: number, headers?: Record<string, string>) {
    this.statusCode = statusCode;
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => this.setHeader(k, v));
    }
  }

  end(chunk?: any, encoding?: any, callback?: any) {
    if (chunk !== undefined && chunk !== null) {
      this.write(chunk, encoding);
    }
    this.writableEnded = true;
    super.end(callback);
  }

  toResponse(): Response {
    const headers = new Headers();
    Object.entries(this.headers).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((val) => headers.append(k, val));
      } else {
        headers.set(k, v);
      }
    });

    const body = this.chunks.length > 0 ? Buffer.concat(this.chunks) : null;
    return new Response(body, { status: this.statusCode, headers });
  }
}

export function createNodeContext(bunReq: Request) {
  const req = new MockNodeRequest(bunReq) as any;
  const res = new MockNodeResponse() as any;

  let resolved = false;
  let resolveResponse: (value: Response) => void;
  const responsePromise = new Promise<Response>((resolve) => {
    resolveResponse = (value: Response) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };
  });

  const originalEnd = res.end.bind(res);
  res.end = (chunk?: any, encoding?: any, callback?: any) => {
    originalEnd(chunk, encoding, callback);
    resolveResponse(res.toResponse());
  };

  // Fallback caso ninguém chame end (ex: streaming ou erro)
  res.on("finish", () => {
    resolveResponse(res.toResponse());
  });

  return { req, res, responsePromise };
}
