"use client";

import { scriptFor } from "./demo-script";
import type { Conversation } from "./conversations";
import { countTokens } from "@/components/StreamingText";

const DEMO_ID = "demo-frontier-comparison";
const USER_PROMPT =
  "Compare the latest frontier models: Claude 4.7, GPT-5.5, and Gemini 3.1 Pro across benchmarks, capabilities, and best use cases.";

export function buildDemoConversation(): Conversation {
  const script = scriptFor(USER_PROMPT);
  const responseTokens = countTokens(script.response);

  // 2 days ago so it sits in "Previous 7 days" group
  const ts = Date.now() - 2 * 24 * 60 * 60 * 1000;

  return {
    id: DEMO_ID,
    title: "Frontier model comparison",
    createdAt: ts,
    updatedAt: ts,
    isDemo: true,
    messages: [
      {
        kind: "user",
        id: "demo-user-1",
        text: USER_PROMPT,
      },
      {
        kind: "ai",
        id: "demo-ai-1",
        data: {
          id: "demo-ai-1",
          state: null,
          reasoning: {
            thoughts: script.reasoning,
            visibleCount: script.reasoning.length,
            durationSec: 14,
          },
          toolCall: {
            queries: script.toolQueries,
            sources: script.sources,
            status: "done",
            visibleCount: script.sources.length,
          },
          response: {
            text: script.response,
            revealedTokens: responseTokens,
          },
          done: true,
        },
      },
    ],
  };
}

export function isDemoConversation(id: string): boolean {
  return id === DEMO_ID;
}
