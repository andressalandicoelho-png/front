import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { LoginUseCase, LogoutUseCase, GetCurrentUserUseCase } from '@application/auth/auth.usecases';
import { SessionStore } from '@domain/auth/auth.repository';
import { User, isAdmin } from '@domain/user/user.entity';

/** Estado de sessão da UI. Orquestra os casos de uso; não conhece HTTP. */
@Injectable({ providedIn: 'root' })
export class AuthState {
  private loginUC = inject(LoginUseCase);
  private logoutUC = inject(LogoutUseCase);
  private meUC = inject(GetCurrentUserUseCase);
  private store = inject(SessionStore);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => isAdmin(this.user()));

  login(email: string, password: string): Observable<User> {
    return this.loginUC.execute(email, password).pipe(tap(u => this.user.set(u)));
  }

  restore(): Observable<boolean> {
    if (!this.store.getToken()) return of(false);
    if (this.user()) return of(true);
    return this.meUC.execute().pipe(
      tap(u => this.user.set(u)),
      map(() => true),
      catchError(() => { this.logoutUC.execute(); return of(false); }),
    );
  }

  setPlayerToken(token: string): void {
    const u = this.user();
    if (u) this.user.set({ ...u, playerToken: token });
  }

  logout(): void {
    this.logoutUC.execute();
    this.user.set(null);
    this.router.navigate(['/login']);
  }
}
