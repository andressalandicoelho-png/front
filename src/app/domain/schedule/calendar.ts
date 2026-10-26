import { toIsoDate } from './schedule.rules';

export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
}

/** Grade mensal (semanas começando no domingo), sempre com linhas completas. */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const total = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: toIsoDate(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}
