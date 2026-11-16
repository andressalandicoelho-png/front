import { displayDurationSeconds } from '@domain/publication/publication.entity';
import { Program } from '@domain/program/program.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { formatDate as formatDateValue } from '@presentation/core/format';
import { ProgramPreviewItem } from '@presentation/ui/program/program-preview.component';

type ProgramEntry = Program['entries'][number];
type DateFormatter = typeof formatDateValue;

export function programEntryDuration(entry: ProgramEntry): number {
  return displayDurationSeconds(entry.publicationType, entry.displaySeconds, entry.originalDurationSeconds);
}

export function upcomingProgramSchedules(entries: ScheduleEntry[], today: string, time: string): ScheduleEntry[] {
  return entries
    .filter(entry => entry.date > today || (entry.date === today && entry.endTime > time))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

export function nextProgramSchedule(
  schedules: ScheduleEntry[],
  publicationId: number,
): ScheduleEntry | undefined {
  return schedules.find(entry => entry.publicationId === publicationId);
}

export function nextProgramScheduleLabel(
  schedule: ScheduleEntry | undefined,
  formatDate: DateFormatter,
): string {
  if (!schedule) return '';
  return `Próxima exibição: ${formatDate(schedule.date)} · ${schedule.startTime}–${schedule.endTime}`;
}

export function programPreviewItem(
  entry: ProgramEntry,
  schedule: ScheduleEntry | undefined,
  formatDate: DateFormatter,
): ProgramPreviewItem {
  const duration = programEntryDuration(entry);
  let seconds = duration;
  let scheduleLabel: string | undefined;
  if (schedule) {
    seconds = Math.min(duration, schedule.turnSeconds ?? duration);
    scheduleLabel = `${formatDate(schedule.date)} · ${schedule.startTime}–${schedule.endTime}`;
  }
  return {
    title: entry.publicationTitle,
    type: entry.publicationType,
    content: entry.publicationContent,
    mediaId: entry.mediaFileId,
    linkUrl: entry.linkUrl,
    seconds,
    schedule: scheduleLabel,
  };
}

export function copyProgramPlayerUrl(
  token: string,
  programId: number,
  copiedProgramId: { set(value: number | null): void; (): number | null },
  currentTimer: { value: ReturnType<typeof setTimeout> | null },
  showToast: (message: string) => void,
  setError: (message: string) => void,
): void {
  navigator.clipboard.writeText(`${location.origin}/player/${token}/program/${programId}`).then(
    () => {
      copiedProgramId.set(programId);
      if (currentTimer.value) clearTimeout(currentTimer.value);
      currentTimer.value = setTimeout(() => {
        if (copiedProgramId() === programId) copiedProgramId.set(null);
        currentTimer.value = null;
      }, 2000);
      showToast('Link copiado');
    },
    () => setError('Não foi possível copiar o link. Selecione e copie o endereço manualmente.'),
  );
}
