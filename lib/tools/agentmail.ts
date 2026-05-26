import type { ToolModule, ExecCtx, ToolResult } from "./_types";

interface SendEmailArgs {
  to?: string;
  subject?: string;
  body?: string;
  reason?: string;
}

/**
 * send_email is the only tool that has a CONFIRM flow. It does NOT call
 * AgentMail during execute(). It saves the draft via ctx.saveDraft() and
 * returns the draft_id. The UI renders a draft card with a Send button;
 * clicking it POSTs to /api/chat/confirm-send which actually fires
 * AgentMail (with demo footer + [DEMO] subject prefix + per-session cap).
 *
 * This is a safety rail — never let the agent independently send mail.
 */
const send_email: ToolModule = {
  cardKind: "email-draft",
  providerLabel: "AgentMail",
  def: {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Prepare a draft email. THE EMAIL IS NOT SENT until the user explicitly clicks Send in the UI. Use after you've found a contact and the user asked you to reach out. Keep body under 1500 chars. The user sees the full draft and decides.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address." },
          subject: { type: "string", description: "Email subject line." },
          body: { type: "string", description: "Email body (plain text). Will be appended with a demo footer when sent." },
          reason: {
            type: "string",
            description: "Brief explanation of why you're proposing this email — shown to the user in the confirmation card.",
          },
        },
        required: ["to", "subject", "body"],
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as SendEmailArgs;
    if (!args.to || !args.subject || !args.body) {
      return {
        llmContent: JSON.stringify({ error: "to, subject, and body are all required" }),
        cardPayload: { error: "missing fields" },
        priceCents: 0,
        calls: [],
        error: "missing fields",
      };
    }

    const draftId = await ctx.saveDraft({
      to: args.to,
      subject: args.subject,
      body: args.body,
      reason: args.reason,
    });

    const card = {
      draft_id: draftId,
      to: args.to,
      subject: `[DEMO] ${args.subject}`,
      body: args.body,
      footer_note: "On send: a demo footer is appended and the subject is prefixed with [DEMO]. Max 3 sends per session.",
      reason: args.reason,
    };

    const llmContent = JSON.stringify({
      status: "draft_pending_user_confirmation",
      draft_id: draftId,
      note:
        "Email is NOT sent. The UI is showing the user a confirmation card with a Send button. Do not call this tool again for the same email. Move on to the next step or wait for the user.",
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
