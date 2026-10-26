import { Injectable, inject } from '@angular/core';
import { NewUser, Role } from '@domain/user/user.entity';
import { UserRepository } from '@domain/user/user.repository';

@Injectable({ providedIn: 'root' })
export class ListUsersUseCase {
  private repo = inject(UserRepository);
  execute() { return this.repo.list(); }
}

@Injectable({ providedIn: 'root' })
export class CreateUserUseCase {
  private repo = inject(UserRepository);
  execute(input: NewUser) { return this.repo.create(input); }
}

@Injectable({ providedIn: 'root' })
export class ChangeUserRolesUseCase {
  private repo = inject(UserRepository);
  execute(id: number, roles: Role[]) { return this.repo.updateRoles(id, roles); }
}

@Injectable({ providedIn: 'root' })
export class SetUserActiveUseCase {
  private repo = inject(UserRepository);
  execute(id: number, active: boolean) { return this.repo.setActive(id, active); }
}

@Injectable({ providedIn: 'root' })
export class GeneratePlayerTokenUseCase {
  private repo = inject(UserRepository);
  execute() { return this.repo.generatePlayerToken(); }
}
