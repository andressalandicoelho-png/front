import { Observable } from 'rxjs';

export abstract class AuthRepository {
  /** Autentica e devolve o token de acesso. */
  abstract login(email: string, password: string): Observable<string>;
  abstract changePassword(currentPassword: string, newPassword: string): Observable<void>;
}

/** Porta de armazenamento da sessão (implementada na infraestrutura). */
export abstract class SessionStore {
  abstract getToken(): string | null;
  abstract setToken(token: string): void;
  abstract clear(): void;
}

export abstract class ProgramPlayerTokenStore {
  abstract get(userId: number, programId: number): string | null;
  abstract set(userId: number, programId: number, token: string): void;
}
