import { currentBusinessDate, currentBusinessTime, datesBetweenInclusive, toMinutes } from '@domain/schedule/schedule.rules';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';

export function createDefaultPublicationSchedule(
  date = currentBusinessDate(),
  currentTime = currentBusinessTime(),
): PublicationScheduleForm {
  let startMinute = toMinutes(currentTime);
  let endMinute = startMinute + 60;
  if (endMinute > 1439) {
    startMinute = 1380;
    endMinute = 1439;
  }
  const formatTime = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return {
    date,
    endDate: date,
    startTime: formatTime(startMinute),
    endTime: formatTime(endMinute),
  };
}

export function updatePublicationSchedule(
  schedule: PublicationScheduleForm,
  field: keyof PublicationScheduleForm,
  value: string,
): PublicationScheduleForm {
  const updated = { ...schedule, [field]: value };
  if (field === 'date' && updated.endDate < value) updated.endDate = value;
  if (field === 'endDate' && value < updated.date) updated.date = value;
  return updated;
}

export function isPublicationScheduleValid(schedule: PublicationScheduleForm, today: string): boolean {
  return !!datesBetweenInclusive(schedule.date, schedule.endDate).length &&
    schedule.date >= today && !!schedule.startTime && !!schedule.endTime &&
    toMinutes(schedule.endTime) > toMinutes(schedule.startTime);
}
