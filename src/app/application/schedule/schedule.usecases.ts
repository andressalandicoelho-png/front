import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import {
  NewScheduleEntry, ScheduleChanges, ScheduleEntry, ScheduleFilter,
} from '@domain/schedule/schedule.entity';
import { ScheduleRepository } from '@domain/schedule/schedule.repository';
import { validateScheduleEntry } from '@domain/schedule/schedule.rules';

@Injectable({ providedIn: 'root' })
export class ListScheduleUseCase {
  private repo = inject(ScheduleRepository);
  execute(filter?: ScheduleFilter) { return this.repo.list(filter); }
}

@Injectable({ providedIn: 'root' })
export class CreateScheduleEntryUseCase {
  private repo = inject(ScheduleRepository);
  execute(input: NewScheduleEntry): Observable<ScheduleEntry> {
    const error = validateScheduleEntry(input);
    return error ? throwError(() => new Error(error)) : this.repo.create(input);
  }
}

@Injectable({ providedIn: 'root' })
export class UpdateScheduleEntryUseCase {
  private repo = inject(ScheduleRepository);
  execute(id: number, changes: ScheduleChanges) { return this.repo.update(id, changes); }
}

@Injectable({ providedIn: 'root' })
export class DeleteScheduleEntryUseCase {
  private repo = inject(ScheduleRepository);
  execute(id: number) { return this.repo.delete(id); }
}
