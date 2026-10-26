import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { NewUser, Role, User } from '@domain/user/user.entity';
import { UserRepository } from '@domain/user/user.repository';
import { api } from '../http/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toUser = (r: any): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  roles: r.roles ?? [],
  active: r.active ?? true,
  playerToken: r.playerToken ?? null,
});

@Injectable()
export class HttpUserRepository extends UserRepository {
  private http = inject(HttpClient);

  me(): Observable<User> { return this.http.get<any>(api('/users/me')).pipe(map(toUser)); }

  generatePlayerToken(): Observable<string> {
    return this.http.post<any>(api('/users/me/player-token'), {}).pipe(
      map(r => (typeof r === 'string' ? r : r.playerToken ?? r.token)),
    );
  }

  list(): Observable<User[]> { return this.http.get<any[]>(api('/users')).pipe(map(l => l.map(toUser))); }

  create(input: NewUser): Observable<User> { return this.http.post<any>(api('/users'), input).pipe(map(toUser)); }

  updateRoles(id: number, roles: Role[]): Observable<User> {
    return this.http.patch<any>(api(`/users/${id}/roles`), { roles }).pipe(map(toUser));
  }

  setActive(id: number, active: boolean): Observable<User> {
    return this.http.patch<any>(api(`/users/${id}/active`), { active }).pipe(map(toUser));
  }
}
