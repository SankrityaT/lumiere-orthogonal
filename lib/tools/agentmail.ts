import type { ToolModule, ExecCtx, ToolResult } from "./_types";

interface SendEmailArgs {
  subject?: string;
  body?: string;
  reason?: string;
  suggested_recipients?: string[];
}

/**
 * send_email is the only tool with a CONFIRM flow + a HARD RECIPIENT GATE.
 *
 *   1. Agent calls this tool with subject + body only — NEVER with a `to`.
 *      The schema doesn't even expose `to`. This is a hard guarantee that
 *      the LLM can't address a real Apollo contact directly.
 *   2. Tool saves the draft (with no recipient) and returns a draft_id.
 *   3. UI renders the draft with an EDITABLE "To:" input (empty default).
 *      Send button is disabled until the user types a valid recipient.
 *   4. POST /api/chat/confirm-send takes {draft_id, to, confirmed} and
 *      enforces a server-side allowlist before firing AgentMail.
 *
 * Defense-in-depth: schema gate + UI gate + server allowlist.
 */
const send_email: ToolModule = {
  cardKind: "email-draft",
  providerLabel: "AgentMail",
  def: {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Prepare a draft email (subject + body only). YOU DO NOT PICK THE RECIPIENT — the user enters it in the UI. The email is NEVER sent automatically; the user clicks Send after reviewing. Don't address the recipient by name in the body unless the user has already told you who it's for, because you don't know who will receive it.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line." },
          body: {
            type: "string",
            description:
              "Email body (plain text). Will get a demo footer + [DEMO] subject prefix on send. Keep under 1500 chars.",
          },
          reason: {
            type: "string",
            description: "Brief explanation of why you're proposing this email — shown to the user.",
          },
          suggested_recipients: {
            type: "array",
            items: { type: "string" },
            description:
              "OPTIONAL suggestions only — shown to the user as chips they can click to fill the To: field. The user is free to ignore them and type their own. These are not addresses you've decided to send to.",
          },
        },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as SendEmailArgs;
    if (!args.subject || !args.body) {
      return {
        llmContent: JSON.stringify({ error: "subject and body are required" }),
        cardPayload: { error: "missing fields" },
        priceCents: 0,
        calls: [],
        error: "missing fields",
      };
    }

    // Stash with empty `to` — recipient comes from the user via the UI.
    const draftId = await ctx.saveDraft({
      to: "",
      subject: args.subject,
      body: args.body,
      reason: args.reason,
    });

    const card = {
      draft_id: draftId,
      subject: `[DEMO] ${args.subject}`,
      body: args.body,
      suggested_recipients: Array.isArray(args.suggested_recipients) ? args.suggested_recipients : [],
      footer_note:
        "Recipient is required from you — the agent never picks it. Demo footer + [DEMO] prefix are auto-added on send. Max 3 sends per session.",
      reason: args.reason,
    };

    const llmContent = JSON.stringify({
      status: "draft_pending_user_recipient_and_confirmation",
      draft_id: draftId,
      note:
        "Email is NOT sent. The UI is showing the user a confirmation card where THEY enter the recipient (you don't). Do not call this tool again for the same draft. Move on or wait for the user.",
    });

    return {
      llmContent,
      cardPayload: card,
      priceCents: 0,
      calls: [],
    };
  },
};

export default send_email;
