import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthRepository } from '@domain/auth/auth.repository';
import { api } from '../http/api';

@Injectable()
export class HttpAuthRepository extends AuthRepository {
  private http = inject(HttpClient);

  login(email: string, password: string): Observable<string> {
    return this.http.post<Record<string, string>>(api('/auth/login'), { email, password }).pipe(
      map(res => res['accessToken'] ?? res['access_token'] ?? res['token']),
    );
  }
}
