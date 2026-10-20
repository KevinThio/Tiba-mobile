"use client";

import { useEffect } from "react";
import { markReviewsSeen } from "./actions";

/** Marks new reviews as read after the list has been shown. Renders nothing. */
export function MarkReviewsSeen() {
  useEffect(() => {
    markReviewsSeen().catch(() => undefined);
  }, []);
  return null;
}
