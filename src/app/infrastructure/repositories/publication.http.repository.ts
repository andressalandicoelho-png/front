import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NewPublication, Publication, PublicationChanges, PublicationFilter,
} from '@domain/publication/publication.entity';
import { PublicationRepository } from '@domain/publication/publication.repository';
import { api, cleanParams } from '../http/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Ajuste aqui se o backend usar outros nomes de campo. */
const toPublication = (r: any): Publication => ({
  id: r.id,
  title: r.title,
  type: r.type,
  status: r.status ?? '',
  displaySeconds: r.displaySeconds ?? null,
  originalDurationSeconds: r.originalDurationSeconds ?? null,
  linkUrl: r.linkUrl ?? null,
  mediaId: r.mediaId ?? r.media?.id ?? (r.type === 'LINK' ? null : r.id),
});

@Injectable()
export class HttpPublicationRepository extends PublicationRepository {
  private http = inject(HttpClient);

  list(filter: PublicationFilter = {}): Observable<Publication[]> {
    return this.http
      .get<any[]>(api('/publications'), { params: cleanParams({ status: filter.status, type: filter.type }) })
      .pipe(map(l => l.map(toPublication)));
  }

  get(id: number): Observable<Publication> {
    return this.http.get<any>(api(`/publications/${id}`)).pipe(map(toPublication));
  }

  /** multipart/form-data, conforme o contrato da API. */
  create(input: NewPublication): Observable<Publication> {
    const form = new FormData();
    form.append('title', input.title.trim());
    form.append('type', input.type);
    if (input.displaySeconds) form.append('displaySeconds', String(input.displaySeconds));
    if (input.originalDurationSeconds) form.append('originalDurationSeconds', String(input.originalDurationSeconds));
    if (input.type === 'LINK' && input.linkUrl) form.append('linkUrl', input.linkUrl);
    if (input.type !== 'LINK' && input.file) form.append('file', input.file);
    return this.http.post<any>(api('/publications'), form).pipe(map(toPublication));
  }

  update(id: number, changes: PublicationChanges): Observable<Publication> {
    return this.http.patch<any>(api(`/publications/${id}`), changes).pipe(map(toPublication));
  }

  publish(id: number): Observable<Publication> {
    return this.http.post<any>(api(`/publications/${id}/publish`), {}).pipe(map(toPublication));
  }

  unpublish(id: number): Observable<Publication> {
    return this.http.post<any>(api(`/publications/${id}/unpublish`), {}).pipe(map(toPublication));
  }

  delete(id: number): Observable<void> { return this.http.delete<void>(api(`/publications/${id}`)); }
}
