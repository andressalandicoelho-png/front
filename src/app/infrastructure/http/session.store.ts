import { Injectable } from '@angular/core';
import { SessionStore } from '@domain/auth/auth.repository';

const KEY = 'tvcampus.token';

@Injectable()
export class LocalSessionStore extends SessionStore {
  getToken(): string | null { return localStorage.getItem(KEY); }
  setToken(token: string): void { localStorage.setItem(KEY, token); }
  clear(): void { localStorage.removeItem(KEY); }
}
