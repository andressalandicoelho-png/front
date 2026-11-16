import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ChangeUserRolesUseCase, CreateUserUseCase, ListUsersUseCase, SetUserActiveUseCase,
} from '@application/user/user.usecases';
import { Role, User } from '@domain/user/user.entity';
import { errorMessage } from '@presentation/core/error-message';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/shared/icon.component';
import { ModalComponent } from '@presentation/ui/shared/modal.component';

@Component({
  selector: 'app-users',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <section class="card">
      <div class="user-list-toolbar">
        <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="18"/> Novo usuário</button>
      </div>
      @if (usersLoading() && !users().length) {
        <div class="empty" role="status"><p>Carregando usuários…</p></div>
      } @else if (loadError() && !users().length) {
        <div class="empty" role="alert">
          <p>{{ loadError() }}</p>
          <button class="link-button" type="button" (click)="load()">Tentar novamente</button>
        </div>
      } @else {
        @if (loadError()) {
          <div class="notice error-notice" role="alert">
            {{ loadError() }} <button class="link-button" type="button" (click)="load()">Tentar novamente</button>
          </div>
        }
        @if (usersLoading()) { <p class="muted" role="status">Atualizando usuários…</p> }
        @for (u of users(); track u.id) {
          <div class="row">
            <span class="avatar">{{ u.name[0] }}</span>
            <div class="grow">
              <div class="title">{{ u.name }}</div>
              <div class="muted">{{ u.email }}</div>
            </div>
            <select class="input slim" [ngModel]="roleOf(u)" (ngModelChange)="setRole(u, $event)" aria-label="Papel">
              <option value="EDITOR">Editor</option><option value="ADMIN">Administrador</option>
            </select>
            <button class="btn small" type="button" (click)="toggleActive(u)">
              @if (u.active) { Desativar } @else { Reativar }
            </button>
          </div>
        } @empty {
          @if (!usersLoading()) { <div class="empty"><p>Nenhum usuário cadastrado.</p></div> }
        }
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
  usersLoading = signal(false);
  loadError = signal('');
  modal = signal(false);
  error = signal('');
  form = { name: '', email: '', password: '', role: 'EDITOR' as Role };
  private loadRequestId = 0;

  ngOnInit(): void { this.load(); }
  load(): void {
    const requestId = ++this.loadRequestId;
    this.usersLoading.set(true);
    this.loadError.set('');
    this.listUC.execute().subscribe({
      next: users => {
        if (requestId !== this.loadRequestId) return;
        this.users.set(users);
        this.usersLoading.set(false);
      },
      error: error => {
        if (requestId !== this.loadRequestId) return;
        this.loadError.set(errorMessage(error));
        this.usersLoading.set(false);
      },
      complete: () => {
        if (requestId === this.loadRequestId) this.usersLoading.set(false);
      },
    });
  }

  openNew(): void { this.form = { name: '', email: '', password: '', role: 'EDITOR' }; this.error.set(''); this.modal.set(true); }

  roleOf(user: User): Role {
    if (user.roles.includes('ADMIN')) return 'ADMIN';
    return 'EDITOR';
  }

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
      next: () => {
        if (u.active) this.toast.show('Usuário desativado');
        else this.toast.show('Usuário reativado');
        this.load();
      },
      error: e => this.toast.show(errorMessage(e)),
    });
  }
}
