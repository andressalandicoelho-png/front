import type { PartialObserver } from 'rxjs';
import { ScheduleEntriesError, ScheduleEntriesEvent } from '@application/schedule/schedule-entries.usecase';

type ScheduleProgressEvent = Extract<ScheduleEntriesEvent, { type: 'progress' }>;

export interface ScheduleEntriesHandlers {
  started?(total: number): void;
  progress(event: ScheduleProgressEvent): void;
  scheduleError(error: ScheduleEntriesError): void;
  error(error: unknown): void;
  complete(): void;
}

export function scheduleEntriesObserver(handlers: ScheduleEntriesHandlers): PartialObserver<ScheduleEntriesEvent> {
  return {
    next: event => {
      if (event.type === 'started') {
        handlers.started?.(event.total);
        return;
      }
      handlers.progress(event);
    },
    error: error => {
      if (error instanceof ScheduleEntriesError) handlers.scheduleError(error);
      else handlers.error(error);
    },
    complete: handlers.complete,
  };
}