import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthState } from './auth.state';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthState);
  const router = inject(Router);
  return auth.restore().pipe(map(ok => {
    if (ok) return true;
    return router.createUrlTree(['/login']);
  }));
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthState);
  const router = inject(Router);
  return auth.restore().pipe(map(ok => {
    if (ok && auth.isAdmin()) return true;
    return router.createUrlTree(['/']);
  }));
};
