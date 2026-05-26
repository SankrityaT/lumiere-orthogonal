import type { CacheTier } from "../cache";

export type CardKind =
  | "apollo-people"
  | "contact-enrich"
  | "company-signals"
  | "web-results"
  | "email-draft"
  | "discover"
  | "generic";

export interface GuardedCallResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  priceCents: number;
  cached: boolean;
  cachedFromId?: string;
  latencyMs: number;
  /** Generated row id (used for cache `sourceId` cross-reference) */
  callId: string;
}

export interface ExecCtx {
  conversationId: string;
  call(opts: {
    api: string;
    path: string;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    method?: "DELETE" | "PATCH";
    cacheTier?: CacheTier;
    timeoutMs?: number;
  }): Promise<GuardedCallResult>;
  /** Used by send_email — stashes a pending draft and returns draft_id */
  saveDraft(payload: {
    to: string;
    subject: string;
    body: string;
    reason?: string;
  }): Promise<string>;
}

export interface ToolCallTrace {
  callId: string;
  api: string;
  path: string;
  args: Record<string, unknown>;
  result: GuardedCallResult;
}

export interface ToolResult {
  /** Content placed in the OpenAI tool-message — compact and reasoning-friendly. */
  llmContent: string;
  /** Payload the UI renders inside the matching CardKind. */
  cardPayload: unknown;
  /** Aggregate priceCents across all internal guarded calls (cached calls contribute 0). */
  priceCents: number;
  /** Per-call breakdown for persistence + tracing. */
  calls: ToolCallTrace[];
  /** Tool-level error if the whole tool failed (gate failure, validation, etc.).
   *  Per-call errors live inside calls[].result.error. */
  error?: string;
}

export interface ToolModule {
  def: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
  cardKind: CardKind;
  /** Used for header-line provider chip in the UI tool card. */
  providerLabel: string;
  execute(args: Record<string, unknown>, ctx: ExecCtx): Promise<ToolResult>;
}
