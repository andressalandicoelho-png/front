import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { currentBusinessDate, toMinutes } from '@domain/schedule/schedule.rules';
import { CalendarEntryForm } from '@presentation/ui/calendar/calendar-entry-dialog.component';

export function emptyCalendarEntryForm(selectedDate: string | null): CalendarEntryForm {
  return {
    publicationId: null,
    programId: null,
    endDate: selectedDate ?? '',
    startTime: '08:00',
    endTime: '18:00',
    turnSeconds: null,
  };
}

export function calendarEntryForm(entry: ScheduleEntry): CalendarEntryForm {
  return {
    publicationId: entry.publicationId,
    programId: entry.programId,
    endDate: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    turnSeconds: entry.turnSeconds,
  };
}

export function calendarEntryValidationError(date: string, form: CalendarEntryForm): string | null {
  if (date < currentBusinessDate()) return 'Esta data já passou.';
  if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
    return 'O horário final precisa ser posterior ao horário inicial.';
  }
  return null;
}
