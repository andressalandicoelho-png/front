import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Program } from '@domain/program/program.entity';
import { ProgramRepository } from '@domain/program/program.repository';
import { api } from '../http/api';

interface ProgramEntryApiResponse {
  id: number;
  position: number;
  publicationId: number;
  publicationTitle: string;
  publicationContent: string | null;
  publicationType: Program['entries'][number]['publicationType'];
  publicationStatus: string;
  displaySeconds: number | null;
  originalDurationSeconds: number | null;
  mediaFileId: number | null;
  linkUrl: string | null;
}

interface ProgramApiResponse {
  id: number;
  name: string;
  active: boolean;
  hasPlayerToken: boolean;
  createdById: number;
  entries: ProgramEntryApiResponse[];
}

const toProgram = (response: ProgramApiResponse): Program => ({
  id: response.id,
  name: response.name,
  active: response.active,
  hasPlayerToken: response.hasPlayerToken,
  createdById: response.createdById,
  entries: response.entries.map(entry => ({ ...entry })),
});

@Injectable()
export class HttpProgramRepository extends ProgramRepository {
  private http = inject(HttpClient);

  list(): Observable<Program[]> {
    return this.http.get<ProgramApiResponse[]>(api('/programs')).pipe(map(programs => programs.map(toProgram)));
  }
  create(name: string): Observable<Program> {
    return this.http.post<ProgramApiResponse>(api('/programs'), { name }).pipe(map(toProgram));
  }
  update(id: number, changes: { name?: string; active?: boolean }): Observable<Program> {
    return this.http.patch<ProgramApiResponse>(api(`/programs/${id}`), changes).pipe(map(toProgram));
  }
  addPublications(id: number, publicationIds: number[]): Observable<Program> {
    return this.http.post<ProgramApiResponse>(api(`/programs/${id}/publications`), { publicationIds }).pipe(map(toProgram));
  }
  removeEntry(id: number, entryId: number): Observable<Program> {
    return this.http.delete<ProgramApiResponse>(api(`/programs/${id}/entries/${entryId}`)).pipe(map(toProgram));
  }
  generatePlayerToken(id: number): Observable<string> {
    return this.http.post<{ token: string }>(api(`/programs/${id}/player-token`), {}).pipe(map(response => response.token));
  }
  delete(id: number): Observable<void> {
    return this.http.delete<void>(api(`/programs/${id}`));
  }
}
