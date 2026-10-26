import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MediaRepository } from '@domain/media/media.repository';
import { api } from '../http/api';

@Injectable()
export class HttpMediaRepository extends MediaRepository {
  private http = inject(HttpClient);
  blob(mediaId: number): Observable<Blob> {
    return this.http.get(api(`/media/${mediaId}`), { responseType: 'blob' });
  }
}
