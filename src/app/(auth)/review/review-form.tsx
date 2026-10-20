"use client";

import { ArrowLeft, Heart, Search, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { PracticeMark } from "@/components/practice-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findPracticeForReview, submitReview, type ReviewPractice } from "./actions";

const RATING_WORDS = ["", "Poor", "Not great", "Okay", "Good", "Excellent"];

export function ReviewForm({ linkedPractice }: { linkedPractice: ReviewPractice | null }) {
  const [practice, setPractice] = useState<ReviewPractice | null>(linkedPractice);
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function find(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("practiceName") ?? "");
    setPending(true);
    setError(null);
    const result = await findPracticeForReview({ name }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't look that up just now. Check your connection and try again.");
    if (!result.ok) return setError(result.message);
    setPractice(result.practice);
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!practice) return;
    if (!rating) return setError("Pick a star rating.");
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await submitReview({
      practiceId: practice.id,
      clinicianId: String(form.get("clinicianId") ?? "") || undefined,
      rating,
      text: String(form.get("text") ?? ""),
      name: String(form.get("name") ?? ""),
      website: String(form.get("website") ?? ""),
    }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't send your review just now. Check your connection and try again.");
    if (!result.ok) return setError(result.message);
    setSent(true);
  }

  if (sent) {
    return (
      <>
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg bg-secondary text-primary lg:mx-0">
          <Heart className="size-7" aria-hidden />
        </span>
        <AuthHeading title="Thank you">Your review is with the practice. Only their admin can read it.</AuthHeading>
        <Button size="lg" className="w-full" nativeButton={false} render={<Link href="/sign-in" />}>
          Back to sign in
        </Button>
      </>
    );
  }

  return (
    <>
      <Link
        href="/sign-in"
        className="mb-6 inline-flex w-fit items-center gap-2 rounded-sm text-small font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Sign in
      </Link>
      <AuthHeading title="How was your visit?">
        Your review goes privately to the practice. You don&apos;t need an account.
      </AuthHeading>

      {!practice ? (
        <form onSubmit={find} className="grid gap-5">
          <FormField
            label="Which practice did you visit?"
            name="practiceName"
            autoComplete="off"
            hint="Type the name as it appears on your appointment letter or invoice."
            required
          />
          {error && <FormAlert>{error}</FormAlert>}
          <Button type="submit" size="lg" disabled={pending}>
            <Search aria-hidden />
            {pending ? "Looking…" : "Find practice"}
          </Button>
        </form>
      ) : (
        <form onSubmit={send} className="grid gap-6">
          <div className="flex items-center gap-3 rounded-md bg-muted px-4 py-3">
            <PracticeMark practiceName={practice.name} logoUrl={null} />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-muted-foreground">Practice</p>
              <p className="truncate font-semibold">{practice.name}</p>
            </div>
            {!linkedPractice && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPractice(null);
                  setError(null);
                }}
              >
                Change
              </Button>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Your rating</legend>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-full has-focus-visible:ring-3 has-focus-visible:ring-ring"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    onChange={() => setRating(n)}
                    className="sr-only"
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${RATING_WORDS[n].toLowerCase()}`}
                  />
                  <Star
                    className={cn("size-8 transition-colors", n <= rating ? "fill-primary text-primary" : "text-border-strong")}
                    aria-hidden
                  />
                </label>
              ))}
              <span className="ml-2 text-small text-muted-foreground" aria-live="polite">
                {rating ? RATING_WORDS[rating] : ""}
              </span>
            </div>
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="text">Your review</Label>
            <Textarea id="text" name="text" maxLength={2000} placeholder="What went well, and what could be better?" required />
          </div>

          {practice.clinicians.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="clinicianId">Who did you see?</Label>
              <NativeSelect id="clinicianId" name="clinicianId" className="w-full" aria-describedby="clinicianId-hint" defaultValue="">
                <NativeSelectOption value="">Not sure</NativeSelectOption>
                {practice.clinicians.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p id="clinicianId-hint" className="text-sm text-muted-foreground">
                Optional. Helps the practice thank the right person.
              </p>
            </div>
          )}

          <FormField label="Your name (optional)" name="name" autoComplete="name" hint="Leave blank to stay anonymous." maxLength={100} />

          {/* Honeypot for bots; hidden from people and screen readers. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

          {error && <FormAlert>{error}</FormAlert>}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send review"}
          </Button>
        </form>
      )}
    </>
  );
}
