import { Injectable, inject } from '@angular/core';
import { CreateScheduleEntryUseCase } from '@application/schedule/schedule.usecases';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { Observable, catchError, concat, concatMap, from, map, of, throwError } from 'rxjs';

export interface ScheduleProgramEntriesCommand {
  readonly programId: number;
  readonly publicationIds: readonly number[];
  readonly dates: readonly string[];
  readonly startTime: string;
  readonly endTime: string;
  readonly alreadyScheduled: readonly Pick<ScheduleEntry, 'publicationId' | 'date'>[];
}

export type ScheduleProgramEntriesEvent =
  | { readonly type: 'started'; readonly total: number }
  | { readonly type: 'progress'; readonly completed: number; readonly total: number; readonly entry: ScheduleEntry };

export interface ScheduleProgramEntryTask {
  readonly publicationId: number;
  readonly date: string;
}

export class ScheduleProgramEntriesError extends Error {
  constructor(
    readonly task: ScheduleProgramEntryTask,
    readonly completed: number,
    readonly originalError: unknown,
  ) {
    super('Could not complete the program schedule.');
    this.name = 'ScheduleProgramEntriesError';
  }
}

@Injectable({ providedIn: 'root' })
export class ScheduleProgramEntriesUseCase {
  private readonly createScheduleEntry = inject(CreateScheduleEntryUseCase);

  execute(command: ScheduleProgramEntriesCommand): Observable<ScheduleProgramEntriesEvent> {
    const alreadyScheduled = new Set(
      command.alreadyScheduled.map(entry => this.scheduleKey(entry.publicationId, entry.date)),
    );
    const tasks = command.publicationIds.flatMap(publicationId =>
      command.dates
        .filter(date => !alreadyScheduled.has(this.scheduleKey(publicationId, date)))
        .map(date => ({ publicationId, date })),
    );

    return concat(
      of({ type: 'started' as const, total: tasks.length }),
      from(tasks).pipe(
        concatMap((task, index) => this.createScheduleEntry.execute({
          ...task,
          programId: command.programId,
          startTime: command.startTime,
          endTime: command.endTime,
        }).pipe(
          map(entry => ({ type: 'progress' as const, entry, completed: index + 1, total: tasks.length })),
          catchError((error: unknown) => throwError(
            () => new ScheduleProgramEntriesError(task, index, error),
          )),
        )),
      ),
    );
  }

  private scheduleKey(publicationId: number, date: string): string {
    return `${publicationId}:${date}`;
  }
}
