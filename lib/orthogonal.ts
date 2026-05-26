/**
 * Thin Orthogonal /v1/run wrapper.
 *
 * We're not using @orth/sdk because its types lie: RunResponse.price is typed
 * as string, but the wire returns `priceCents: number`. The SDK also doesn't
 * expose `requestId` and doesn't support method override for DELETE/PATCH
 * (AgentMail needs that). 40 lines of our own is honest about the schema.
 *
 * Confirmed live against api.orth.sh with `orth_live_*` key.
 */
const BASE_URL = "https://api.orth.sh";

export interface RunOptions {
  api: string; // provider slug e.g. "apollo"
  path: string; // upstream path with params already interpolated
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  method?: "DELETE" | "PATCH"; // only needed for non-GET/POST upstream verbs
  timeoutMs?: number; // default 15000
  signal?: AbortSignal;
}

export interface RunSuccess<T = unknown> {
  success: true;
  priceCents: number;
  data: T;
  requestId: string;
}

export interface RunFailure {
  success: false;
  priceCents: 0;
  error: string;
  status: number;
  requestId?: string;
}

export type RunResult<T = unknown> = RunSuccess<T> | RunFailure;

export class OrthogonalError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "OrthogonalError";
  }
}

export interface OrthogonalClientOptions {
  apiKey?: string;
}

export class OrthogonalClient {
  private apiKey: string;

  constructor(opts: OrthogonalClientOptions = {}) {
    const key = opts.apiKey ?? process.env.ORTHOGONAL_API_KEY ?? "";
    if (!key) {
      throw new Error("ORTHOGONAL_API_KEY missing. Set it in .env.local.");
    }
    this.apiKey = key;
  }

  async run<T = unknown>(opts: RunOptions): Promise<RunResult<T>> {
    const ctrl = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const externalAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", externalAbort);

    const payload: Record<string, unknown> = {
      api: opts.api,
      path: opts.path,
    };
    if (opts.query !== undefined) payload.query = opts.query;
    if (opts.body !== undefined) payload.body = opts.body;
    if (opts.method) payload.method = opts.method;

    try {
      const res = await fetch(`${BASE_URL}/v1/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "orthogonal-chat/0.1",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        const errMsg =
          (json?.error as string) ||
          (typeof (json?.data as Record<string, unknown>)?.error === "string"
            ? ((json.data as Record<string, unknown>).error as string)
            : `Orthogonal ${res.status}`);
        return {
          success: false,
          priceCents: 0,
          error: errMsg,
          status: res.status,
          requestId: (json?.requestId as string) ?? undefined,
        };
      }

      // Success shape: { success: true, priceCents: number, data, requestId }
      if (json.success === false) {
        return {
          success: false,
          priceCents: 0,
          error: (json.error as string) ?? "Unknown error",
          status: 200,
          requestId: (json.requestId as string) ?? undefined,
        };
      }

      return {
        success: true,
        priceCents: typeof json.priceCents === "number" ? (json.priceCents as number) : 0,
        data: (json.data ?? {}) as T,
        requestId: (json.requestId as string) ?? "",
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          priceCents: 0,
          error: `Orthogonal call timed out after ${timeoutMs}ms`,
          status: 504,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, priceCents: 0, error: msg, status: 0 };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", externalAbort);
    }
  }

  /** Wraps /v1/search — natural-language API discovery */
  async search(query: string): Promise<RunResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(`${BASE_URL}/v1/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        return { success: false, priceCents: 0, error: (json?.error as string) ?? `HTTP ${res.status}`, status: res.status };
      }
      return { success: true, priceCents: 0, data: json, requestId: "" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, priceCents: 0, error: msg, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}

let _client: OrthogonalClient | null = null;
export function orth(): OrthogonalClient {
  if (!_client) _client = new OrthogonalClient();
  return _client;
}
