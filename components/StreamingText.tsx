"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { Source } from "./SourceChip";

interface StreamingTextProps {
  text: string;
  revealedTokens: number;
  sources: Source[];
  onCitationHover?: (id: number) => void;
}

type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "cite"; refs: number[] };

type Block =
  | { kind: "h2"; inlines: Inline[] }
  | { kind: "h3"; inlines: Inline[] }
  | { kind: "p"; inlines: Inline[] }
  | { kind: "ul"; items: Inline[][] }
  | { kind: "code"; lang: string; code: string }
  | { kind: "quote"; inlines: Inline[] };

function parseInlines(line: string): Inline[] {
  const out: Inline[] = [];
  // Patterns: **bold**, *italic*, `code`, [1] or [1,2] or [1][2]
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([0-9,\s]+)\](?:\[([0-9,\s]+)\])*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[2]) out.push({ kind: "bold", text: m[2] });
    else if (m[3]) out.push({ kind: "italic", text: m[3] });
    else if (m[4]) out.push({ kind: "code", text: m[4] });
    else if (m[5]) {
      // Collect chained citation groups: re-scan from m.index for [n][n]…
      const refs: number[] = [];
      const full = m[0];
      const groupRe = /\[([0-9,\s]+)\]/g;
      let gm: RegExpExecArray | null;
      while ((gm = groupRe.exec(full)) !== null) {
        for (const part of gm[1].split(",")) {
          const n = parseInt(part.trim(), 10);
          if (!isNaN(n)) refs.push(n);
        }
      }
      out.push({ kind: "cite", refs });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing
      blocks.push({ kind: "code", lang, code: codeLines.join("\n") });
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", inlines: parseInlines(line.slice(3)) });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", inlines: parseInlines(line.slice(4)) });
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push({ kind: "quote", inlines: parseInlines(line.slice(2)) });
      i++;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: Inline[][] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(parseInlines(lines[i].slice(2)));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    // Paragraph: gather until blank line / block start
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("### ") &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("> ")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", inlines: parseInlines(paraLines.join(" ")) });
  }
  return blocks;
}

// Tokenize inlines: text becomes word atoms; bold/italic/code/cite are single atoms.
function tokenizeInlines(inlines: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const inl of inlines) {
    if (inl.kind === "text") {
      const parts = inl.text.split(/(\s+)/);
      for (const p of parts) {
        if (p === "") continue;
        out.push({ kind: "text", text: p });
      }
    } else {
      out.push(inl);
    }
  }
  return out;
}

interface Atom {
  blockIdx: number;
  blockKind: Block["kind"];
  inline: Inline | { kind: "li-start"; idx: number } | { kind: "code-block"; lang: string; code: string };
}

function flatten(blocks: Block[]): { atoms: Atom[]; total: number } {
  const atoms: Atom[] = [];
  blocks.forEach((b, idx) => {
    if (b.kind === "code") {
      atoms.push({ blockIdx: idx, blockKind: b.kind, inline: { kind: "code-block", lang: b.lang, code: b.code } });
    } else if (b.kind === "ul") {
      b.items.forEach((item, liIdx) => {
        atoms.push({ blockIdx: idx, blockKind: b.kind, inline: { kind: "li-start", idx: liIdx } });
        for (const t of tokenizeInlines(item)) {
          atoms.push({ blockIdx: idx, blockKind: b.kind, inline: t });
        }
      });
    } else {
      for (const t of tokenizeInlines(b.inlines)) {
        atoms.push({ blockIdx: idx, blockKind: b.kind, inline: t });
      }
    }
  });
  return { atoms, total: atoms.length };
}

