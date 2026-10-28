import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { AuthRepository, SessionStore } from '@domain/auth/auth.repository';
import { User } from '@domain/user/user.entity';
import { UserRepository } from '@domain/user/user.repository';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private auth = inject(AuthRepository);
  private session = inject(SessionStore);
  private users = inject(UserRepository);

  execute(email: string, password: string): Observable<User> {
    return this.auth.login(email.trim(), password).pipe(
      tap(token => this.session.setToken(token)),
      switchMap(() => this.users.me()),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class LogoutUseCase {
  private session = inject(SessionStore);
  execute(): void { this.session.clear(); }
}

@Injectable({ providedIn: 'root' })
export class GetCurrentUserUseCase {
  private users = inject(UserRepository);
  execute(): Observable<User> { return this.users.me(); }
}

@Injectable({ providedIn: 'root' })
export class ChangeOwnPasswordUseCase {
  private auth = inject(AuthRepository);
  execute(currentPassword: string, newPassword: string): Observable<void> {
    return this.auth.changePassword(currentPassword, newPassword);
  }
}
