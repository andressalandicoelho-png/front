import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { NewUser, Role, User } from '@domain/user/user.entity';
import { UserRepository } from '@domain/user/user.repository';
import { api } from '../http/api';

interface UserApiResponse {
  id: number;
  name: string;
  email: string;
  roles?: Role[] | null;
  active?: boolean | null;
}

const toUser = (r: UserApiResponse): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  roles: r.roles ?? [],
  active: r.active ?? true,
});

@Injectable()
export class HttpUserRepository extends UserRepository {
  private http = inject(HttpClient);

  me(): Observable<User> { return this.http.get<UserApiResponse>(api('/users/me')).pipe(map(toUser)); }

  list(): Observable<User[]> { return this.http.get<UserApiResponse[]>(api('/users')).pipe(map(l => l.map(toUser))); }

  create(input: NewUser): Observable<User> { return this.http.post<UserApiResponse>(api('/users'), input).pipe(map(toUser)); }

  updateRoles(id: number, roles: Role[]): Observable<User> {
    return this.http.patch<UserApiResponse>(api(`/users/${id}/roles`), { roles }).pipe(map(toUser));
  }

  setActive(id: number, active: boolean): Observable<User> {
    return this.http.patch<UserApiResponse>(api(`/users/${id}/active`), { active }).pipe(map(toUser));
  }
}
