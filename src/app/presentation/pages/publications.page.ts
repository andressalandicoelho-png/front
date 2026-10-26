import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CreatePublicationUseCase, DeletePublicationUseCase, ListPublicationsUseCase,
  PublishPublicationUseCase, UnpublishPublicationUseCase, UpdatePublicationUseCase,
} from '@application/publication/publication.usecases';
import { Publication, PublicationType } from '@domain/publication/publication.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { ToastService } from '@presentation/core/toast.service';
import { typeLabel } from '@presentation/core/format';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';

@Component({
  selector: 'app-publications',
  imports: [FormsModule, IconComponent, ModalComponent, SecureMediaComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Publicações</h1><p class="muted">Imagens, vídeos e links que podem ir para as TVs.</p></div>
      <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="18"/> Nova publicação</button>
    </header>

    <div class="chips">
      @for (t of filters; track t.value) {
        <button type="button" class="chip-btn" [class.on]="typeFilter() === t.value" (click)="typeFilter.set(t.value)">{{ t.label }}</button>
      }
    </div>

    <section class="photo-grid">
      @for (p of visible(); track p.id) {
        <article class="tile">
          <div class="tile-media">
            <app-secure-media [mediaId]="p.mediaId" [type]="p.type"/>
            <span class="tile-type"><app-icon [name]="p.type === 'LINK' ? 'link' : p.type === 'VIDEO' ? 'video' : 'image'" [size]="16"/></span>
            <div class="tile-actions">
              <button type="button" class="icon-btn light" aria-label="Editar" (click)="openEdit(p)"><app-icon name="edit" [size]="18"/></button>
              <button type="button" class="icon-btn light" aria-label="Excluir" (click)="remove(p)"><app-icon name="trash" [size]="18"/></button>
            </div>
          </div>
          <div class="tile-info">
            <div class="grow">
              <div class="title">{{ p.title }}</div>
              <div class="muted">{{ label(p.type) }} · {{ p.displaySeconds ?? 10 }}s</div>
            </div>
            <span class="status" [class.live]="isPublished(p)">{{ isPublished(p) ? 'Publicada' : p.status || 'Rascunho' }}</span>
          </div>
          <button class="btn block small" type="button" (click)="toggle(p)">{{ isPublished(p) ? 'Despublicar' : 'Publicar' }}</button>
        </article>
      } @empty {
        <div class="empty wide"><p>Nenhuma publicação por aqui. Envie a primeira para montar a programação.</p></div>
      }
    </section>

    @if (modal()) {
      <app-modal [title]="editing() ? 'Editar publicação' : 'Nova publicação'" (closed)="modal.set(false)">
        <form class="stack" (ngSubmit)="save()">
          <input class="input" name="title" placeholder="Título" [(ngModel)]="form.title" required>
          @if (!editing()) {
            <select class="input" name="type" [(ngModel)]="form.type">
              <option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option><option value="LINK">Link</option>
            </select>
            @if (form.type === 'LINK') {
              <textarea class="input" name="link" rows="4" placeholder="Cole uma URL HTTPS ou o código de incorporação" [(ngModel)]="form.linkUrl"></textarea>
            } @else {
              <label class="drop">
                <app-icon name="upload" [size]="26"/>
                <span>{{ form.file ? form.file.name : 'Escolher arquivo (JPEG, PNG, WebP ou MP4 · até 300 MB)' }}</span>
                <input type="file" hidden [accept]="form.type === 'IMAGE' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'" (change)="pick($event)">
              </label>
            }
          }
          <label class="field">Segundos na tela
            <input class="input" type="number" min="1" name="secs" [(ngModel)]="form.displaySeconds" placeholder="10">
          </label>
          @if (form.type === 'VIDEO' && !editing()) {
            <label class="field">Duração original do vídeo (segundos)
              <input class="input" type="number" min="1" name="orig" [(ngModel)]="form.originalDurationSeconds">
            </label>
          }
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn primary block" type="submit" [disabled]="saving()">{{ saving() ? 'Salvando…' : editing() ? 'Salvar alterações' : 'Enviar' }}</button>
        </form>
      </app-modal>
    }
  `,
})
export class PublicationsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private listUC = inject(ListPublicationsUseCase);
  private createUC = inject(CreatePublicationUseCase);
  private updateUC = inject(UpdatePublicationUseCase);
  private publishUC = inject(PublishPublicationUseCase);
  private unpublishUC = inject(UnpublishPublicationUseCase);
  private deleteUC = inject(DeletePublicationUseCase);
  private toast = inject(ToastService);

  filters: { label: string; value: PublicationType | null }[] = [
    { label: 'Tudo', value: null }, { label: 'Imagens', value: 'IMAGE' },
    { label: 'Vídeos', value: 'VIDEO' }, { label: 'Links', value: 'LINK' },
  ];
  items = signal<Publication[]>([]);
  typeFilter = signal<PublicationType | null>(null);
  visible = computed(() => this.items().filter(p => !this.typeFilter() || p.type === this.typeFilter()));
  modal = signal(false);
  editing = signal<Publication | null>(null);
  saving = signal(false);
  error = signal('');
  form = this.blank();

  private blank() {
    return {
      title: '', type: 'IMAGE' as PublicationType, linkUrl: '', file: undefined as File | undefined,
      displaySeconds: null as number | null, originalDurationSeconds: null as number | null,
    };
  }

  ngOnInit(): void {
    this.load();
    if (this.route.snapshot.routeConfig?.path === 'post') this.openNew();
  }
  load(): void { this.listUC.execute().subscribe(l => this.items.set(l)); }

  label = (t: string) => typeLabel[t] ?? t;
  isPublished = (p: Publication) => p.status.toUpperCase() === 'PUBLISHED';

  openNew(): void { this.editing.set(null); this.form = this.blank(); this.error.set(''); this.modal.set(true); }
  openEdit(p: Publication): void {
    this.editing.set(p);
    this.form = { ...this.blank(), title: p.title, type: p.type, displaySeconds: p.displaySeconds };
    this.error.set('');
    this.modal.set(true);
  }

  pick(ev: Event): void { this.form.file = (ev.target as HTMLInputElement).files?.[0]; }

  save(): void {
    this.error.set('');
    this.saving.set(true);
    const current = this.editing();
    const linkUrl = this.normalizeLinkInput(this.form.linkUrl);
    const request = current
      ? this.updateUC.execute(current.id, {
          title: this.form.title.trim(),
          ...(this.form.displaySeconds ? { displaySeconds: this.form.displaySeconds } : {}),
        })
      : this.createUC.execute({
          title: this.form.title, type: this.form.type, linkUrl, file: this.form.file,
          displaySeconds: this.form.displaySeconds ?? undefined,
          originalDurationSeconds: this.form.originalDurationSeconds ?? undefined,
        });
    request.subscribe({
      next: () => { this.saving.set(false); this.modal.set(false); this.toast.show(current ? 'Publicação atualizada' : 'Publicação enviada'); this.load(); },
      error: e => { this.saving.set(false); this.error.set(errorMessage(e)); },
    });
  }

  private normalizeLinkInput(value: string): string {
    const input = value.trim();
    if (!input.startsWith('<')) return input;
    const document = new DOMParser().parseFromString(input, 'text/html');
    return document.querySelector('iframe')?.getAttribute('src')?.trim() ?? input;
  }

  toggle(p: Publication): void {
    const op = this.isPublished(p) ? this.unpublishUC.execute(p.id) : this.publishUC.execute(p.id);
    op.subscribe({
      next: () => { this.toast.show(this.isPublished(p) ? 'Despublicada' : 'Publicada'); this.load(); },
      error: e => this.toast.show(errorMessage(e)),
    });
  }

  remove(p: Publication): void {
    if (!confirm(`Excluir "${p.title}"? Ela sai de todos os agendamentos.`)) return;
    this.deleteUC.execute(p.id).subscribe({
      next: () => { this.toast.show('Publicação excluída'); this.load(); },
      error: e => this.toast.show(errorMessage(e)),
    });
  }
}
