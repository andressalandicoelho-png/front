import { Injectable, inject } from '@angular/core';
import { CreateScheduleEntryUseCase } from '@application/schedule/schedule.usecases';
import { NewScheduleEntry, ScheduleEntry } from '@domain/schedule/schedule.entity';
import { Observable, catchError, concat, concatMap, from, map, of, throwError } from 'rxjs';

export interface ScheduleEntriesCommand {
  readonly tasks: readonly NewScheduleEntry[];
}

export type ScheduleEntriesEvent =
  | { readonly type: 'started'; readonly total: number }
  | { readonly type: 'progress'; readonly completed: number; readonly total: number; readonly entry: ScheduleEntry };

export class ScheduleEntriesError extends Error {
  constructor(
    readonly task: NewScheduleEntry,
    readonly completed: number,
    readonly originalError: unknown,
  ) {
    super('Could not complete the schedule.');
    this.name = 'ScheduleEntriesError';
  }
}

@Injectable({ providedIn: 'root' })
export class ScheduleEntriesUseCase {
  private readonly createScheduleEntry = inject(CreateScheduleEntryUseCase);

  execute(command: ScheduleEntriesCommand): Observable<ScheduleEntriesEvent> {
    return concat(
      of({ type: 'started' as const, total: command.tasks.length }),
      from(command.tasks).pipe(
        concatMap((task, index) => this.createScheduleEntry.execute(task).pipe(
          map(entry => ({ type: 'progress' as const, entry, completed: index + 1, total: command.tasks.length })),
          catchError((error: unknown) => throwError(
            () => new ScheduleEntriesError(task, index, error),
          )),
        )),
      ),
    );
  }
}
