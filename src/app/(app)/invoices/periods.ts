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
