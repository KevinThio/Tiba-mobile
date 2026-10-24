import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { assistantSystemPrompt, type AssistantAudience } from "@/lib/assistant/guide";
import { auth } from "@/lib/auth";
import { allow, clientIp } from "@/lib/rate-limit";

// "Ask Tiba": the help assistant on the sign-in page and in both apps (POST, streams plain text).
// It answers from Tiba's help guide only: no tools, no patient data, nothing stored or logged.
// Who's asking (public, clinician or admin) comes from the session, never from the request.
// Public: excluded in proxy.ts so the sign-in page can use it; rate-limited per IP.

const MODEL = "claude-opus-5-5";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20)
    // A conversation alternates, starting and ending with the person's question.
    .refine((m) => m.every((x, i) => x.role === (i % 2 === 0 ? "user" : "assistant")) && m.length % 2 === 1),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Only Tiba's own pages may call this (a browser on another site can't spend the practice's credits). */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const self = new URL(request.url).origin;
  const allowed = [self, appUrl()].filter(Boolean);
  if (process.env.NODE_ENV === "development") return true; // localhost, 127.0.0.1, the phone on the Wi-Fi
  return allowed.includes(origin);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return text("Ask Tiba only works from Tiba's own pages.", 403);

  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user as { id: string; role?: string; status?: string } | undefined;
  const audience: AssistantAudience =
    user?.role === "admin" ? "admin" : user?.role === "clinician" && user.status === "active" ? "clinician" : "public";

  // Signed-in people get more room than the public sign-in page.
  const key = user ? `assistant:account:${user.id}` : `assistant:ip:${await clientIp()}`;
  if (!allow(key, user ? 60 : 15, 10 * 60)) {
    return text("You've asked a lot of questions in a short time. Please wait a few minutes and try again.", 429);
  }

  // The key comes from the environment: .env.local, or the host settings in production.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return text("Ask Tiba isn't set up yet. Ask your admin to add the assistant's key.", 503);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text("Please type your question again (up to 2,000 characters).", 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const say = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const reply = anthropic().beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          // Help answers are short chat: low effort keeps them quick (Opus 5.5 always thinks adaptively).
          output_config: { effort: "low" },
          // If a safety check declines, the API retries on a suitable model inside the same call.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // The guide is the same for every question of an audience: cache it.
          system: [{ type: "text", text: assistantSystemPrompt(audience), cache_control: { type: "ephemeral" } }],
          messages: parsed.data.messages,
        });
        for await (const event of reply) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") say(event.delta.text);
        }
        const final = await reply.finalMessage();
        if (final.stop_reason === "refusal") say("\n\nSorry, I can't help with that one. Try asking about how to use Tiba.");
        else if (final.stop_reason === "max_tokens") say("…");
      } catch (error) {
        // Never log the question or answer: they can contain patient details someone typed.
        console.error("Ask Tiba failed:", error instanceof Anthropic.APIError ? `${error.status} ${error.name}` : "unexpected error");
        say(
          error instanceof Anthropic.AuthenticationError
            ? "Ask Tiba isn't set up yet. Ask your admin to add the assistant's key."
            : error instanceof Anthropic.RateLimitError
              ? "Ask Tiba is busy right now. Please try again in a minute."
              : "Sorry, something went wrong on our side. Please try again.",
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
