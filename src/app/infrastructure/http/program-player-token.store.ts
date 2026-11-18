import { Injectable } from '@angular/core';
import { ProgramPlayerTokenStore } from '@domain/auth/auth.repository';

@Injectable()
export class LocalProgramPlayerTokenStore extends ProgramPlayerTokenStore {
  get(userId: number, programId: number): string | null {
    return localStorage.getItem(this.key(userId, programId));
  }

  set(userId: number, programId: number, token: string): void {
    localStorage.setItem(this.key(userId, programId), token);
  }

  private key(userId: number, programId: number): string {
    return `office-total.program-player-token.${userId}.${programId}`;
  }
}