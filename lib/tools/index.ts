import apollo from "./apollo";
import contactout from "./contactout";
import predictleads from "./predictleads";
import websearch from "./websearch";
import agentmail from "./agentmail";
import orth_discover from "./orth_discover";
import orth_call from "./orth_call";
import type { ToolModule } from "./_types";

export const TOOLS: Record<string, ToolModule> = {
  apollo_search_people: apollo,
  enrich_contact: contactout,
  company_signals: predictleads,
  web_search: websearch,
  send_email: agentmail,
  orth_discover,
  orth_call,
};

export const TOOL_DEFS = Object.values(TOOLS).map((t) => t.def);

export type { ToolModule, ExecCtx, ToolResult, ToolCallTrace, CardKind, GuardedCallResult } from "./_types";
export { guardedCall } from "./_runtime";
