import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { toMinutes } from '@domain/schedule/schedule.rules';

export function groupScheduleEntries(entries: ScheduleEntry[]): Map<string, ScheduleEntry[]> {
  const grouped = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const dateEntries = grouped.get(entry.date) ?? [];
    dateEntries.push(entry);
    grouped.set(entry.date, dateEntries);
  }
  for (const dateEntries of grouped.values()) {
    dateEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return grouped;
}

export function timelineLeft(entry: ScheduleEntry): number {
  return Math.max(0, Math.min(100, toMinutes(entry.startTime) / 1440 * 100));
}

export function timelineWidth(entry: ScheduleEntry): number {
  const left = timelineLeft(entry);
  return Math.max(0, Math.min(100 - left, (toMinutes(entry.endTime) - toMinutes(entry.startTime)) / 1440 * 100));
}

