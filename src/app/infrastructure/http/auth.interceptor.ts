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

  let authReq = req;
  if (isApi && !isPublic && token) {
    authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

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
