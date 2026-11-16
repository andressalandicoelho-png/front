import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthRepository } from '@domain/auth/auth.repository';
import { api } from '../http/api';

interface AuthApiResponse {
  accessToken?: unknown;
  access_token?: unknown;
  token?: unknown;
}

const accessTokenFrom = (response: unknown): string => {
  if (typeof response !== 'object' || response === null) {
    throw new Error('A resposta da API de autenticação é inválida.');
  }

  const data = response as AuthApiResponse;
  const token = data.accessToken ?? data.access_token ?? data.token;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('A resposta da API de autenticação não contém um token válido.');
  }
  return token;
};

@Injectable()
export class HttpAuthRepository extends AuthRepository {
  private http = inject(HttpClient);

  login(email: string, password: string): Observable<string> {
    return this.http.post<unknown>(api('/auth/login'), { email, password }).pipe(map(accessTokenFrom));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(api('/users/me/password'), { currentPassword, newPassword });
  }
}
