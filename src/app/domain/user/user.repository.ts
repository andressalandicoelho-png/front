import { Observable } from 'rxjs';
import { NewUser, Role, User } from './user.entity';

export abstract class UserRepository {
  abstract me(): Observable<User>;
  abstract generatePlayerToken(): Observable<string>;
  abstract list(): Observable<User[]>;
  abstract create(input: NewUser): Observable<User>;
  abstract updateRoles(id: number, roles: Role[]): Observable<User>;
  abstract setActive(id: number, active: boolean): Observable<User>;
}
