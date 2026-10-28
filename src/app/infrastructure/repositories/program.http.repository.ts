import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Program } from '@domain/program/program.entity';
import { ProgramRepository } from '@domain/program/program.repository';
import { api } from '../http/api';

@Injectable()
export class HttpProgramRepository extends ProgramRepository {
  private http = inject(HttpClient);

  list(): Observable<Program[]> { return this.http.get<Program[]>(api('/programs')); }
  create(name: string): Observable<Program> { return this.http.post<Program>(api('/programs'), { name }); }
  update(id: number, changes: { name?: string; active?: boolean }): Observable<Program> {
    return this.http.patch<Program>(api(`/programs/${id}`), changes);
  }
  addPublications(id: number, publicationIds: number[]): Observable<Program> {
    return this.http.post<Program>(api(`/programs/${id}/publications`), { publicationIds });
  }
  removeEntry(id: number, entryId: number): Observable<Program> {
    return this.http.delete<Program>(api(`/programs/${id}/entries/${entryId}`));
  }
  delete(id: number): Observable<void> {
    return this.http.delete<void>(api(`/programs/${id}`));
  }
}
