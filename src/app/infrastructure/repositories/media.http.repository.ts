import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, shareReplay } from 'rxjs';
import { MediaRepository } from '@domain/media/media.repository';
import { api } from '../http/api';

@Injectable()
export class HttpMediaRepository extends MediaRepository {
  private http = inject(HttpClient);
  private readonly pendingRequests = new Map<number, Observable<Blob>>();

  blob(mediaId: number): Observable<Blob> {
    const pending = this.pendingRequests.get(mediaId);
    if (pending) return pending;

    const request = this.http.get(api(`/media/${mediaId}`), { responseType: 'blob' }).pipe(
      finalize(() => this.pendingRequests.delete(mediaId)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.pendingRequests.set(mediaId, request);
    return request;
  }
}
