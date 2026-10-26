import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NewScheduleEntry, ScheduleChanges, ScheduleEntry, ScheduleFilter,
} from '@domain/schedule/schedule.entity';
import { ScheduleRepository } from '@domain/schedule/schedule.repository';
import { api, cleanParams } from '../http/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toEntry = (r: any): ScheduleEntry => ({
  id: r.id,
  channelId: r.channelId ?? r.channel?.id,
  publicationId: r.publicationId ?? r.publication?.id,
  date: String(r.date).slice(0, 10),
  startTime: String(r.startTime).slice(0, 5),
  endTime: String(r.endTime).slice(0, 5),
  turnSeconds: r.turnSeconds ?? null,
  publicationTitle: r.publication?.title ?? r.publicationTitle,
});

@Injectable()
export class HttpScheduleRepository extends ScheduleRepository {
  private http = inject(HttpClient);

  list(filter: ScheduleFilter = {}): Observable<ScheduleEntry[]> {
    return this.http
      .get<any[]>(api('/schedule'), { params: cleanParams({ ...filter }) })
      .pipe(map(l => l.map(toEntry)));
  }

  create(input: NewScheduleEntry): Observable<ScheduleEntry> {
    return this.http.post<any>(api('/schedule'), input).pipe(map(toEntry));
  }

  update(id: number, changes: ScheduleChanges): Observable<ScheduleEntry> {
    return this.http.patch<any>(api(`/schedule/${id}`), changes).pipe(map(toEntry));
  }

  delete(id: number): Observable<void> { return this.http.delete<void>(api(`/schedule/${id}`)); }
}
