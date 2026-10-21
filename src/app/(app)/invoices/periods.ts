// Look-back filters for the invoicing list: key -> days.
export const PERIODS = { "1w": 7, "2w": 14, "1m": 31, "2m": 62, "6m": 183 } as const;
export type Period = keyof typeof PERIODS;

export const PERIOD_LABELS: Record<Period, string> = {
  "1w": "Last week",
  "2w": "Last 2 weeks",
  "1m": "Last month",
  "2m": "Last 2 months",
  "6m": "Last 6 months",
};

// Spec v2 "Payment due" on a new invoice: key -> label and days after the invoice date.
export const DUE_OPTIONS = {
  receipt: { label: "Due on receipt", days: 0 },
  "14": { label: "Due in 14 days", days: 14 },
  "30": { label: "Due in 30 days", days: 30 },
} as const;
export type Due = keyof typeof DUE_OPTIONS;
// In order: number-like keys would otherwise sort first ("14", "30", "receipt").
export const DUE_ORDER: Due[] = ["receipt", "14", "30"];
