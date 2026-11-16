import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NewScheduleEntry, ScheduleChanges, ScheduleEntry, ScheduleFilter,
} from '@domain/schedule/schedule.entity';
import { ScheduleRepository } from '@domain/schedule/schedule.repository';
import { api, cleanParams } from '../http/api';

interface ScheduleApiResponse {
  id: number;
  publicationId?: number | null;
  publication?: { id?: number | null; title?: string | null } | null;
  programId?: number | null;
  date: string;
  startTime: string;
  endTime: string;
  turnSeconds?: number | null;
  publicationTitle?: string | null;
}

const toEntry = (r: ScheduleApiResponse): ScheduleEntry => {
  const publicationId = r.publicationId ?? r.publication?.id;
  if (publicationId === null || publicationId === undefined) {
    throw new Error('A resposta da API de agendamento não contém o conteúdo associado.');
  }

  return {
    id: r.id,
    publicationId,
    programId: r.programId ?? null,
    date: String(r.date).slice(0, 10),
    startTime: String(r.startTime).slice(0, 5),
    endTime: String(r.endTime).slice(0, 5),
    turnSeconds: r.turnSeconds ?? null,
    publicationTitle: r.publication?.title ?? r.publicationTitle ?? undefined,
  };
};

@Injectable()
export class HttpScheduleRepository extends ScheduleRepository {
  private http = inject(HttpClient);

  list(filter: ScheduleFilter = {}): Observable<ScheduleEntry[]> {
    return this.http
      .get<ScheduleApiResponse[]>(api('/schedule'), { params: cleanParams({ ...filter }) })
      .pipe(map(l => l.map(toEntry)));
  }

  expiredPublicationIds(programId: number): Observable<number[]> {
    return this.http.get<number[]>(api(`/schedule/program/${programId}/expired-publications`));
  }

  create(input: NewScheduleEntry): Observable<ScheduleEntry> {
    return this.http.post<ScheduleApiResponse>(api('/schedule'), input).pipe(map(toEntry));
  }

  update(id: number, changes: ScheduleChanges): Observable<ScheduleEntry> {
    return this.http.patch<ScheduleApiResponse>(api(`/schedule/${id}`), changes).pipe(map(toEntry));
  }

  delete(id: number): Observable<void> { return this.http.delete<void>(api(`/schedule/${id}`)); }
}
