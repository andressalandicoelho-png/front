import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  DeletePublicationUseCase, ListPublicationsUseCase, PublishPublicationUseCase, UnpublishPublicationUseCase,
} from '@application/publication/publication.usecases';
import {
  DEFAULT_DISPLAY_SECONDS, isPublicationPublished, MAX_MESSAGE_CONTENT_LENGTH, Publication, PublicationContentStatus, PublicationType, publicationContentStatus,
} from '@domain/publication/publication.entity';
import { errorMessage } from '@presentation/core/error-message';
import { movePage, paginate } from '@presentation/core/pagination';
import { ToastService } from '@presentation/core/toast.service';
import { ConfirmActionComponent } from '@presentation/ui/shared/confirm-action.component';
import { IconComponent } from '@presentation/ui/shared/icon.component';
import { PaginationComponent } from '@presentation/ui/shared/pagination.component';
import { PublicationEditorComponent, PublicationEditorForm } from '@presentation/ui/publication/publication-editor.component';
import { PublicationGridComponent } from '@presentation/ui/publication/publication-grid.component';

type ContentStatusFilter = 'ALL' | PublicationContentStatus;
type PublicationSort = 'NEWEST' | 'OLDEST';

@Component({
  selector: 'app-publications',
  imports: [FormsModule, IconComponent, ConfirmActionComponent, PaginationComponent, PublicationEditorComponent, PublicationGridComponent],
  template: `
    <section class="card content-filters">
      <div class="content-filter-row">
        <div class="content-search-actions">
          <label class="search-field search-field--icon content-search-field"><app-icon name="search" [size]="16"/><input class="input" type="search" placeholder="Buscar conteúdo ou autor" aria-label="Buscar conteúdo ou autor" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(0)"></label>
          <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" [size]="18"/> Novo conteúdo</button>
        </div>
        <select class="input content-filter-select" aria-label="Filtrar por formato" [ngModel]="typeFilter() ?? ''" (ngModelChange)="typeFilter.set($event || null); page.set(0)">
          <option value="">Formato: Todos</option>
          <option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option><option value="LINK">Link</option><option value="MESSAGE">Mensagem</option>
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
      <span>
        {{ visible().length }}
        @if (visible().length === 1) { conteúdo } @else { conteúdos }
      </span>
      <label>Ordenar por
        <select class="input" aria-label="Ordenar conteúdos" [ngModel]="sortOrder()" (ngModelChange)="sortOrder.set($event)">
          <option value="NEWEST">Mais recentes</option>
          <option value="OLDEST">Mais antigos</option>
        </select>
      </label>
    </div>

    <app-publication-grid
      [publications]="pageItems()" [columns]="gridColumns()" [rowCount]="gridRowCount()" [search]="search()"
      (createRequested)="openNew()" (editRequested)="openEdit($event)"
      (publishToggleRequested)="toggle($event)" (deleteRequested)="remove($event)"/>
    @if (visible().length && pageCount() > 1) {
      <footer app-pagination class="pagination" ariaLabel="Paginação dos conteúdos"
        [previousDisabled]="page() === 0" [nextDisabled]="page() + 1 >= pageCount()"
        (previousPage)="previousPage()" (nextPage)="nextPage()">
        <small class="muted" paginationSummary>Mostrando {{ page() * pageSize() + 1 }}–{{ page() * pageSize() + pageItems().length }} de {{ visible().length }}</small>
        <span paginationStatus aria-live="polite">{{ page() + 1 }} de {{ pageCount() }}</span>
      </footer>
    }

    @if (modal()) {
      <app-publication-editor
        [editingPublication]="editing()" [form]="form" [maxTitleLength]="maxTitleLength"
        [maxMessageContentLength]="maxMessageContentLength" [durationOptions]="durationOptions"
        [error]="error()" (formChange)="form = $event" (errorChanged)="error.set($event)"
        (closed)="closeModal()" (listRefreshRequested)="load()"/>
    }
    @if (pendingDelete(); as publication) {
      <app-confirm-action
        title="Confirmar exclusão de conteúdo"
        [heading]="'Excluir “' + publication.title + '”?'"
        message="Exclusão permanente; não será possível agendá-lo novamente."
        confirmLabel="Excluir conteúdo"
        (cancelled)="pendingDelete.set(null)"
        (confirmed)="confirmRemove(publication)"/>
    }
  `,
})
export class PublicationsPage implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;
  private listUC = inject(ListPublicationsUseCase);
  private publishUC = inject(PublishPublicationUseCase);
  private unpublishUC = inject(UnpublishPublicationUseCase);
  private deleteUC = inject(DeletePublicationUseCase);
  private toast = inject(ToastService);

  readonly maxMessageContentLength = MAX_MESSAGE_CONTENT_LENGTH;
  readonly maxTitleLength = 70;

  statusFilters: { label: string; value: ContentStatusFilter }[] = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Rascunho', value: 'DRAFT' },
    { label: 'No ar', value: 'LIVE' },
    { label: 'Expirado', value: 'EXPIRED' },
  ];
  durationOptions = [10, 15, 20, 30, 60];
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
    let direction = 1;
    if (this.sortOrder() === 'NEWEST') direction = -1;
    return this.filteredItems()
      .filter(item => status === 'ALL' || this.contentStatus(item) === status)
      .sort((a, b) => {
        const dateDifference = Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '');
        let sortableDateDifference = dateDifference;
        if (Number.isNaN(dateDifference)) sortableDateDifference = 0;
        return sortableDateDifference * direction || (a.id - b.id) * direction;
      });
  });
  private readonly pagination = computed(() => paginate(this.visible(), this.page(), this.pageSize()));
  pageCount = computed(() => this.pagination().count);
  pageItems = computed(() => this.pagination().items);
  modal = signal(false);
  pendingDelete = signal<Publication | null>(null);
  editing = signal<Publication | null>(null);
  error = signal('');
  form: PublicationEditorForm = this.blank();

  private blank(): PublicationEditorForm {
    return {
      title: '', content: '', type: 'IMAGE' as PublicationType, linkUrl: '', file: undefined as File | undefined,
      displaySeconds: DEFAULT_DISPLAY_SECONDS as number | null, originalDurationSeconds: null as number | null,
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
    let columns = 3;
    if (hostWidth < 560) columns = 1;
    else if (hostWidth < 850) columns = 2;
    const oldPageSize = this.pageSize();
    const firstItemIndex = this.page() * oldPageSize;
    this.gridColumns.set(columns);
    const pageSize = hostWidth <= 650 ? 3 : 6;
    if (pageSize !== oldPageSize) {
      this.pageSize.set(pageSize);
      this.page.set(Math.max(0, Math.min(Math.floor(firstItemIndex / pageSize), this.pageCount() - 1)));
    }
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

  previousPage(): void { movePage(this.page, this.pageCount, -1); }
  nextPage(): void { movePage(this.page, this.pageCount, 1); }

  isPublished = (p: Publication) => isPublicationPublished(p.status);
  private contentStatus = (p: Publication): PublicationContentStatus => publicationContentStatus(p.status);
  statusCount = (status: ContentStatusFilter) => {
    const items = this.filteredItems();
    if (status === 'ALL') return items.length;
    return items.filter(item => this.contentStatus(item) === status).length;
  };

  openNew(): void {
    this.editing.set(null);
    this.form = this.blank();
    this.error.set('');
    this.modal.set(true);
  }
  openEdit(p: Publication): void {
    this.editing.set(p);
    this.form = { ...this.blank(), title: p.title, content: p.content ?? '', type: p.type, displaySeconds: p.displaySeconds };
    this.error.set('');
    this.modal.set(true);
  }

  closeModal(): void { this.modal.set(false); }

  toggle(p: Publication): void {
    const wasPublished = this.isPublished(p);
    let operation = this.publishUC.execute(p.id);
    if (wasPublished) operation = this.unpublishUC.execute(p.id);
    operation.subscribe({
      next: () => {
        if (wasPublished) this.toast.show('Conteúdo pausado');
        else this.toast.show('Conteúdo publicado');
        this.load();
      },
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
