import { displayDurationSeconds, Publication } from '@domain/publication/publication.entity';
import { datesBetweenInclusive } from '@domain/schedule/schedule.rules';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';
import { ProgramPreviewItem } from '@presentation/models/program-preview-item';
import { createDefaultPublicationSchedule, isPublicationScheduleValid } from '@presentation/core/publication-schedule';

type ScheduleMap = Record<number, PublicationScheduleForm>;
type FormatDate = (date: string) => string;

const emptySchedule: PublicationScheduleForm = { date: '', endDate: '', startTime: '', endTime: '' };

export function selectedProgramPublications(publications: Publication[], ids: number[]): Publication[] {
  const byId = new Map(publications.map(publication => [publication.id, publication]));
  return ids.flatMap(id => {
    const publication = byId.get(id);
    if (!publication) return [];
    return [publication];
  });
}

export function publicationSchedule(schedules: ScheduleMap, publicationId: number): PublicationScheduleForm {
  return schedules[publicationId] ?? emptySchedule;
}

export function programSchedulesValid(
  publications: Publication[],
  schedules: ScheduleMap,
  scheduledKeys: string[],
  today: string,
): boolean {
  return publications.every(publication => {
    const dates = publicationScheduleDates(schedules, publication.id);
    const complete = dates.length > 0 &&
      scheduledDateCount(publication.id, schedules, scheduledKeys) === dates.length;
    return complete || isPublicationScheduleValid(publicationSchedule(schedules, publication.id), today);
  });
}

export function pickerSchedule(
  selectedIds: number[],
  schedules: ScheduleMap,
  today: string,
): PublicationScheduleForm {
  const firstId = selectedIds[0];
  let firstSchedule: PublicationScheduleForm | undefined;
  if (firstId !== undefined) firstSchedule = schedules[firstId];
  if (!firstSchedule?.date) return createDefaultPublicationSchedule(today);
  return { ...firstSchedule };
}

export function updateSelectedSchedules(
  schedules: ScheduleMap,
  previousIds: number[],
  selectedIds: number[],
  schedule: PublicationScheduleForm,
): ScheduleMap {
  const updated = { ...schedules };
  for (const id of previousIds) {
    if (!selectedIds.includes(id)) delete updated[id];
  }
  for (const id of selectedIds) updated[id] = { ...schedule };
  return updated;
}

export function toggleId(ids: number[], id: number, checked?: boolean): number[] {
  const shouldInclude = checked ?? !ids.includes(id);
  if (!shouldInclude) return ids.filter(existingId => existingId !== id);
  if (ids.includes(id)) return ids;
  return [...ids, id];
}

export function removePublicationSchedule(schedules: ScheduleMap, publicationId: number): ScheduleMap {
  const { [publicationId]: _removed, ...remaining } = schedules;
  return remaining;
}

export function publicationScheduleDates(schedules: ScheduleMap, publicationId: number): string[] {
  const schedule = publicationSchedule(schedules, publicationId);
  return datesBetweenInclusive(schedule.date, schedule.endDate);
}

export function scheduledDateCount(
  publicationId: number,
  schedules: ScheduleMap,
  scheduledKeys: string[],
): number {
  return publicationScheduleDates(schedules, publicationId)
    .filter(date => scheduledKeys.includes(programScheduleKey(publicationId, date))).length;
}

export function totalScheduledDateCount(
  publications: Publication[],
  schedules: ScheduleMap,
  scheduledKeys: string[],
): number {
  return publications.reduce(
    (count, publication) => count + scheduledDateCount(publication.id, schedules, scheduledKeys), 0,
  );
}

export function programScheduleKey(publicationId: number, date: string): string {
  return `${publicationId}:${date}`;
}

export function programDuration(publication: Publication): number {
  return displayDurationSeconds(publication.type, publication.displaySeconds, publication.originalDurationSeconds);
}

export function programPreviewItems(
  publications: Publication[],
  schedules: ScheduleMap,
  formatDate: FormatDate,
): ProgramPreviewItem[] {
  return publications.map(publication => {
    const schedule = publicationSchedule(schedules, publication.id);
    const dates = datesBetweenInclusive(schedule.date, schedule.endDate);
    let range = '';
    if (dates.length) {
      range = formatDate(dates[0]);
      if (dates.length > 1) range += ` a ${formatDate(dates[dates.length - 1])}`;
    }
    let time = '';
    if (schedule.startTime && schedule.endTime) time = `${schedule.startTime}–${schedule.endTime}`;
    return {
      title: publication.title,
      type: publication.type,
      content: publication.content,
      mediaId: publication.mediaId,
      linkUrl: publication.linkUrl,
      seconds: programDuration(publication),
      schedule: [range, time].filter(Boolean).join(' · '),
    };
  });
}

export function publicationScheduleSummary(
  publicationId: number,
  schedules: ScheduleMap,
  formatDate: FormatDate,
): string {
  const schedule = publicationSchedule(schedules, publicationId);
  let period = 'Período a definir';
  if (schedule.date && schedule.endDate) {
    period = formatScheduleRange(schedule.date, schedule.endDate, formatDate);
  }
  let time = 'Horário a definir';
  if (schedule.startTime && schedule.endTime) time = `${schedule.startTime}–${schedule.endTime}`;
  return `${period} · ${time}`;
}

export function programSummaryPeriod(
  publications: Publication[],
  schedules: ScheduleMap,
  formatDate: FormatDate,
): string {
  const schedulesWithDates = publications
    .map(publication => publicationSchedule(schedules, publication.id))
    .filter(schedule => schedule.date && schedule.endDate);
  if (!schedulesWithDates.length) return 'Período não definido';
  const start = schedulesWithDates.map(schedule => schedule.date).sort()[0];
  const end = schedulesWithDates.map(schedule => schedule.endDate).sort().at(-1);
  if (!start || !end) return 'Período não definido';
  return formatScheduleRange(start, end, formatDate);
}

export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder) return `${minutes} min ${remainder} s`;
  return `${minutes} min`;
}

export function createProgramScheduleTasks(
  publications: Publication[],
  schedules: ScheduleMap,
  scheduledKeys: Set<string>,
  programId: number,
): Array<{ publicationId: number; programId: number; date: string; startTime: string; endTime: string }> {
  return publications.flatMap(publication => {
    const schedule = publicationSchedule(schedules, publication.id);
    return datesBetweenInclusive(schedule.date, schedule.endDate)
      .filter(date => !scheduledKeys.has(programScheduleKey(publication.id, date)))
      .map(date => ({
        publicationId: publication.id,
        programId,
        date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      }));
  });
}

function formatScheduleRange(start: string, end: string, formatDate: FormatDate): string {
  const startDate = localDate(start);
  const endDate = localDate(end);
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    const month = startDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${startDate.getDate()} a ${endDate.getDate()} ${month} ${startDate.getFullYear()}`;
  }
  return `${formatDate(start)} a ${formatDate(end)}`;
}

function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}
