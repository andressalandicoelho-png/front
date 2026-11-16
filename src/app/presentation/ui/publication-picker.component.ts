import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { displayDurationSeconds, Publication, PublicationType } from '@domain/publication/publication.entity';
import { publicationTypeName } from '@presentation/formatters/publication-type-name';
import { IconComponent } from './icon.component';
import { PublicationSelectionItemComponent } from './publication-selection-item.component';

@Component({
  selector: 'app-publication-picker',
  imports: [FormsModule, IconComponent, PublicationSelectionItemComponent],
  styles: [':host { display: flex; min-height: 0; flex: 1; flex-direction: column; }'],
  template: `
    <div class="add-content-library-head"><div><strong>Conteúdos publicados</strong></div></div>
    <div class="add-content-filters" role="search">
      <label class="search-field search-field--icon">
        <app-icon name="search" [size]="17"/>
        <input class="input" type="search" aria-label="Buscar conteúdo por título" placeholder="Buscar por título"
          [ngModel]="search()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="search.set($event)">
      </label>
      <select class="input" aria-label="Filtrar por formato"
        [ngModel]="typeFilter()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="typeFilter.set($event)">
        <option value="ALL">Todos os formatos</option>
        <option value="IMAGE">Imagem</option>
        <option value="VIDEO">Vídeo</option>
        <option value="LINK">Link</option>
        <option value="MESSAGE">Mensagem</option>
      </select>
    </div>
    <div class="add-content-meta">
      <span class="add-content-count" aria-live="polite">
        <strong>{{ filteredPublications().length }}</strong>
        {{ filteredPublications().length === 1 ? 'resultado' : 'resultados' }}
      </span>
      <span class="add-content-hint">Selecione um ou mais itens</span>
    </div>
    @if (loading()) {
      <div class="add-content-empty empty-state" role="status"><strong>Carregando conteúdos publicados…</strong></div>
    } @else if (loadError()) {
      <div class="add-content-empty empty-state" role="alert">
        <strong>Não foi possível carregar os conteúdos.</strong>
        <span>{{ loadError() }}</span>
        <button class="link-button" type="button" (click)="retryRequested.emit()">Tentar novamente</button>
      </div>
    } @else {
      <div class="add-content-list" role="list" aria-label="Conteúdos disponíveis">
        @for (publication of filteredPublications(); track publication.id) {
          <app-publication-selection-item
            [publication]="publication"
            [checked]="selectedIds().includes(publication.id)"
            [disabled]="selectionDisabled() || alreadyAdded()"
            [selected]="selectedIds().includes(publication.id)"
            [alreadyAdded]="alreadyAdded()"
            [badge]="alreadyAdded() ? 'Na programação' : 'Publicado'"
            [description]="description(publication)"
            [status]="alreadyAdded() ? 'Na programação' : selectedIds().includes(publication.id) ? 'Selecionado' : 'Disponível'"
            (selectionChanged)="selectionChanged.emit({ publicationId: publication.id, checked: $event })"/>
        } @empty {
          <div class="add-content-empty empty-state">
            <app-icon name="search" [size]="18"/>
            <strong>{{ publications().length ? 'Nenhum resultado para esta busca' : 'Nenhum conteúdo publicado disponível' }}</strong>
            <span>{{ publications().length ? 'Tente outro título ou ajuste os filtros.' : 'Publique conteúdos na biblioteca antes de adicioná-los à programação.' }}</span>
            @if (hasFilters()) {
              <button class="link-button" type="button" (click)="clearFilters()">Limpar filtros</button>
            }
          </div>
        }
      </div>
    }
    <div class="add-content-footer">
      <div class="add-content-selection">
        <strong>{{ selectedIds().length }} {{ selectedIds().length === 1 ? 'conteúdo selecionado' : 'conteúdos selecionados' }}</strong>
        <button type="button" class="link-button" [disabled]="!selectedIds().length || selectionDisabled()" (click)="clearSelectionRequested.emit()">Limpar seleção</button>
        <small>{{ selectedSummary() || 'Selecione conteúdos.' }}</small>
        <ng-content select="[picker-selection-details]"/>
      </div>
      <div class="actions">
        <button class="btn" type="button" [disabled]="cancelDisabled()" (click)="cancelled.emit()">Cancelar</button>
        <button class="btn primary" type="submit" [disabled]="confirmDisabled() || selectionDisabled() || !selectedIds().length">
          {{ confirmLabel() }}
        </button>
      </div>
    </div>
  `,
})
export class PublicationPickerComponent {
  publications = input.required<Publication[]>();
  selectedIds = input<number[]>([]);
  loading = input(false);
  loadError = input('');
  selectionDisabled = input(false);
  alreadyAdded = input(false);
  cancelDisabled = input(false);
  confirmDisabled = input(false);
  confirmLabel = input('Adicionar conteúdos');

  selectionChanged = output<{ publicationId: number; checked: boolean }>();
  clearSelectionRequested = output<void>();
  retryRequested = output<void>();
  cancelled = output<void>();

  search = signal('');
  typeFilter = signal<'ALL' | PublicationType>('ALL');

  filteredPublications = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const type = this.typeFilter();
    return this.publications().filter(publication =>
      (!query || publication.title.toLocaleLowerCase().includes(query)) &&
      (type === 'ALL' || publication.type === type),
    );
  });
  selectedSummary = computed(() => {
    const publicationsById = new Map(this.publications().map(publication => [publication.id, publication]));
    return this.selectedIds()
      .flatMap(id => {
        const publication = publicationsById.get(id);
        return publication ? [publication.title] : [];
      })
      .join(' · ');
  });

  hasFilters(): boolean {
    return !!this.search().trim() || this.typeFilter() !== 'ALL';
  }

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set('ALL');
  }

  description(publication: Publication): string {
    return publication.type === 'MESSAGE'
      ? 'Fixa durante o horário agendado'
      : `${publicationTypeName(publication.type)} · ${displayDurationSeconds(publication.type, publication.displaySeconds, publication.originalDurationSeconds)} s`;
  }
}
