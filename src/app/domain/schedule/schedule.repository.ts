import { Observable } from 'rxjs';
import { NewScheduleEntry, ScheduleChanges, ScheduleEntry, ScheduleFilter } from './schedule.entity';

export abstract class ScheduleRepository {
  abstract list(filter?: ScheduleFilter): Observable<ScheduleEntry[]>;
  abstract expiredPublicationIds(programId: number): Observable<number[]>;
  abstract create(input: NewScheduleEntry): Observable<ScheduleEntry>;
  abstract update(id: number, changes: ScheduleChanges): Observable<ScheduleEntry>;
  abstract delete(id: number): Observable<void>;
}
