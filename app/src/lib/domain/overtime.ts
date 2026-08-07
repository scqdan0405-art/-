export type OvertimeSettings = {
  graceMinutes: number;
  hourlyVnd: number;
  capHours: number;
  dailyStorageFeeVnd: number | null;
};

export const DEFAULT_OVERTIME_SETTINGS: OvertimeSettings = {
  graceMinutes: 15,
  hourlyVnd: 10_000,
  capHours: 24,
  dailyStorageFeeVnd: null
};

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function calculateOvertime(returnDueAt: Date, now: Date, settings: OvertimeSettings = DEFAULT_OVERTIME_SETTINGS) {
  const elapsedMs = Math.max(0, now.getTime() - returnDueAt.getTime());
  const graceMs = settings.graceMinutes * MINUTE_MS;

  if (elapsedMs <= graceMs) {
    return { overtimeFeeVnd: 0, dailyStorageFeeVnd: 0, totalVnd: 0, billableHours: 0, dailyUnits: 0 };
  }

  const capMs = settings.capHours * HOUR_MS;
  const billableHours = Math.min(settings.capHours, Math.ceil(elapsedMs / HOUR_MS));
  const overtimeFeeVnd = billableHours * settings.hourlyVnd;

  const dailyUnits =
    settings.dailyStorageFeeVnd === null || elapsedMs <= capMs ? 0 : Math.ceil((elapsedMs - capMs) / (24 * HOUR_MS));
  const dailyStorageFeeVnd = (settings.dailyStorageFeeVnd ?? 0) * dailyUnits;

  return {
    overtimeFeeVnd,
    dailyStorageFeeVnd,
    totalVnd: overtimeFeeVnd + dailyStorageFeeVnd,
    billableHours,
    dailyUnits
  };
}
