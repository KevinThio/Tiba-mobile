import { practiceFromLink } from "./actions";
import { ReviewForm } from "./review-form";

/**
 * Patient review page (spec v2 section 6). No account needed. Opened from the sign-in page,
 * or from a practice's own review link (/review?practice=<id>), which skips finding the practice.
 */
export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const { practice } = await searchParams;
  const linked = typeof practice === "string" ? await practiceFromLink(practice) : null;
  return <ReviewForm linkedPractice={linked} />;
}