function RenderInline({ inline, sources }: { inline: Inline; sources: Source[] }) {
  switch (inline.kind) {
    case "text":
      return <span>{inline.text}</span>;
    case "bold":
      return <strong>{inline.text}</strong>;
    case "italic":
      return <em>{inline.text}</em>;
    case "code":
      return <code>{inline.text}</code>;
    case "cite": {
      return (
        <span className="ml-0.5 inline-flex items-center gap-px align-super">
          {inline.refs.map((n, idx) => {
            const src = sources.find((s) => s.id === n);
            return (
              <a
                key={`${n}-${idx}`}
                href={src?.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="citation-chip group inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-[3px] border border-border bg-elevated px-1 text-ink-dim transition-all hover:border-accent/60 hover:bg-accent/10 hover:text-accent-strong"
                title={src?.title}
                style={{ verticalAlign: "super" }}
              >
                {n}
              </a>
            );
          })}
        </span>
      );
    }
  }
}

export function StreamingText({ text, revealedTokens, sources }: StreamingTextProps) {
  const { blocks, flat } = useMemo(() => {
    const parsed = parseMarkdown(text);
    const flat = flatten(parsed);
    return { blocks: parsed, flat };
  }, [text]);

  // Group atoms back by block, but only include atoms whose index < revealedTokens
  const renderedBlocks: { block: Block; blockIdx: number; atoms: Atom[] }[] = [];
  let blockMap = new Map<number, Atom[]>();
  flat.atoms.slice(0, revealedTokens).forEach((a) => {
    if (!blockMap.has(a.blockIdx)) blockMap.set(a.blockIdx, []);
    blockMap.get(a.blockIdx)!.push(a);
  });
  blocks.forEach((b, idx) => {
    const atoms = blockMap.get(idx);
    if (atoms && atoms.length) renderedBlocks.push({ block: b, blockIdx: idx, atoms });
  });

  const atomVariants = {
    initial: { opacity: 0, filter: "blur(4px)", y: 3 },
    animate: { opacity: 1, filter: "blur(0px)", y: 0 },
  };
  const atomTransition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="prose-editorial">
      {renderedBlocks.map(({ block, blockIdx, atoms }) => {
        if (block.kind === "code") {
          const atom = atoms[0];
          if (!atom || atom.inline.kind !== "code-block") return null;
          return (
            <motion.pre
              key={blockIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {atom.inline.lang && (
                <span className="absolute right-3 top-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  {atom.inline.lang}
                </span>
              )}
              <code>{atom.inline.code}</code>
            </motion.pre>
          );
        }

        if (block.kind === "ul") {
          // Group atoms by li (split on li-start)
          const items: Atom[][] = [];
          let cur: Atom[] = [];
          atoms.forEach((a) => {
            if (a.inline.kind === "li-start") {
              if (cur.length) items.push(cur);
              cur = [];
            } else {
              cur.push(a);
            }
          });
          if (cur.length) items.push(cur);
          return (
            <ul key={blockIdx}>
              {items.map((itemAtoms, idx) => (
                <motion.li key={idx} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
                  {itemAtoms.map((a, i) =>
                    a.inline.kind === "li-start" || a.inline.kind === "code-block" ? null : (
                      <motion.span key={i} variants={atomVariants} initial="initial" animate="animate" transition={atomTransition}>
                        <RenderInline inline={a.inline as Inline} sources={sources} />
                      </motion.span>
                    ),
                  )}
                </motion.li>
              ))}
            </ul>
          );
        }

        const Tag = block.kind === "h2" ? "h2" : block.kind === "h3" ? "h3" : block.kind === "quote" ? "blockquote" : "p";

        return (
          <Tag key={blockIdx}>
            {atoms.map((a, i) =>
              a.inline.kind === "li-start" || a.inline.kind === "code-block" ? null : (
                <motion.span key={i} variants={atomVariants} initial="initial" animate="animate" transition={atomTransition}>
                  <RenderInline inline={a.inline as Inline} sources={sources} />
                </motion.span>
              ),
            )}
            {atoms.length > 0 && revealedTokens > 0 && revealedTokens < flat.total && blockIdx === renderedBlocks[renderedBlocks.length - 1].blockIdx && (
              <span className="ml-0.5 inline-block h-[1em] w-[0.45em] -mb-[2px] bg-accent/80 align-middle animate-pulse-soft" />
            )}
          </Tag>
        );
      })}
    </div>
  );
}

// Export the token count utility so demo can know total
export function countTokens(text: string): number {
  const blocks = parseMarkdown(text);
  return flatten(blocks).total;
}
