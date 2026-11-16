import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NewPublication, Publication, PublicationChanges, PublicationFilter,
} from '@domain/publication/publication.entity';
import { PublicationRepository } from '@domain/publication/publication.repository';
import { api, cleanParams } from '../http/api';

interface PublicationApiResponse {
  id: number;
  title: string;
  content?: string | null;
  type: Publication['type'];
  status?: string | null;
  displaySeconds?: number | null;
  originalDurationSeconds?: number | null;
  linkUrl?: string | null;
  mediaId?: number | null;
  mediaFileId?: number | null;
  media?: { id?: number | null } | null;
  createdByName?: string;
  programNames?: string[] | null;
  createdAt?: string;
}

const toPublication = (r: PublicationApiResponse): Publication => ({
  id: r.id,
  title: r.title,
  content: r.content ?? null,
  type: r.type,
  status: r.status ?? '',
  displaySeconds: r.displaySeconds ?? null,
  originalDurationSeconds: r.originalDurationSeconds ?? null,
  linkUrl: r.linkUrl ?? null,
  mediaId: r.mediaId ?? r.mediaFileId ?? r.media?.id ?? null,
  createdByName: r.createdByName,
  programNames: r.programNames ?? [],
  createdAt: r.createdAt,
});

@Injectable()
export class HttpPublicationRepository extends PublicationRepository {
  private http = inject(HttpClient);

  list(filter: PublicationFilter = {}): Observable<Publication[]> {
    return this.http
      .get<PublicationApiResponse[]>(api('/publications'), { params: cleanParams({ status: filter.status, type: filter.type }) })
      .pipe(map(l => l.map(toPublication)));
  }

  get(id: number): Observable<Publication> {
    return this.http.get<PublicationApiResponse>(api(`/publications/${id}`)).pipe(map(toPublication));
  }

  /** multipart/form-data, conforme o contrato da API. */
  create(input: NewPublication): Observable<Publication> {
    const form = new FormData();
    form.append('title', input.title.trim());
    form.append('type', input.type);
    if (input.type === 'MESSAGE' && input.content) form.append('content', input.content);
    if (input.type !== 'MESSAGE' && input.displaySeconds) form.append('displaySeconds', String(input.displaySeconds));
    if (input.type === 'VIDEO' && input.originalDurationSeconds) form.append('originalDurationSeconds', String(input.originalDurationSeconds));
    if (input.type === 'LINK' && input.linkUrl) form.append('linkUrl', input.linkUrl);
    if ((input.type === 'IMAGE' || input.type === 'VIDEO') && input.file) form.append('file', input.file);
    return this.http.post<PublicationApiResponse>(api('/publications'), form).pipe(map(toPublication));
  }

  update(id: number, changes: PublicationChanges): Observable<Publication> {
    return this.http.patch<PublicationApiResponse>(api(`/publications/${id}`), changes).pipe(map(toPublication));
  }

  publish(id: number): Observable<Publication> {
    return this.http.post<PublicationApiResponse>(api(`/publications/${id}/publish`), {}).pipe(map(toPublication));
  }

  unpublish(id: number): Observable<Publication> {
    return this.http.post<PublicationApiResponse>(api(`/publications/${id}/unpublish`), {}).pipe(map(toPublication));
  }

  delete(id: number): Observable<void> { return this.http.delete<void>(api(`/publications/${id}`)); }
}
