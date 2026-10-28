import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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

type ContentStatusFilter = 'ALL' | 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'EXPIRED';
type PublicationSort = 'NEWEST' | 'OLDEST';

@Component({
  selector: 'app-publications',
  imports: [FormsModule, IconComponent, ModalComponent, SecureMediaComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Conteúdos</h1><p class="muted">Crie, organize e reutilize conteúdos das suas programações.</p></div>
      <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="18"/> Novo conteúdo</button>
    </header>

    <section class="card content-filters">
      <div class="content-filter-row">
        <label class="search-field content-search-field"><app-icon name="search" [size]="16"/><input class="input" type="search" placeholder="Buscar conteúdo ou autor" aria-label="Buscar conteúdo ou autor" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(0)"></label>
        <select class="input content-filter-select" aria-label="Filtrar por formato" [ngModel]="typeFilter() ?? ''" (ngModelChange)="typeFilter.set($event || null); page.set(0)">
          <option value="">Formato: Todos</option>
          <option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option><option value="LINK">Link</option>
        </select>
        <select class="input content-filter-select" aria-label="Filtrar por autor" [ngModel]="authorFilter()" (ngModelChange)="authorFilter.set($event); page.set(0)">
          <option value="">Todos os autores</option>
          @for (author of authors(); track author) { <option [value]="author">{{ author }}</option> }
        </select>
        <select class="input content-filter-select" aria-label="Filtrar por programação" [ngModel]="programFilter()" (ngModelChange)="programFilter.set($event); page.set(0)">
          <option value="">Todas as programações</option>
          @for (program of programs(); track program) { <option [value]="program">{{ program }}</option> }
        </select>
      </div>
      <nav class="content-status-filters" aria-label="Filtrar por status">
        @for (filter of statusFilters; track filter.value) {
          <button type="button" class="content-status-filter" [class.active]="statusFilter() === filter.value" [attr.aria-pressed]="statusFilter() === filter.value" (click)="statusFilter.set(filter.value); page.set(0)">
            {{ filter.label }} <span>{{ statusCount(filter.value) }}</span>
          </button>
        }
      </nav>
    </section>

    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }} <button class="link-button" type="button" (click)="load()">Tentar novamente</button></div> }

    <div class="content-list-toolbar">
      <span>{{ visible().length }} {{ visible().length === 1 ? 'conteúdo' : 'conteúdos' }}</span>
      <label>Ordenar por
        <select class="input" aria-label="Ordenar conteúdos" [ngModel]="sortOrder()" (ngModelChange)="sortOrder.set($event)">
          <option value="NEWEST">Mais recentes</option>
          <option value="OLDEST">Mais antigos</option>
        </select>
      </label>
    </div>

    <section class="photo-grid" [style.grid-template-columns]="'repeat(' + gridColumns() + ', minmax(0, 1fr))'" [style.--publication-grid-rows]="gridRowCount()">
      @for (p of pageItems(); track p.id) {
        <article class="tile">
          <div class="tile-toolbar">
            <span class="tile-format"><app-icon [name]="p.type === 'LINK' ? 'link' : p.type === 'VIDEO' ? 'video' : 'image'" [size]="14"/>{{ label(p.type) }}</span>
            <button type="button" class="tile-menu-trigger" aria-label="Mais opções do conteúdo" aria-haspopup="menu" [attr.aria-expanded]="openActionsId() === p.id" (click)="toggleActions(p.id, $event)">
              <app-icon name="more" [size]="18"/>
            </button>
            @if (openActionsId() === p.id) {
              <div class="tile-menu" role="menu" (click)="$event.stopPropagation()">
                <button type="button" role="menuitem" (click)="openActionsId.set(null); openEdit(p)"><app-icon name="edit" [size]="15"/> Editar</button>
                <button type="button" role="menuitem" (click)="toggleActionsStatus(p)"><app-icon [name]="isPublished(p) ? 'pause' : 'play'" [size]="15"/> {{ isPublished(p) ? 'Pausar' : 'Publicar' }}</button>
                <button type="button" role="menuitem" class="danger" (click)="openActionsId.set(null); remove(p)"><app-icon name="trash" [size]="15"/> Excluir</button>
              </div>
            }
          </div>
          <div class="tile-media">
            <app-secure-media [mediaId]="p.mediaId" [type]="p.type"/>
          </div>
          <div class="tile-info">
            <div class="tile-copy">
              <strong class="title" [title]="p.title">{{ p.title }}</strong>
              <small class="tile-author">Por {{ p.createdByName || 'autor não informado' }}</small>
            </div>
          </div>
          <div class="tile-meta">
            <small class="tile-format-duration">{{ label(p.type) }} <span aria-hidden="true">·</span> {{ p.displaySeconds ?? 10 }} s</small>
            <span class="status" [class.live]="isPublished(p)">{{ contentStatusLabel(p) }}</span>
          </div>
          <div class="tile-attribution" [title]="programNamesTooltip(p)">
            <app-icon name="layers" [size]="14"/>
            <small>{{ programUsage(p) }}</small>
          </div>
        </article>
      } @empty {
        <div class="empty wide"><p>{{ search() ? 'Nenhum conteúdo encontrado. Ajuste a busca ou os filtros.' : 'Sua biblioteca começa aqui. Crie seu primeiro conteúdo.' }}</p><button class="btn primary" type="button" (click)="openNew()">Novo conteúdo</button></div>
      }
    </section>
    @if (visible().length && pageCount() > 1) {
      <footer class="pagination" aria-label="Paginação dos conteúdos">
        <small class="muted">Mostrando {{ page() * pageSize() + 1 }}–{{ page() * pageSize() + pageItems().length }} de {{ visible().length }}</small>
        <div class="actions">
          <button class="btn small" type="button" [disabled]="page() === 0" (click)="previousPage()">Anterior</button>
          <span aria-live="polite">{{ page() + 1 }} de {{ pageCount() }}</span>
          <button class="btn small" type="button" [disabled]="page() + 1 >= pageCount()" (click)="nextPage()">Próxima</button>
        </div>
      </footer>
    }

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
    @if (pendingDelete(); as publication) {
      <app-modal title="Confirmar exclusão de conteúdo" (closed)="pendingDelete.set(null)">
        <div class="confirm-content"><span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span><h2>Excluir “{{ publication.title }}”?</h2><p class="muted">O conteúdo será removido permanentemente da biblioteca e deixará de poder ser agendado.</p>
          <div class="actions"><button class="btn" type="button" (click)="pendingDelete.set(null)">Cancelar</button><button class="btn danger-button" type="button" (click)="confirmRemove(publication)">Excluir conteúdo</button></div>
        </div>
      </app-modal>
    }
  `,
})
export class PublicationsPage implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;
  private listUC = inject(ListPublicationsUseCase);
  private createUC = inject(CreatePublicationUseCase);
  private updateUC = inject(UpdatePublicationUseCase);
  private publishUC = inject(PublishPublicationUseCase);
  private unpublishUC = inject(UnpublishPublicationUseCase);
  private deleteUC = inject(DeletePublicationUseCase);
  private toast = inject(ToastService);

  statusFilters: { label: string; value: ContentStatusFilter }[] = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Rascunho', value: 'DRAFT' },
    { label: 'Agendado', value: 'SCHEDULED' },
    { label: 'No ar', value: 'LIVE' },
    { label: 'Expirado', value: 'EXPIRED' },
  ];
  items = signal<Publication[]>([]);
  typeFilter = signal<PublicationType | null>(null);
  authorFilter = signal('');
  programFilter = signal('');
  statusFilter = signal<ContentStatusFilter>('ALL');
  sortOrder = signal<PublicationSort>('NEWEST');
  search = signal('');
  page = signal(0);
  pageSize = signal(6);
  gridColumns = signal(3);
  gridRowCount = computed(() => Math.max(1, Math.ceil(this.pageItems().length / this.gridColumns())));
  authors = computed(() => [...new Set(this.items().map(item => item.createdByName).filter((name): name is string => !!name))].sort((a, b) => a.localeCompare(b)));
  programs = computed(() => [...new Set(this.items().flatMap(item => item.programNames ?? []))].sort((a, b) => a.localeCompare(b)));
  filteredItems = computed(() => {
    const type = this.typeFilter();
    const query = this.search().trim().toLocaleLowerCase();
    return this.items().filter(p =>
      (!type || p.type === type) &&
      (!this.authorFilter() || p.createdByName === this.authorFilter()) &&
      (!this.programFilter() || p.programNames?.includes(this.programFilter())) &&
      (!query || `${p.title} ${p.createdByName ?? ''}`.toLocaleLowerCase().includes(query)),
    );
  });
  visible = computed(() => {
    const status = this.statusFilter();
    const direction = this.sortOrder() === 'NEWEST' ? -1 : 1;
    return this.filteredItems()
      .filter(item => status === 'ALL' || this.contentStatus(item) === status)
      .sort((a, b) => {
        const dateDifference = Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '');
        return (Number.isNaN(dateDifference) ? 0 : dateDifference) * direction || (a.id - b.id) * direction;
      });
  });
  pageCount = computed(() => Math.max(1, Math.ceil(this.visible().length / this.pageSize())));
  pageItems = computed(() => this.visible().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  modal = signal(false);
  pendingDelete = signal<Publication | null>(null);
  editing = signal<Publication | null>(null);
  saving = signal(false);
  error = signal('');
  openActionsId = signal<number | null>(null);
  form = this.blank();

  private blank() {
    return {
      title: '', type: 'IMAGE' as PublicationType, linkUrl: '', file: undefined as File | undefined,
      displaySeconds: null as number | null, originalDurationSeconds: null as number | null,
    };
  }

  ngOnInit(): void {
    this.updateGridLayout();
    this.load();
    if (this.route.snapshot.routeConfig?.path === 'post') this.openNew();
  }
  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.updateGridLayout());
    this.resizeObserver.observe(this.host.nativeElement);
    this.updateGridLayout();
  }
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
  @HostListener('window:resize')
  updateGridLayout(): void {
    const hostWidth = this.host.nativeElement.getBoundingClientRect().width || window.innerWidth;
    const columns = hostWidth < 560 ? 1 : hostWidth < 850 ? 2 : 3;
    const oldPageSize = this.pageSize();
    const firstItemIndex = this.page() * oldPageSize;
    this.gridColumns.set(columns);

    const pageSize = window.innerWidth <= 650
      ? 6
      : Math.min(6, this.visibleRowsForViewport(columns) * columns);
    if (pageSize !== oldPageSize) {
      this.pageSize.set(pageSize);
      this.page.set(Math.min(Math.floor(firstItemIndex / pageSize), this.pageCount() - 1));
    }
  }
  private visibleRowsForViewport(columns: number): number {
    const maxRows = Math.ceil(6 / columns);
    const availableHeight = window.innerWidth <= 1100
      ? window.innerHeight - 300
      : this.host.nativeElement.querySelector('.photo-grid')?.clientHeight ?? window.innerHeight - 300;
    const minCardHeight = 208;
    const rowGap = 12;
    return Math.max(1, Math.min(maxRows, Math.floor((availableHeight + rowGap) / (minCardHeight + rowGap))));
  }
  load(): void {
    this.listUC.execute().subscribe({
      next: list => {
        this.items.set(list);
        this.page.update(current => Math.min(current, this.pageCount() - 1));
        this.error.set('');
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  previousPage(): void { this.page.update(value => Math.max(0, value - 1)); }
  nextPage(): void { this.page.update(value => Math.min(this.pageCount() - 1, value + 1)); }
  @HostListener('document:click')
  closeActions(): void { this.openActionsId.set(null); }
  @HostListener('document:keydown.escape')
  closeActionsOnEscape(): void { this.openActionsId.set(null); }
  toggleActions(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openActionsId.update(current => current === id ? null : id);
  }
  toggleActionsStatus(publication: Publication): void {
    this.openActionsId.set(null);
    this.toggle(publication);
  }

  label = (t: string) => typeLabel[t] ?? t;
  isPublished = (p: Publication) => ['PUBLISHED', 'READY'].includes(p.status.toUpperCase());
  private contentStatus = (p: Publication): ContentStatusFilter => {
    const status = p.status.toUpperCase();
    if (status === 'DRAFT') return 'DRAFT';
    if (status === 'EXPIRED') return 'EXPIRED';
    if (this.isPublished(p)) return 'LIVE';
    return 'SCHEDULED';
  };
  contentStatusLabel = (p: Publication) => {
    const status = this.contentStatus(p);
    return status === 'DRAFT' ? 'Rascunho' : status === 'EXPIRED' ? 'Expirado' : status === 'LIVE' ? 'No ar' : 'Agendado';
  };
  statusCount = (status: ContentStatusFilter) =>
    status === 'ALL' ? this.filteredItems().length : this.filteredItems().filter(item => this.contentStatus(item) === status).length;
  programUsage = (p: Publication) => {
    const names = p.programNames ?? [];
    return names.length
      ? `Usado em ${names.length} ${names.length === 1 ? 'programação' : 'programações'}`
      : 'Ainda não usado em programações';
  };
  programNamesTooltip = (p: Publication) => (p.programNames ?? []).join(', ') || 'Ainda não usado em programações';

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
      next: () => { this.toast.show(this.isPublished(p) ? 'Conteúdo pausado' : 'Conteúdo publicado'); this.load(); },
      error: e => this.toast.show(errorMessage(e)),
    });
  }

  remove(p: Publication): void {
    this.pendingDelete.set(p);
  }

  confirmRemove(p: Publication): void {
    this.deleteUC.execute(p.id).subscribe({
      next: () => { this.pendingDelete.set(null); this.toast.show('Publicação excluída'); this.load(); },
      error: e => { this.pendingDelete.set(null); this.error.set(errorMessage(e)); },
    });
  }
}
