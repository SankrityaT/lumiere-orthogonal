import type { Source } from "@/components/SourceChip";

export interface DemoScript {
  reasoning: string[];
  toolQueries: string[];
  sources: Source[];
  response: string;
}

const COMPARE_MODELS_SOURCES: Source[] = [
  {
    id: 1,
    domain: "anthropic.com",
    title: "Claude 4.7: extended reasoning, 1M context, agentic tool use",
    url: "https://www.anthropic.com/news/claude-4-7",
    snippet: "Claude 4.7 ships with always-on extended reasoning, a 1M-token context window, and dramatic gains on agentic and long-horizon coding tasks.",
    faviconColor: "#d97757",
    faviconLetter: "A",
  },
  {
    id: 2,
    domain: "openai.com",
    title: "GPT-5.5 Release Notes: persistent memory, native multimodal",
    url: "https://openai.com/index/gpt-5-5",
    snippet: "GPT-5.5 introduces cross-session persistent memory, native tool orchestration, and stronger creative writing benchmarks.",
    faviconColor: "#10a37f",
    faviconLetter: "O",
  },
  {
    id: 3,
    domain: "blog.google",
    title: "Gemini 3.1 Pro: thinking mode and video understanding",
    url: "https://blog.google/technology/google-deepmind/gemini-3-1-pro",
    snippet: "Gemini 3.1 Pro brings dynamic thinking budgets, leading video understanding, and tight integration across Google Workspace.",
    faviconColor: "#4285f4",
    faviconLetter: "G",
  },
  {
    id: 4,
    domain: "artificialanalysis.ai",
    title: "AI Model Leaderboard, Q2 2026 frontier roundup",
    url: "https://artificialanalysis.ai/leaderboards",
    snippet: "Independent benchmarking across reasoning, coding, math, and multimodal tasks for the spring-2026 frontier.",
    faviconColor: "#7c3aed",
    faviconLetter: "α",
  },
  {
    id: 5,
    domain: "techcrunch.com",
    title: "The frontier shifts: what's changed since Claude 4",
    url: "https://techcrunch.com/2026/05/frontier-shifts",
    snippet: "Production teams report a clear divergence in fit by task type. Workflow integration matters more than benchmark deltas.",
    faviconColor: "#1a1a1a",
    faviconLetter: "T",
  },
  {
    id: 6,
    domain: "theverge.com",
    title: "The state of AI: spring 2026",
    url: "https://www.theverge.com/ai-state-2026-spring",
    snippet: "Where the major labs stand on capability, safety, and deployment in the spring of 2026.",
    faviconColor: "#fa4616",
    faviconLetter: "V",
  },
];

const COMPARE_MODELS_RESPONSE = `## The frontier in spring 2026

The frontier-model landscape has reshuffled meaningfully over the past two quarters. Anthropic's **Claude 4.7**[1] now ships with always-on extended reasoning, a 1M-token context window, and step-change gains on long-horizon coding and agentic tasks. OpenAI's **GPT-5.5**[2] introduced cross-session persistent memory and tightened its native multimodal stack. Google's **Gemini 3.1 Pro**[3] doubled down on dynamic thinking budgets and remains best-in-class for video understanding and Workspace.

## Benchmark snapshot

According to *Artificial Analysis*[4], the picture on key reasoning benchmarks is tighter than the marketing suggests:

- **GPQA Diamond**: Claude 4.7 (87.4%) edges out GPT-5.5 (85.9%) and Gemini 3.1 Pro (83.1%)
- **SWE-bench Verified**: Claude 4.7 leads at 74.8%, with GPT-5.5 at 71.2% and Gemini 3.1 Pro at 66.4%
- **MMLU-Pro**: all three sit within a point of 91%

## Where each shines

Claude 4.7[1] is the consensus pick for long-context analysis and serious code work; engineering teams report the deepest fit on real-world coding agents[5]. GPT-5.5[2] keeps the lead in creative writing, conversational warmth, and chained tool orchestration. Gemini 3.1 Pro[3] is unmatched on video understanding and the only frontier model with first-class Workspace integration.

> For most production use cases, the differentiator is *less about raw capability and more about workflow fit*[5][6].

\`\`\`ts
// rough fit-by-task heuristic
const recommend = (task: Task) =>
  task.kind === "long-context-code"  ? "claude-4-7"      :
  task.kind === "creative-writing"   ? "gpt-5-5"         :
  task.kind === "multimodal-video"   ? "gemini-3-1-pro"  :
  "any-frontier-model";
\`\`\`

Want me to dig deeper into any specific dimension, pricing, latency, or agent-task performance?`;

const COMPARE_MODELS_REASONING = [
  "The user wants a comparison across three frontier models. To answer well I should pull recent release notes, an independent benchmark source, and at least one piece of editorial coverage to capture deployment patterns.",
  "I'll structure the response as: brief landscape framing → benchmarks → where each shines → a small code heuristic. Citations should be tight, not overload sentences with refs.",
  "Verify that the benchmark numbers I cite trace to the independent source, not the labs themselves, so the comparison isn't lab-biased.",
];

const GENERIC_RESPONSE = `Here's a quick take on what you asked.

## Key points

- I parsed your question and outlined the main thread.
- For richer answers, enable the **Web** tool above so I can ground claims in fresh sources.
- I can also accept **attachments**, drag any image or PDF into the chat.

## A small example

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}.\`;
}
\`\`\`

Want me to expand any section, or pivot to something else entirely?`;

const GENERIC_REASONING = [
  "User sent an open-ended message. I'll respond conversationally and gently surface the capabilities they can use, web search, attachments, multi-turn, without sounding like a feature tour.",
  "Keep it brief. Editorial voice. Offer to expand.",
];

const GENERIC_SOURCES: Source[] = [];

export function scriptFor(userText: string): DemoScript {
  const lower = userText.toLowerCase();
  const wantsCompare =
    lower.includes("compare") &&
    (lower.includes("claude") || lower.includes("gpt") || lower.includes("gemini") || lower.includes("model"));

  if (wantsCompare) {
    return {
      reasoning: COMPARE_MODELS_REASONING,
      toolQueries: [
        "Claude 4.7 release benchmarks reasoning agentic",
        "GPT-5.5 persistent memory multimodal release",
        "Gemini 3.1 Pro thinking mode video Workspace",
      ],
      sources: COMPARE_MODELS_SOURCES,
      response: COMPARE_MODELS_RESPONSE,
    };
  }

  return {
    reasoning: GENERIC_REASONING,
    toolQueries: [],
    sources: GENERIC_SOURCES,
    response: GENERIC_RESPONSE,
  };
}
