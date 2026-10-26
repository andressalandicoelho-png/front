import { Observable } from 'rxjs';

export abstract class MediaRepository {
  /** Baixa a mídia protegida (exige autenticação). */
  abstract blob(mediaId: number): Observable<Blob>;
}
