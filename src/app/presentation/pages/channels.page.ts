import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateChannelUseCase, ListChannelsUseCase, UpdateChannelUseCase } from '@application/channel/channel.usecases';
import { Channel } from '@domain/channel/channel.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';

@Component({
  selector: 'app-channels',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Canais</h1><p class="muted">Cada canal é uma TV ou um grupo de TVs.</p></div>
      @if (isAdmin()) { <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="18"/> Novo canal</button> }
    </header>

    <section class="card">
      @for (c of channels(); track c.id) {
        <div class="row">
          <span class="ring small" [class.off]="!c.active"><span class="ring-in"><app-icon name="tv" [size]="20"/></span></span>
          <div class="grow">
            <div class="title">{{ c.name }}</div>
            <div class="muted">{{ c.description || 'Sem descrição' }}</div>
          </div>
          <span class="status" [class.live]="c.active">{{ c.active ? 'Ativo' : 'Inativo' }}</span>
          @if (isAdmin()) {
            <button class="icon-btn" type="button" aria-label="Editar" (click)="openEdit(c)"><app-icon name="edit" [size]="20"/></button>
          }
        </div>
      } @empty {
        <div class="empty"><p>Nenhum canal cadastrado.</p></div>
      }
    </section>

    @if (modal()) {
      <app-modal [title]="editing() ? 'Editar canal' : 'Novo canal'" (closed)="modal.set(false)">
        <form class="stack" (ngSubmit)="save()">
          <input class="input" name="name" placeholder="Nome (ex.: TV Refeitório)" [(ngModel)]="form.name" required>
          <input class="input" name="desc" placeholder="Descrição (ex.: Segundo andar)" [(ngModel)]="form.description">
          @if (editing()) {
            <label class="switch"><input type="checkbox" name="active" [(ngModel)]="form.active"> Canal ativo</label>
          }
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn primary block" type="submit" [disabled]="!form.name.trim()">Salvar</button>
        </form>
      </app-modal>
    }
  `,
})
export class ChannelsPage implements OnInit {
  private listUC = inject(ListChannelsUseCase);
  private createUC = inject(CreateChannelUseCase);
  private updateUC = inject(UpdateChannelUseCase);
  private toast = inject(ToastService);
  private auth = inject(AuthState);
  isAdmin = this.auth.isAdmin;

  channels = signal<Channel[]>([]);
  modal = signal(false);
  editing = signal<Channel | null>(null);
  error = signal('');
  form = { name: '', description: '', active: true };

  ngOnInit(): void { this.load(); }
  load(): void { this.listUC.execute().subscribe(l => this.channels.set(l)); }

  openNew(): void { this.editing.set(null); this.form = { name: '', description: '', active: true }; this.error.set(''); this.modal.set(true); }
  openEdit(c: Channel): void {
    this.editing.set(c);
    this.form = { name: c.name, description: c.description ?? '', active: c.active };
    this.error.set('');
    this.modal.set(true);
  }

  save(): void {
    const current = this.editing();
    const description = this.form.description.trim() || null;
    const request = current
      ? this.updateUC.execute(current.id, { name: this.form.name.trim(), description, active: this.form.active })
      : this.createUC.execute({ name: this.form.name.trim(), description });
    request.subscribe({
      next: () => { this.modal.set(false); this.toast.show(current ? 'Canal atualizado' : 'Canal criado'); this.load(); },
      error: e => this.error.set(errorMessage(e)),
    });
  }
}
