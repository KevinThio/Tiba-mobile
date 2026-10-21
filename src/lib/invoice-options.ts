// Choices on the admin's invoice screen (spec v2 section 5b).

export const ISSUE_CATEGORIES = [
  "Wrong amount",
  "Wrong patient",
  "Missing or unsigned note",
  "Insurance denied",
  "Duplicate invoice",
  "Other",
] as const;

/** How an invoice was paid. Check is offered in the US, M-Pesa in Kenya. */
export function paymentMethods(country: string): string[] {
  return ["Insurance", "Card", "Cash", "Bank transfer", ...(country === "US" ? ["Check"] : []), ...(country === "KE" ? ["M-Pesa"] : [])];
}

/** Every method any country offers, for checking what the server receives. */
export const ALL_PAYMENT_METHODS = ["Insurance", "Card", "Cash", "Bank transfer", "Check", "M-Pesa"];

/** How the admin screens show an invoice number: "INV-0007". */
export const invoiceLabel = (n: number) => `INV-${String(n).padStart(4, "0")}`;
