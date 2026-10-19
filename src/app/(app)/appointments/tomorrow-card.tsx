"use client";

import { BellRing, Mail } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { emailTomorrowNow, getTomorrowSummary, setReminderEmails } from "./reminder-actions";

type Summary = Awaited<ReturnType<typeof getTomorrowSummary>>;

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Tomorrow at a glance, with "email me the list" and the evening-reminder setting. */
export function TomorrowCard({ refreshKey }: { refreshKey: number }) {
  const checkboxId = useId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTomorrowSummary(browserTimeZone())
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      // Not critical: the card just stays in its loading state.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function emailNow() {
    setSending(true);
    try {
      const result = await emailTomorrowNow(browserTimeZone());
      if (result.ok) toast.success(`Sent. Tomorrow's list is on its way to ${result.to}.`);
      else toast.error(result.message);
    } catch {
      toast.error("We couldn't send the email just now. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  async function toggleReminders(enabled: boolean) {
    setSummary((s) => (s ? { ...s, reminderEmails: enabled } : s));
    try {
      await setReminderEmails(enabled, browserTimeZone());
      toast.success(enabled ? "Done. We'll email you tomorrow's visits every evening at 6 pm." : "Evening reminders are off.");
    } catch {
      setSummary((s) => (s ? { ...s, reminderEmails: !enabled } : s));
      toast.error("We couldn't save that just now. Please try again.");
    }
  }

  return (
    <section aria-labelledby="tomorrow-heading" className="grid gap-4 rounded-3xl border bg-accent/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
          <BellRing className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="tomorrow-heading" className="text-lg leading-tight">
            Tomorrow
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {summary === null
              ? "Checking…"
              : summary.count === 0
                ? `Nothing booked for ${summary.label}.`
                : `${summary.count} visit${summary.count === 1 ? "" : "s"} on ${summary.label}.`}
          </p>
        </div>
      </div>

      <Button variant="outline" onClick={emailNow} disabled={sending || summary === null}>
        <Mail className="size-4" aria-hidden />
        {sending ? "Sending…" : "Email me tomorrow's list"}
      </Button>

      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={summary?.reminderEmails ?? false}
          disabled={summary === null}
          onCheckedChange={(checked) => toggleReminders(checked)}
          className="mt-0.5 bg-card"
        />
        <label htmlFor={checkboxId} className="text-sm leading-snug">
          Email me every evening at 6 pm
          <span className="block text-muted-foreground">Sent to your sign-in email, with patients shown by first name and initial.</span>
        </label>
      </div>
    </section>
  );
}
