const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

export interface ScanWindow {
  asOf: string;
  changeWindowStart: string;
  changeWindowEnd: string;
}

const parseAsOf = (value: string | null) => {
  if (value === null || value.trim().length === 0 || value === "now") {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "--as-of must be an ISO date or timestamp. Examples: 2026-06-01, 2026-06-01T12:00:00Z"
    );
  }

  return date;
};

export const resolveScanWindow = (
  asOfInput: string | null,
  survivalDays: number[],
  windowDays: number
): ScanWindow => {
  const asOf = parseAsOf(asOfInput);
  const maxSurvivalDays = Math.max(...survivalDays);
  const changeWindowEnd = new Date(
    asOf.getTime() - daysToMs(maxSurvivalDays)
  );
  const changeWindowStart = new Date(
    changeWindowEnd.getTime() - daysToMs(windowDays)
  );

  return {
    asOf: asOf.toISOString(),
    changeWindowStart: changeWindowStart.toISOString(),
    changeWindowEnd: changeWindowEnd.toISOString()
  };
};
