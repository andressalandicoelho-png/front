import { Component, HostListener, input, output, signal } from '@angular/core';
import { Publication } from '@domain/publication/publication.entity';
import { typeLabel } from '@presentation/core/format';
import { IconComponent } from '../shared/icon.component';
import { SecureMediaComponent } from '../shared/secure-media.component';

@Component({
  selector: 'app-publication-grid',
  imports: [IconComponent, SecureMediaComponent],
  template: `
    <section class="photo-grid" [style.grid-template-columns]="'repeat(' + columns() + ', minmax(0, 1fr))'" [style.--publication-grid-rows]="rowCount()">
      @for (p of publications(); track p.id) {
        <article class="tile">
          <div class="tile-toolbar">
            <span class="tile-format"><app-icon [name]="formatIcon(p.type)" [size]="14"/>{{ label(p.type) }}</span>
            <button type="button" class="tile-menu-trigger" aria-label="Mais opções do conteúdo" aria-haspopup="menu" [attr.aria-expanded]="openActionsId() === p.id" (click)="toggleActions(p.id, $event)">
              <app-icon name="more" [size]="18"/>
            </button>
            @if (openActionsId() === p.id) {
              <div class="tile-menu" role="menu" (click)="$event.stopPropagation()">
                <button type="button" role="menuitem" (click)="openActionsId.set(null); editRequested.emit(p)"><app-icon name="edit" [size]="15"/> Editar</button>
                <button type="button" role="menuitem" (click)="openActionsId.set(null); publishToggleRequested.emit(p)">
                  @if (isPublished(p)) { <app-icon name="pause" [size]="15"/> Pausar }
                  @else { <app-icon name="play" [size]="15"/> Publicar }
                </button>
                <button type="button" role="menuitem" class="danger" (click)="openActionsId.set(null); deleteRequested.emit(p)"><app-icon name="trash" [size]="15"/> Excluir</button>
              </div>
            }
          </div>
          <div class="tile-media">
            @if (p.type === 'MESSAGE') {
              <div class="tile-message-preview"><strong>{{ p.title }}</strong><p>{{ p.content }}</p></div>
            } @else {
              <app-secure-media [mediaId]="p.mediaId" [type]="p.type"/>
            }
          </div>
          <div class="tile-info">
            <div class="tile-copy">
              <strong class="title" [title]="p.title">{{ p.title }}</strong>
              <small class="tile-author">Por {{ p.createdByName || 'autor não informado' }}</small>
            </div>
          </div>
          <div class="tile-meta">
            <small class="tile-format-duration">{{ durationLabel(p) }}</small>
            <span class="status" [class.live]="isPublished(p)">{{ contentStatusLabel(p) }}</span>
          </div>
          <div class="tile-attribution" [title]="programNamesTooltip(p)">
            <app-icon name="layers" [size]="12"/>
            <small>{{ programUsage(p) }}</small>
          </div>
        </article>
      } @empty {
        <div class="empty wide">
          <p>@if (search()) { Nenhum resultado. Ajuste a busca ou os filtros. } @else { Biblioteca vazia. }</p>
          <button class="btn primary" type="button" (click)="createRequested.emit()">Novo conteúdo</button>
        </div>
      }
    </section>
  `,
})
export class PublicationGridComponent {
  publications = input.required<Publication[]>();
  columns = input.required<number>();
  rowCount = input.required<number>();
  search = input('');

  editRequested = output<Publication>();
  publishToggleRequested = output<Publication>();
  deleteRequested = output<Publication>();
  createRequested = output<void>();

  openActionsId = signal<number | null>(null);

  @HostListener('document:click')
  closeActions(): void { this.openActionsId.set(null); }

  @HostListener('document:keydown.escape')
  closeActionsOnEscape(): void { this.openActionsId.set(null); }

  toggleActions(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openActionsId.update(current => {
      if (current === id) return null;
      return id;
    });
  }

  label(type: string): string { return typeLabel[type] ?? type; }
  formatIcon(type: string): string {
    if (type === 'MESSAGE') return 'info';
    if (type === 'LINK') return 'link';
    if (type === 'VIDEO') return 'video';
    return 'image';
  }
  durationLabel(publication: Publication): string {
    if (publication.type === 'MESSAGE') return 'Fixa durante o horário agendado';
    return `${this.label(publication.type)} · ${publication.displaySeconds ?? publication.originalDurationSeconds ?? 10} s`;
  }
  isPublished(publication: Publication): boolean {
    return ['PUBLISHED', 'READY'].includes(publication.status.toUpperCase());
  }
  contentStatusLabel(publication: Publication): string {
    const status = publication.status.toUpperCase();
    if (status === 'DRAFT') return 'Rascunho';
    if (status === 'EXPIRED') return 'Expirado';
    if (this.isPublished(publication)) return 'No ar';
    return 'Agendado';
  }
  programUsage(publication: Publication): string {
    const names = publication.programNames ?? [];
    if (!names.length) return 'Ainda não usado em programações';
    let programLabel = 'programações';
    if (names.length === 1) programLabel = 'programação';
    return `Usado em ${names.length} ${programLabel}`;
  }
  programNamesTooltip(publication: Publication): string {
    return (publication.programNames ?? []).join(', ') || 'Ainda não usado em programações';
  }
}
