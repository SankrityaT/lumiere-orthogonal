"use client";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import type { Attachment } from "./ChatInput";

interface UserMessageProps {
  text: string;
  attachments?: Attachment[];
}

export function UserMessage({ text, attachments }: UserMessageProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex justify-end py-5"
    >
      <div className="flex max-w-[80%] flex-col items-end gap-2">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 overflow-hidden rounded-xl border border-border bg-surface p-1.5 pr-3"
              >
                {a.preview ? (
                  <div className="h-10 w-10 overflow-hidden rounded-md ring-1 ring-border">
                    <img src={a.preview} alt={a.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg ring-1 ring-border">
                    <FileText size={15} className="text-accent" strokeWidth={1.6} />
                  </div>
                )}
                <div className="max-w-[160px] truncate text-[12px] text-ink-dim">{a.name}</div>
              </div>
            ))}
          </div>
        )}
        {text && (
          <div className="rounded-2xl rounded-tr-md border border-border bg-elevated/70 px-4 py-2.5 text-[14.5px] leading-relaxed text-ink">
            {text}
          </div>
        )}
      </div>
    </motion.article>
  );
}
