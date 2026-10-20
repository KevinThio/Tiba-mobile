import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

// Outgoing email. Set SMTP_URL (e.g. smtps://user:password@smtp.example.com:465) and
// EMAIL_FROM ("Tiba <notes@yourpractice.com>"). Any SMTP provider works.
// Without SMTP_URL in development, emails are saved as .eml files in .data/outbox
// instead (open them in any mail app). Production refuses to run without SMTP.
// Emails contain patient information: never log their contents or recipients.

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email isn't set up yet (SMTP_URL is missing).");
  }
}

export async function sendEmail(email: Email): Promise<{ via: "smtp" | "outbox" }> {
  const from = process.env.EMAIL_FROM ?? "Tiba <no-reply@tiba.local>";
  const smtpUrl = process.env.SMTP_URL;

  if (smtpUrl) {
    await nodemailer.createTransport(smtpUrl).sendMail({ from, ...email });
    return { via: "smtp" };
  }
  if (process.env.NODE_ENV === "production") throw new EmailNotConfiguredError();

  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail({ from, ...email });
  const dir = path.join(".data", "outbox");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.eml`), info.message as Buffer);
  return { via: "outbox" };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Simple branded email body. `rows` become a two-column list (e.g. time and patient). */
export function renderEmail({
  heading,
  intro,
  rows = [],
  outro,
}: {
  heading: string;
  intro: string;
  rows?: [string, string][];
  outro?: string;
}): { html: string; text: string } {
  const rowsHtml = rows
    .map(
      ([a, b]) =>
        `<tr><td style="padding:10px 16px 10px 0;color:#2D6A4F;font-weight:600;white-space:nowrap;vertical-align:top">${escapeHtml(a)}</td><td style="padding:10px 0;color:#25282D">${escapeHtml(b)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#FBFAFD;font-family:Figtree,Segoe UI,Helvetica,Arial,sans-serif;color:#25282D">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;color:#2D6A4F">Tiba</p>
  <div style="background:#fff;border:1px solid #DFE0E5;border-radius:20px;padding:28px">
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:normal;color:#2D6A4F">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px;line-height:1.5">${escapeHtml(intro)}</p>
    ${rows.length ? `<table style="border-collapse:collapse;width:100%;border-top:1px solid #DFE0E5">${rowsHtml}</table>` : ""}
    ${outro ? `<p style="margin:16px 0 0;line-height:1.5;color:#686D76">${escapeHtml(outro)}</p>` : ""}
  </div>
  <p style="margin:20px 4px 0;font-size:12px;color:#686D76">Sent by Tiba. This email may contain private health information. If it reached you by mistake, please delete it.</p>
</div></body></html>`;
  const text = [heading, "", intro, "", ...rows.map(([a, b]) => `${a}  ${b}`), ...(outro ? ["", outro] : [])].join("\n");
  return { html, text };
}
