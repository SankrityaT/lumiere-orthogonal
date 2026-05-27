"use client";

import { motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  Mail,
  Phone,
  Linkedin,
  Building2,
  MapPin,
  Briefcase,
  TrendingUp,
  Newspaper,
  Globe,
  Database,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  Send,
  ZapOff,
} from "lucide-react";
import { useState } from "react";
import type { CardKind } from "@/lib/chat-client";

/* ============================== shared bits ============================== */

interface CardShellProps {
  provider: string;
  toolName: string;
  status: "running" | "done" | "error";
  cached?: boolean;
  priceCents?: number;
  error?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

function formatCents(cents: number): string {
  if (cents === 0) return "free";
  if (cents < 1) return `${cents.toFixed(2)}¢`;
  return `$${(cents / 100).toFixed(4)}`;
}

export function ToolCardShell({
  provider,
  toolName,
  status,
  cached,
  priceCents,
  error,
  onRetry,
  children,
}: CardShellProps) {
  const isError = status === "error" || !!error;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "my-3 overflow-hidden rounded-2xl border bg-surface/60 backdrop-blur-sm",
        isError ? "border-red-400/30 opacity-90" : "border-border",
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5 border-b border-border/60 bg-bg/40 px-3.5 py-2 text-[11.5px]">
        <span
          className={[
            "inline-flex h-1.5 w-1.5 rounded-full",
            status === "running" ? "bg-accent animate-pulse-soft" : isError ? "bg-red-400" : "bg-accent/60",
          ].join(" ")}
        />
        <span className="font-mono uppercase tracking-[0.14em] text-ink-muted">{provider}</span>
        <span className="text-ink-muted">·</span>
        <span className="font-mono text-ink-dim">{toolName}</span>
        <div className="ml-auto flex items-center gap-2 text-ink-muted">
          {cached && (
            <span className="rounded border border-border bg-elevated/50 px-1.5 py-0.5 text-[10px]">
              cached
            </span>
          )}
          {typeof priceCents === "number" && !cached && (
            <span className="font-mono text-[10px] tabular-nums">{formatCents(priceCents)}</span>
          )}
          {status === "running" && <span className="text-[10px] italic">running…</span>}
          {status === "done" && <Check size={11} strokeWidth={2.2} className="text-accent/80" />}
        </div>
      </div>
      {isError && error && (
        <div className="flex items-start gap-2 border-b border-red-400/15 bg-red-400/5 px-3.5 py-2 text-[12px] text-red-400">
          <AlertTriangle size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{error}</div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-1 inline-flex items-center gap-1 rounded border border-red-400/30 px-1.5 py-0.5 text-[11px] text-red-400 transition-colors hover:bg-red-400/10"
              >
                <RotateCcw size={10} strokeWidth={2} />
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      <div className="px-3.5 py-3">{children}</div>
    </motion.div>
  );
}

/* =========================== Apollo people card =========================== */

interface ApolloPerson {
  name?: string;
  title?: string;
  company?: string;
  domain?: string;
  location?: string;
  linkedin?: string;
  email?: string;
  phone?: string;
  enriched?: boolean;
}

export function ApolloPeopleCard({ payload }: { payload: { people: ApolloPerson[]; total_found?: number; enriched_count?: number } }) {
  if (!payload.people?.length) {
    return <div className="text-[12.5px] text-ink-dim italic">No people matched.</div>;
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] text-ink-muted">
        <span>{payload.people.length} returned</span>
        {payload.total_found && payload.total_found > payload.people.length && (
          <>
            <span>·</span>
            <span>{payload.total_found.toLocaleString()} total matches</span>
          </>
        )}
        {payload.enriched_count ? (
          <>
            <span>·</span>
            <span>{payload.enriched_count} enriched</span>
          </>
        ) : null}
      </div>
      <ul className="divide-y divide-border/60">
        {payload.people.slice(0, 12).map((p, i) => (
          <li key={i} className="flex items-start gap-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-medium text-accent ring-1 ring-border">
              {(p.name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] text-ink">
                <span className="font-medium">{p.name}</span>
                {p.linkedin && (
                  <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-accent/70 hover:text-accent">
                    <Linkedin size={11} strokeWidth={1.8} className="inline" />
                  </a>
                )}
                {p.enriched && (
                  <span className="rounded bg-accent/10 px-1 py-0.5 text-[9.5px] font-mono text-accent-strong">enriched</span>
                )}
              </div>
              <div className="mt-0.5 text-[12px] text-ink-dim">
                {p.title}
                {p.company && (
                  <>
                    {" · "}
                    <span className="text-ink">{p.company}</span>
                  </>
                )}
              </div>
              {p.location && (
                <div className="mt-0.5 text-[11px] text-ink-muted flex items-center gap-1">
                  <MapPin size={9} strokeWidth={1.8} />
                  {p.location}
                </div>
              )}
              {(p.email || p.phone) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      className="inline-flex items-center gap-1 rounded border border-border bg-elevated/40 px-1.5 py-0.5 text-[10.5px] font-mono text-ink-dim hover:border-accent/40 hover:text-ink"
                    >
                      <Mail size={9} strokeWidth={1.8} />
                      {p.email}
                    </a>
                  )}
                  {p.phone && (
                    <span className="inline-flex items-center gap-1 rounded border border-border bg-elevated/40 px-1.5 py-0.5 text-[10.5px] font-mono text-ink-dim">
                      <Phone size={9} strokeWidth={1.8} />
                      {p.phone}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========================== Contact enrich card ========================== */

interface ContactEnrichPayload {
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  linkedin?: string;
  emails?: string[];
  phones?: string[];
  role_history?: unknown[];
  error?: string;
}

export function ContactEnrichCard({ payload }: { payload: ContactEnrichPayload }) {
  const emails = payload.emails ?? [];
  const phones = payload.phones ?? [];
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-[12.5px] font-medium text-accent ring-1 ring-border">
        {(payload.name ?? "?").slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[14px] font-medium text-ink">{payload.name ?? "Unknown"}</span>
          {payload.linkedin && (
            <a href={payload.linkedin} target="_blank" rel="noreferrer" className="text-accent/70 hover:text-accent">
              <Linkedin size={12} strokeWidth={1.8} className="inline" />
            </a>
          )}
        </div>
        <div className="mt-0.5 text-[12.5px] text-ink-dim">
          {payload.title}
          {payload.company && (
            <>
              {" · "}
              <span className="text-ink">{payload.company}</span>
            </>
          )}
        </div>
        {payload.location && (
          <div className="mt-0.5 text-[11.5px] text-ink-muted flex items-center gap-1">
            <MapPin size={10} strokeWidth={1.8} /> {payload.location}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {emails.map((e, i) => (
            <a
              key={`e-${i}`}
              href={`mailto:${e}`}
              className="inline-flex items-center gap-1 rounded border border-border bg-elevated/40 px-2 py-0.5 text-[11px] font-mono text-ink-dim hover:border-accent/40 hover:text-ink"
            >
              <Mail size={10} strokeWidth={1.8} /> {e}
            </a>
          ))}
          {phones.map((p, i) => (
            <span
              key={`p-${i}`}
              className="inline-flex items-center gap-1 rounded border border-border bg-elevated/40 px-2 py-0.5 text-[11px] font-mono text-ink-dim"
            >
              <Phone size={10} strokeWidth={1.8} /> {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================= Company signals card ========================= */

interface SignalsPayload {
  domain: string;
  signals: {
    financing: unknown[];
    jobs: unknown[];
    news: unknown[];
  };
  errors?: string[];
}

export function CompanySignalsCard({ payload }: { payload: SignalsPayload }) {
  const { financing = [], jobs = [], news = [] } = payload.signals ?? {};
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-dim">
        <Building2 size={12} strokeWidth={1.8} className="text-accent" />
        <span className="font-mono">{payload.domain}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SignalColumn icon={TrendingUp} title="Financing" items={financing as Array<Record<string, unknown>>} kind="financing" />
        <SignalColumn icon={Briefcase} title="Jobs" items={jobs as Array<Record<string, unknown>>} kind="jobs" />
        <SignalColumn icon={Newspaper} title="News" items={news as Array<Record<string, unknown>>} kind="news" />
      </div>
      {payload.errors && payload.errors.length > 0 && (
        <div className="mt-2 text-[11px] italic text-red-400/80">{payload.errors.join(" · ")}</div>
      )}
    </div>
  );
}

function SignalColumn({
  icon: Icon,
  title,
  items,
  kind,
}: {
  icon: typeof TrendingUp;
  title: string;
  items: Array<Record<string, unknown>>;
  kind: "financing" | "jobs" | "news";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-elevated/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
        <Icon size={11} strokeWidth={1.8} className="text-accent/70" />
        <span className="font-medium uppercase tracking-[0.1em]">{title}</span>
        <span className="ml-auto font-mono text-[10px]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] italic text-ink-muted">no recent items</div>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 4).map((item, i) => {
            const attrs = (item.attributes as Record<string, unknown>) ?? item;
            const title = (attrs.title as string) ?? (attrs.job_title as string) ?? (attrs.headline as string) ?? "—";
            const date =
              (attrs.found_at as string) ??
              (attrs.first_seen_at as string) ??
              (attrs.published_at as string) ??
              "";
            const amount = kind === "financing" ? (attrs.amount as string) ?? (attrs.amount_normalized as string) : null;
            // PredictLeads varies: jobs have url/landing_page_url, financing
            // has source_url/url, news has url. Try them all.
            const href =
              (attrs.url as string) ??
              (attrs.source_url as string) ??
              (attrs.landing_page_url as string) ??
              (attrs.application_url as string) ??
              (attrs.link as string) ??
              null;
            const Inner = (
              <>
                <div className="line-clamp-2 text-ink group-hover/li:text-accent-strong transition-colors">
                  {title}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-muted">
                  {date && <span className="font-mono">{date.slice(0, 10)}</span>}
                  {amount && <span className="rounded bg-accent/10 px-1 text-accent-strong">{amount}</span>}
                  {href && <span className="ml-auto text-ink-muted/70">↗</span>}
                </div>
              </>
            );
            return (
              <li key={i} className="group/li text-[11.5px] text-ink-dim leading-snug">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block rounded px-1 -mx-1 hover:bg-bg/50 transition-colors"
                  >
                    {Inner}
                  </a>
                ) : (
                  <div>{Inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================ Web results card ============================ */

interface WebResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export function WebResultsCard({ payload }: { payload: { query: string; results: WebResult[] } }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-dim">
        <Globe size={12} strokeWidth={1.8} className="text-accent" />
        <span className="italic">&ldquo;{payload.query}&rdquo;</span>
        <span className="ml-auto font-mono text-[10px] text-ink-muted">{payload.results?.length ?? 0}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(payload.results ?? []).map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="group flex w-[240px] shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-elevated/30 p-2.5 transition-colors hover:border-accent/40"
          >
            <div className="flex items-center gap-1.5 text-[10.5px] text-ink-muted">
              <span className="font-mono">{String(r.id).padStart(2, "0")}</span>
              <span className="truncate">{r.domain}</span>
              <ExternalLink size={9} strokeWidth={1.8} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="text-[12.5px] font-medium leading-snug text-ink line-clamp-2">{r.title}</div>
            {r.snippet && <div className="text-[11px] leading-relaxed text-ink-dim line-clamp-3">{r.snippet}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ============================ Email draft card ============================ */

interface DraftPayload {
  draft_id: string;
  subject: string;
  body: string;
  suggested_recipients?: string[];
  footer_note?: string;
  reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailDraftCard({ payload }: { payload: DraftPayload }) {
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sentMeta, setSentMeta] = useState<{ messageId?: string; used?: number; cap?: number; sentTo?: string } | null>(
    null,
  );

  const recipientValid = EMAIL_RE.test(recipient.trim());
  const canSend = recipientValid && status === "idle";

  const send = async () => {
    if (!recipientValid) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/chat/confirm-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draft_id: payload.draft_id, to: recipient.trim(), confirmed: true }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setStatus("failed");
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setSentMeta({
        messageId: j.message_id,
        used: j.used,
        cap: j.cap,
        sentTo: j.sent_to ?? recipient.trim(),
      });
      setStatus("sent");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="text-[12.5px]">
      {payload.reason && (
        <div className="mb-2 rounded border border-border/60 bg-elevated/30 px-2.5 py-1.5 text-[11.5px] italic text-ink-dim">
          <span className="not-italic text-ink-muted">why: </span>
          {payload.reason}
        </div>
      )}

      {/* Recipient field — agent never picks this. User types here. */}
      <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-amber-400/90">
          <AlertTriangle size={10} strokeWidth={1.8} />
          you choose the recipient — the agent never does
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">to</span>
          <input
            type="email"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              if (status === "failed") {
                setStatus("idle");
                setError(null);
              }
            }}
            disabled={status !== "idle" && status !== "failed"}
            placeholder="someone@example.com"
            className={[
              "no-default-focus flex-1 rounded border bg-bg px-2 py-1 font-mono text-[12px] text-ink placeholder:text-ink-muted/60",
              recipient.length > 0 && !recipientValid
                ? "border-red-400/40 focus:border-red-400/60"
                : "border-border focus:border-accent/50",
            ].join(" ")}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {payload.suggested_recipients && payload.suggested_recipients.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] italic text-ink-muted">agent suggested:</span>
            {payload.suggested_recipients.slice(0, 5).map((addr) => (
              <button
                key={addr}
                onClick={() => setRecipient(addr)}
                className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10.5px] text-ink-dim transition-colors hover:border-accent/40 hover:text-ink"
                title="Click to fill — you can still edit before sending"
              >
                {addr}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Row label="subject" value={payload.subject} />
      </div>
      <div className="mt-2 rounded-lg border border-border/60 bg-elevated/30 p-2.5 text-[12px] leading-relaxed text-ink whitespace-pre-wrap">
        {payload.body}
      </div>
      {payload.footer_note && (
        <div className="mt-1.5 text-[10.5px] italic text-ink-muted">{payload.footer_note}</div>
      )}
      <div className="mt-3 flex items-center gap-2">
        {(status === "idle" || status === "failed") && (
          <button
            onClick={send}
            disabled={!canSend}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
              canSend
                ? "bg-accent text-bg hover:bg-accent-strong active:scale-95"
                : "cursor-not-allowed bg-elevated text-ink-muted",
            ].join(" ")}
            title={canSend ? "Send (recipient is on the allowlist gate server-side)" : "Enter a recipient first"}
          >
            <Send size={11} strokeWidth={2.2} /> Send
          </button>
        )}
        {status === "sending" && <span className="text-[12px] italic text-ink-dim">sending…</span>}
        {status === "sent" && (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-[12px] text-accent">
            <Check size={12} strokeWidth={2.2} /> Sent to{" "}
            <span className="font-mono">{sentMeta?.sentTo}</span>
            {sentMeta?.messageId && (
              <span className="font-mono text-[10.5px] text-ink-muted">{sentMeta.messageId.slice(0, 16)}…</span>
            )}
            {sentMeta?.used && sentMeta?.cap && (
              <span className="text-[10.5px] text-ink-muted">({sentMeta.used}/{sentMeta.cap} sends used)</span>
            )}
          </span>
        )}
        {status === "failed" && error && (
          <span className="inline-flex items-start gap-1.5 text-[12px] text-red-400">
            <ZapOff size={12} strokeWidth={2} className="mt-0.5 shrink-0" /> {error}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{label}</span>
      <span className={mono ? "font-mono text-[12px] text-ink" : "text-[12.5px] text-ink"}>{value}</span>
    </div>
  );
}

/* ============================ Discover card ============================ */

interface DiscoverPayload {
  query: string;
  matches: Array<{ slug: string; name: string; description?: string; endpoint_count: number }>;
}

export function DiscoverCard({ payload }: { payload: DiscoverPayload }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-dim">
        <Sparkles size={12} strokeWidth={1.8} className="text-accent" />
        <span className="italic">&ldquo;{payload.query}&rdquo;</span>
      </div>
      <ul className="space-y-1.5">
        {payload.matches.map((m) => (
          <li key={m.slug} className="rounded border border-border/60 bg-elevated/30 p-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-ink">{m.name}</span>
              <span className="font-mono text-[10.5px] text-accent">{m.slug}</span>
              <span className="ml-auto font-mono text-[10px] text-ink-muted">{m.endpoint_count} eps</span>
            </div>
            {m.description && <div className="mt-0.5 text-[11.5px] text-ink-dim leading-snug">{m.description}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =========================== Generic / fallback =========================== */

export function GenericToolCard({ payload }: { payload: { api?: string; path?: string; data?: unknown; error?: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[12px] text-ink-dim">
        <Database size={12} strokeWidth={1.8} className="text-accent" />
        {payload.api && <span className="font-mono">{payload.api}</span>}
        {payload.path && <span className="font-mono text-ink-muted">{payload.path}</span>}
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink"
        >
          {open ? "hide" : "show"} raw
          <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <pre className="mt-1 max-h-[300px] overflow-auto rounded border border-border bg-bg/60 p-2 font-mono text-[10.5px] text-ink-dim">
          {JSON.stringify(payload.data ?? payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ============================== Dispatcher ============================== */

export function ToolCardBody({
  cardKind,
  payload,
}: {
  cardKind: CardKind;
  payload: unknown;
}) {
  switch (cardKind) {
    case "apollo-people":
      return <ApolloPeopleCard payload={payload as Parameters<typeof ApolloPeopleCard>[0]["payload"]} />;
    case "contact-enrich":
      return <ContactEnrichCard payload={payload as ContactEnrichPayload} />;
    case "company-signals":
      return <CompanySignalsCard payload={payload as SignalsPayload} />;
    case "web-results":
      return <WebResultsCard payload={payload as { query: string; results: WebResult[] }} />;
    case "email-draft":
      return <EmailDraftCard payload={payload as DraftPayload} />;
    case "discover":
      return <DiscoverCard payload={payload as DiscoverPayload} />;
    case "generic":
    default:
      return <GenericToolCard payload={payload as { api?: string; path?: string; data?: unknown }} />;
  }
}
