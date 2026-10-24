// Shared by the server guide and the chat panel. Kept apart from guide.ts so the browser
// only loads these few lines, not the whole help guide.

export type AssistantAudience = "public" | "clinician" | "admin";

/** Suggested first questions shown in the chat panel. */
export const STARTERS: Record<AssistantAudience, string[]> = {
  public: ["How do I join my practice?", "I forgot my password", "How do I leave a review?"],
  clinician: ["How do I correct a signed note?", "How do I invoice several patients?", "How do I mark a visit missed?"],
  admin: ["How do I verify a new clinician?", "How do I record a payment?", "How do I set up a service agreement?"],
};
