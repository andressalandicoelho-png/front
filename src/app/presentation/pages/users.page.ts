import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ChangeUserRolesUseCase, CreateUserUseCase, ListUsersUseCase, SetUserActiveUseCase,
} from '@application/user/user.usecases';
import { Role, User } from '@domain/user/user.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';

@Component({
  selector: 'app-users',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Usuários</h1><p class="muted">Quem pode editar e administrar o sistema.</p></div>
      <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="18"/> Novo usuário</button>
    </header>

    <section class="card">
      @for (u of users(); track u.id) {
        <div class="row">
          <span class="avatar">{{ u.name[0] }}</span>
          <div class="grow">
            <div class="title">{{ u.name }}</div>
            <div class="muted">{{ u.email }}</div>
          </div>
          <select class="input slim" [ngModel]="u.roles.includes('ADMIN') ? 'ADMIN' : 'EDITOR'" (ngModelChange)="setRole(u, $event)" aria-label="Papel">
            <option value="EDITOR">Editor</option><option value="ADMIN">Administrador</option>
          </select>
          <button class="btn small" type="button" (click)="toggleActive(u)">{{ u.active ? 'Desativar' : 'Reativar' }}</button>
        </div>
      } @empty {
        <div class="empty"><p>Nenhum usuário encontrado.</p></div>
      }
    </section>

    @if (modal()) {
      <app-modal title="Novo usuário" (closed)="modal.set(false)">
        <form class="stack" (ngSubmit)="create()">
          <input class="input" name="name" placeholder="Nome" [(ngModel)]="form.name" required>
          <input class="input" name="email" type="email" placeholder="E-mail" [(ngModel)]="form.email" required>
          <input class="input" name="password" type="password" placeholder="Senha" [(ngModel)]="form.password" required>
          <select class="input" name="role" [(ngModel)]="form.role">
            <option value="EDITOR">Editor — cuida do conteúdo</option>
            <option value="ADMIN">Administrador — acesso total</option>
          </select>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn primary block" type="submit" [disabled]="!form.name || !form.email || !form.password">Criar usuário</button>
        </form>
      </app-modal>
    }
  `,
})
export class UsersPage implements OnInit {
  private listUC = inject(ListUsersUseCase);
  private createUC = inject(CreateUserUseCase);
  private rolesUC = inject(ChangeUserRolesUseCase);
  private activeUC = inject(SetUserActiveUseCase);
  private toast = inject(ToastService);

  users = signal<User[]>([]);
  modal = signal(false);
  error = signal('');
  form = { name: '', email: '', password: '', role: 'EDITOR' as Role };

  ngOnInit(): void { this.load(); }
  load(): void { this.listUC.execute().subscribe(l => this.users.set(l)); }

  openNew(): void { this.form = { name: '', email: '', password: '', role: 'EDITOR' }; this.error.set(''); this.modal.set(true); }

  create(): void {
    this.createUC.execute({ name: this.form.name.trim(), email: this.form.email.trim(), password: this.form.password, roles: [this.form.role] })
      .subscribe({
        next: () => { this.modal.set(false); this.toast.show('Usuário criado'); this.load(); },
        error: e => this.error.set(errorMessage(e)),
      });
  }

  setRole(u: User, role: Role): void {
    this.rolesUC.execute(u.id, [role]).subscribe({
      next: () => { this.toast.show('Papel atualizado'); this.load(); },
      error: e => { this.toast.show(errorMessage(e)); this.load(); },
    });
  }

  toggleActive(u: User): void {
    this.activeUC.execute(u.id, !u.active).subscribe({
      next: () => { this.toast.show(u.active ? 'Usuário desativado' : 'Usuário reativado'); this.load(); },
      error: e => this.toast.show(errorMessage(e)),
    });
  }
}
