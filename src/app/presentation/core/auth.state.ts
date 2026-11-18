import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { LoginUseCase, LogoutUseCase, GetCurrentUserUseCase } from '@application/auth/auth.usecases';
import { ProgramPlayerTokenStore, SessionStore } from '@domain/auth/auth.repository';
import { User, isAdmin } from '@domain/user/user.entity';

/** Estado de sessão da UI. Orquestra os casos de uso; não conhece HTTP. */
@Injectable({ providedIn: 'root' })
export class AuthState {
  private loginUC = inject(LoginUseCase);
  private logoutUC = inject(LogoutUseCase);
  private meUC = inject(GetCurrentUserUseCase);
  private store = inject(SessionStore);
  private programPlayerTokens = inject(ProgramPlayerTokenStore);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => isAdmin(this.user()));
  readonly restoreError = signal('');

  login(email: string, password: string): Observable<User> {
    return this.loginUC.execute(email, password).pipe(tap(u => this.setUser(u)));
  }

  restore(): Observable<boolean> {
    if (!this.store.getToken()) {
      this.restoreError.set('');
      return of(false);
    }
    if (this.user()) return of(true);
    return this.meUC.execute().pipe(
      tap(u => this.setUser(u)),
      map(() => true),
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.logoutUC.execute();
          this.user.set(null);
          this.restoreError.set('');
        } else {
          this.restoreError.set('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.');
        }
        return of(false);
      }),
    );
  }

  getProgramPlayerToken(programId: number): string | null {
    const user = this.user();
    if (!user) return null;
    return this.programPlayerTokens.get(user.id, programId);
  }

  setProgramPlayerToken(programId: number, token: string): void {
    const user = this.user();
    if (user) this.programPlayerTokens.set(user.id, programId, token);
  }

  private setUser(user: User): void {
    this.restoreError.set('');
    this.user.set(user);
  }

  logout(): void {
    this.logoutUC.execute();
    this.user.set(null);
    this.restoreError.set('');
    this.router.navigate(['/login']);
  }
}
