import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { SessionStore } from '@domain/auth/auth.repository';

/** Anexa o token às chamadas da API (exceto /player/*, que usa o token na URL) e trata 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const isApi = req.url.startsWith(environment.apiUrl);
  const isPublic = req.url.includes('/player/') || req.url.endsWith('/auth/login');
  const token = session.getToken();

  const authReq = isApi && !isPublic && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isApi && !isPublic) {
        session.clear();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

/** Converte erros HTTP em mensagens legíveis. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join(' ');
    if (typeof msg === 'string') return msg;
    if (err.status === 0) return 'Não foi possível falar com o servidor.';
    if (err.status === 401) return 'E-mail ou senha incorretos.';
    if (err.status === 403) return 'Você não tem permissão para isso.';
    if (err.status === 404) return 'Item não encontrado.';
  }
  return err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.';
}
