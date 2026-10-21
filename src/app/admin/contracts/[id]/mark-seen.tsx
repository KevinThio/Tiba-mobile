"use client";

import { useEffect, useRef } from "react";
import { markContractSeenByAdmin } from "../actions";

/** Takes away the contract's "New" badge and notifications once it's been shown. */
export function MarkContractSeen({ contractId }: { contractId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markContractSeenByAdmin(contractId).catch(() => {});
  }, [contractId]);
  return null;
}
