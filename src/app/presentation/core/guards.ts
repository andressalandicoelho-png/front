import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthState } from './auth.state';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthState);
  const router = inject(Router);
  return auth.restore().pipe(map(ok => (ok ? true : router.createUrlTree(['/login']))));
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthState);
  const router = inject(Router);
  return auth.restore().pipe(map(ok => (ok && auth.isAdmin() ? true : router.createUrlTree(['/']))));
};
