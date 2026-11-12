import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  CreatePublicationUseCase, DeletePublicationUseCase, ListPublicationsUseCase,
  PublishPublicationUseCase, UnpublishPublicationUseCase, UpdatePublicationUseCase,
} from '@application/publication/publication.usecases';
import {
  DEFAULT_DISPLAY_SECONDS, MAX_MESSAGE_CONTENT_LENGTH, MAX_UPLOAD_BYTES, Publication, PublicationType,
  validateNewPublication,
} from '@domain/publication/publication.entity';
import { errorMessage } from '@presentation/core/error-message';
import { ToastService } from '@presentation/core/toast.service';
import { typeLabel } from '@presentation/core/format';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { PaginationComponent } from '@presentation/ui/pagination.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';
import { generateVideoPreview } from '@presentation/ui/video-thumbnail';

type ContentStatusFilter = 'ALL' | 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'EXPIRED';
type PublicationSort = 'NEWEST' | 'OLDEST';

interface ZipImagePreview {
  file: File;
  previewUrl: string;
  title: string;
  created: boolean;
}

@Component({
  selector: 'app-publications',
  imports: [FormsModule, IconComponent, ModalComponent, PaginationComponent, SecureMediaComponent],
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
            <span class="tile-format"><app-icon [name]="p.type === 'MESSAGE' ? 'info' : p.type === 'LINK' ? 'link' : p.type === 'VIDEO' ? 'video' : 'image'" [size]="14"/>{{ label(p.type) }}</span>
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
            <small class="tile-format-duration">{{ p.type === 'MESSAGE' ? 'Fixa durante o horário agendado' : label(p.type) + ' · ' + (p.displaySeconds ?? p.originalDurationSeconds ?? 10) + ' s' }}</small>
            <span class="status" [class.live]="isPublished(p)">{{ contentStatusLabel(p) }}</span>
          </div>
          <div class="tile-attribution" [title]="programNamesTooltip(p)">
            <app-icon name="layers" [size]="14"/>
            <small>{{ programUsage(p) }}</small>
          </div>
        </article>
      } @empty {
        <div class="empty wide"><p>{{ search() ? 'Nenhum resultado. Ajuste a busca ou os filtros.' : 'Biblioteca vazia.' }}</p><button class="btn primary" type="button" (click)="openNew()">Novo conteúdo</button></div>
      }
    </section>
    @if (visible().length && pageCount() > 1) {
      <footer app-pagination class="pagination" ariaLabel="Paginação dos conteúdos"
        [previousDisabled]="page() === 0" [nextDisabled]="page() + 1 >= pageCount()"
        (previousPage)="previousPage()" (nextPage)="nextPage()">
        <small class="muted" paginationSummary>Mostrando {{ page() * pageSize() + 1 }}–{{ page() * pageSize() + pageItems().length }} de {{ visible().length }}</small>
        <span paginationStatus aria-live="polite">{{ page() + 1 }} de {{ pageCount() }}</span>
      </footer>
    }

    @if (modal()) {
      <app-modal class="publication-modal" [title]="editing() ? 'Editar publicação' : 'Nova publicação'"
        [subtitle]="editing() ? '' : 'Defina o conteúdo e o tempo de exibição.'"
        (closed)="closeModal()">
        <form class="stack publication-form" (ngSubmit)="save()">
          <label class="publication-title-field">
            <span>Título da publicação <b>*</b><small>{{ form.title.length }}/{{ maxTitleLength }}</small></span>
            <input class="input" name="title" placeholder="Ex: Promoção de Verão" [(ngModel)]="form.title"
              [maxlength]="maxTitleLength" required>
          </label>
          @if (!editing()) {
            <section class="publication-type-field">
              <span class="publication-field-label">Tipo de conteúdo</span>
              <div class="publication-type-tabs" role="group" aria-label="Tipo de conteúdo">
                <button type="button" [class.selected]="form.type === 'IMAGE' && !zipMode()"
                  [attr.aria-pressed]="form.type === 'IMAGE' && !zipMode()" (click)="changeType('IMAGE')">
                  <app-icon name="image" [size]="14"/> Imagem
                </button>
                <button type="button" [class.selected]="form.type === 'VIDEO'"
                  [attr.aria-pressed]="form.type === 'VIDEO'" (click)="changeType('VIDEO')">
                  <app-icon name="play" [size]="14"/> Vídeo
                </button>
                <button type="button" [class.selected]="zipMode() || zipImages().length > 0"
                  [attr.aria-pressed]="zipMode() || zipImages().length > 0" (click)="zipMode.set(true); zipFileInput.click()">
                  <app-icon name="document" [size]="14"/> Pacote ZIP
                </button>
                <button type="button" [class.selected]="form.type === 'LINK'"
                  [attr.aria-pressed]="form.type === 'LINK'" (click)="changeType('LINK')">
                  <app-icon name="link" [size]="14"/> Link
                </button>
                <button type="button" [class.selected]="form.type === 'MESSAGE'"
                  [attr.aria-pressed]="form.type === 'MESSAGE'" (click)="changeType('MESSAGE')">
                  <app-icon name="info" [size]="14"/> Mensagem
                </button>
              </div>
              <input #zipFileInput type="file" hidden accept=".zip,application/zip" (change)="pick($event)">
            </section>
          }
          @if (form.type === 'MESSAGE') {
            <label class="field publication-content-field">Mensagem
              <textarea class="input" name="content" rows="5" placeholder="Texto que ficará fixo na faixa inferior do player" [(ngModel)]="form.content" [maxlength]="maxMessageContentLength" required></textarea>
            </label>
            <small class="muted message-character-count">{{ form.content.length }} / {{ maxMessageContentLength }} caracteres</small>
          } @else if (!editing()) {
            @if (form.type === 'LINK') {
              <label class="field publication-content-field">Endereço do link
                <textarea class="input" name="link" rows="4" placeholder="Cole uma URL HTTPS ou o código de incorporação" [(ngModel)]="form.linkUrl"></textarea>
              </label>
            } @else {
              <div class="publication-file-field">
                <span class="publication-field-label">Arquivo</span>
                <label class="drop publication-drop" (dragover)="allowDrop($event)" (drop)="dropFiles($event)">
                  <span class="publication-upload-icon"><app-icon name="upload" [size]="18"/></span>
                  <span>{{ form.file ? form.file.name : 'Clique para selecionar ou arraste o arquivo' }}</span>
                  <small>{{ form.type === 'VIDEO' ? 'MP4 (máx. 300MB)' : 'PNG, JPEG, WEBP ou ZIP (máx. 300MB)' }}</small>
                  <input type="file" hidden
                    [attr.accept]="form.type === 'IMAGE' ? '.zip,application/zip,image/jpeg,image/png,image/webp' : 'video/mp4'"
                    (change)="pick($event)">
                </label>
              </div>
            }
          }
          @if (form.type === 'MESSAGE' && form.content.trim()) {
            <section class="tile-message-preview message-form-preview"><strong>{{ form.title || 'Título da mensagem' }}</strong><p>{{ form.content }}</p></section>
          }
          @if (form.type !== 'MESSAGE' && !zipImages().length && mediaPreviewUrl(); as previewUrl) {
            <section class="media-file-preview" [class.video-thumbnail-preview]="form.type === 'VIDEO'">
              <img [src]="previewUrl" [alt]="'Prévia de ' + form.title">
              @if (form.type === 'VIDEO') { <span class="video-thumbnail-label">Miniatura do vídeo</span> }
            </section>
          }
          @if (previewLoading()) { <p class="muted" role="status">Analisando vídeo…</p> }
          @if (previewError()) { <p class="muted" role="status">{{ previewError() }}</p> }
          @if (zipImages().length) {
            @if (zipImages()[zipIndex()]; as image) {
              <section class="zip-image-review" aria-label="Prévia das imagens do ZIP">
                <div class="zip-image-preview"><img [src]="image.previewUrl" [alt]="image.title"></div>
                <div class="zip-image-navigation">
                  <button class="icon-btn" type="button" aria-label="Imagem anterior" [disabled]="zipIndex() === 0 || saving()" (click)="showZipImage(zipIndex() - 1)">
                    <app-icon name="left" [size]="18"/>
                  </button>
                  <span aria-live="polite">Imagem {{ zipIndex() + 1 }} de {{ zipImages().length }}</span>
                  <button class="icon-btn" type="button" aria-label="Próxima imagem" [disabled]="zipIndex() + 1 >= zipImages().length || saving()" (click)="showZipImage(zipIndex() + 1)">
                    <app-icon name="right" [size]="18"/>
                  </button>
                </div>
                <small class="zip-image-status">{{ image.created ? 'Conteúdo criado para esta imagem' : 'Ainda não enviado' }}</small>
              </section>
            }
          }
          @if (zipProcessing()) { <p class="muted" role="status">Lendo imagens do ZIP…</p> }
          @if (form.type !== 'MESSAGE') {
            <section class="publication-duration" aria-label="Tempo de exibição">
              <div class="publication-duration-heading">
                <span>{{ zipImages().length ? 'Tempo para todas as imagens' : form.type === 'VIDEO' ? 'Tempo máximo de exibição' : 'Tempo de exibição' }}</span>
                <small>Sugerido: 15s a 25s</small>
              </div>
              <div class="publication-duration-controls">
                <div class="publication-duration-stepper" role="group" aria-label="Ajustar tempo de exibição">
                  <button type="button" aria-label="Diminuir 1 segundo" (click)="adjustDuration(-1)" [disabled]="!form.displaySeconds || form.displaySeconds <= 1">−</button>
                  <input class="publication-duration-input" type="number" min="1" max="3600" name="secs"
                    aria-label="Tempo de exibição em segundos" [ngModel]="form.displaySeconds"
                    (ngModelChange)="setDisplaySeconds($event)" [placeholder]="form.type === 'VIDEO' ? '—' : '20'">
                  <span class="publication-duration-unit">{{ form.displaySeconds ? 's' : '' }}</span>
                  <button type="button" aria-label="Aumentar 1 segundo" (click)="adjustDuration(1)" [disabled]="form.displaySeconds !== null && form.displaySeconds >= 3600">+</button>
                </div>
                <div class="publication-duration-presets" role="group" aria-label="Durações predefinidas">
                  @for (seconds of durationOptions; track seconds) {
                    <button type="button" [class.selected]="form.displaySeconds === seconds"
                      [attr.aria-pressed]="form.displaySeconds === seconds"
                      (click)="setDisplaySeconds(seconds)">{{ seconds }}s</button>
                  }
                </div>
              </div>
              @if (form.type === 'VIDEO') {
                <small class="publication-duration-hint">Deixe sem limite para reproduzir o vídeo inteiro.</small>
              }
            </section>
          }
          @if (form.type === 'VIDEO' && !editing()) {
            <label class="field">Duração original do vídeo (segundos)
              <input class="input" type="number" min="1" name="orig" [(ngModel)]="form.originalDurationSeconds"
                [readonly]="previewLoading() || videoDurationDetected()">
            </label>
            <small class="muted">{{ videoDurationDetected() ? 'Duração detectada automaticamente.' : 'Detectaremos a duração; se falhar, informe-a.' }}</small>
          }
          @if (error()) { <p class="error">{{ error() }}</p> }
          @if (zipBatchError()) { <p class="error" role="alert">{{ zipBatchError() }}</p> }
          <footer class="publication-form-actions">
            <button class="btn" type="button" [disabled]="saving() || zipProcessing()" (click)="closeModal()">Cancelar</button>
            @if (zipImages().length) {
              <button class="btn primary" type="button" [disabled]="saving() || zipProcessing() || !pendingZipImageCount()"
                (click)="saveAllZipImages()">
                {{ saving() ? 'Enviando ' + zipBatchProgress() + ' de ' + zipBatchTotal() + '…' :
                  pendingZipImageCount() ? 'Publicar todas (' + pendingZipImageCount() + ')' : 'Todas já publicadas' }}
              </button>
              <button class="btn publication-secondary-submit" type="submit" [disabled]="saving() || zipProcessing() || currentZipImage()?.created">
                {{ currentZipImage()?.created ? 'Imagem já publicada' : 'Publicar esta imagem' }}
              </button>
            } @else {
              <button class="btn primary" type="submit"
                [disabled]="saving() || zipProcessing() || previewLoading() || (form.type === 'VIDEO' && !form.originalDurationSeconds)">
                {{ saving() ? 'Publicando…' : editing() ? 'Salvar alterações' : 'Publicar' }}
              </button>
            }
          </footer>
        </form>
      </app-modal>
    }
    @if (pendingDelete(); as publication) {
      <app-modal title="Confirmar exclusão de conteúdo" (closed)="pendingDelete.set(null)">
        <div class="confirm-content"><span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span><h2>Excluir “{{ publication.title }}”?</h2><p class="muted">Exclusão permanente; não será possível agendá-lo novamente.</p>
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

  readonly maxMessageContentLength = MAX_MESSAGE_CONTENT_LENGTH;
  readonly maxTitleLength = 70;

  statusFilters: { label: string; value: ContentStatusFilter }[] = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Rascunho', value: 'DRAFT' },
    { label: 'Agendado', value: 'SCHEDULED' },
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
  zipImages = signal<ZipImagePreview[]>([]);
  zipMode = signal(false);
  zipIndex = signal(0);
  zipProcessing = signal(false);
  zipDisplaySeconds = signal<number | null>(DEFAULT_DISPLAY_SECONDS);
  zipBatchProgress = signal(0);
  zipBatchTotal = signal(0);
  zipBatchError = signal('');
  pendingZipImageCount = computed(() => this.zipImages().filter(image => !image.created).length);
  mediaPreviewUrl = signal<string | null>(null);
  previewLoading = signal(false);
  previewError = signal('');
  videoDurationDetected = signal(false);
  form = this.blank();
  currentZipImage = computed<ZipImagePreview | null>(() => this.zipImages()[this.zipIndex()] ?? null);
  private previewGeneration = 0;

  private blank() {
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
    this.clearZipPreviews();
    this.clearMediaPreview();
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

  openNew(): void {
    this.clearZipPreviews();
    this.clearMediaPreview();
    this.editing.set(null);
    this.form = this.blank();
    this.error.set('');
    this.modal.set(true);
  }
  openEdit(p: Publication): void {
    this.clearZipPreviews();
    this.clearMediaPreview();
    this.editing.set(p);
    this.form = { ...this.blank(), title: p.title, content: p.content ?? '', type: p.type, displaySeconds: p.displaySeconds };
    this.error.set('');
    this.modal.set(true);
  }

  pick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.name.toLocaleLowerCase().endsWith('.zip')) {
      void this.readZip(file);
      return;
    }
    this.selectMediaFile(file);
  }

  allowDrop(event: DragEvent): void { event.preventDefault(); }

  dropFiles(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    if (file.name.toLocaleLowerCase().endsWith('.zip')) {
      void this.readZip(file);
      return;
    }
    this.selectMediaFile(file);
  }

  private selectMediaFile(file: File): void {
    this.clearZipPreviews();
    this.clearMediaPreview();
    this.form.file = file;
    this.form.title = file.name;
    this.form.originalDurationSeconds = null;
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '') ||
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (this.form.type === 'IMAGE' && isImage) {
      this.mediaPreviewUrl.set(URL.createObjectURL(file));
    } else if (this.form.type === 'VIDEO' && (extension === 'mp4' || file.type === 'video/mp4')) {
      void this.createVideoThumbnail(file);
    }
  }

  changeType(type: PublicationType): void {
    this.clearZipPreviews();
    this.form.type = type;
    this.form.file = undefined;
    this.form.content = '';
    this.form.displaySeconds = type === 'VIDEO' ? null : DEFAULT_DISPLAY_SECONDS;
    this.form.originalDurationSeconds = null;
    this.clearMediaPreview();
  }

  private async readZip(file: File): Promise<void> {
    this.clearZipPreviews();
    this.clearMediaPreview();
    this.error.set('');
    this.form.type = 'IMAGE';
    this.zipMode.set(true);
    this.form.file = undefined;
    this.form.title = '';
    this.form.displaySeconds = DEFAULT_DISPLAY_SECONDS;
    this.zipDisplaySeconds.set(DEFAULT_DISPLAY_SECONDS);
    if (file.size > MAX_UPLOAD_BYTES) {
      this.error.set('O arquivo ZIP passa do limite de 300 MB.');
      return;
    }
    this.zipProcessing.set(true);
    try {
      const { default: JSZip } = await import('jszip');
      const archive = await JSZip.loadAsync(file);
      const imageEntries = Object.values(archive.files)
        .filter(entry => !entry.dir && /\.(jpe?g|png|webp)$/i.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
      if (!imageEntries.length) throw new Error('O ZIP não contém imagens JPEG, PNG ou WebP.');

      let totalBytes = 0;
      const previews: ZipImagePreview[] = [];
      for (const entry of imageEntries) {
        const blob = await entry.async('blob');
        totalBytes += blob.size;
        if (totalBytes > MAX_UPLOAD_BYTES) {
          throw new Error('As imagens extraídas ultrapassam o limite total de 300 MB.');
        }
        const filename = entry.name.replaceAll('\\', '/').split('/').pop() || 'imagem';
        const extension = filename.split('.').pop()?.toLocaleLowerCase();
        const mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
          : extension === 'png' ? 'image/png' : 'image/webp';
        const imageFile = new File([blob], filename, { type: mimeType });
        previews.push({
          file: imageFile,
          previewUrl: URL.createObjectURL(imageFile),
          title: filename,
          created: false,
        });
      }

      this.zipImages.set(previews);
      this.zipIndex.set(0);
      this.form.type = 'IMAGE';
      this.applyZipImage(0);
    } catch (error) {
      this.clearZipPreviews();
      this.error.set(error instanceof Error ? error.message : 'Não foi possível ler o arquivo ZIP.');
    } finally {
      this.zipProcessing.set(false);
    }
  }

  showZipImage(index: number): void {
    if (index < 0 || index >= this.zipImages().length || index === this.zipIndex()) return;
    this.saveZipImageForm();
    this.zipIndex.set(index);
    this.applyZipImage(index);
    this.error.set('');
  }

  private saveZipImageForm(): void {
    const index = this.zipIndex();
    this.zipImages.update(images => images.map((image, imageIndex) => imageIndex === index
      ? { ...image, title: this.form.title }
      : image));
  }

  setDisplaySeconds(seconds: number | null): void {
    this.form.displaySeconds = seconds;
    if (this.zipImages().length) this.zipDisplaySeconds.set(seconds);
  }

  adjustDuration(change: number): void {
    const current = this.form.displaySeconds ?? DEFAULT_DISPLAY_SECONDS;
    this.setDisplaySeconds(Math.min(3600, Math.max(1, current + change)));
  }

  private applyZipImage(index: number): void {
    const image = this.zipImages()[index];
    if (!image) return;
    this.form.file = image.file;
    this.form.title = image.title;
    this.form.displaySeconds = this.zipDisplaySeconds();
    this.form.originalDurationSeconds = null;
  }

  private clearZipPreviews(): void {
    for (const image of this.zipImages()) URL.revokeObjectURL(image.previewUrl);
    this.zipImages.set([]);
    this.zipMode.set(false);
    this.zipIndex.set(0);
    this.zipDisplaySeconds.set(DEFAULT_DISPLAY_SECONDS);
    this.zipBatchProgress.set(0);
    this.zipBatchTotal.set(0);
    this.zipBatchError.set('');
  }

  private clearMediaPreview(): void {
    this.previewGeneration++;
    this.videoDurationDetected.set(false);
    const currentUrl = this.mediaPreviewUrl();
    if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
    this.mediaPreviewUrl.set(null);
    this.previewLoading.set(false);
    this.previewError.set('');
  }

  private async createVideoThumbnail(file: File): Promise<void> {
    const generation = this.previewGeneration;
    this.previewLoading.set(true);

    try {
      const preview = await generateVideoPreview(file);
      if (generation === this.previewGeneration) {
        this.mediaPreviewUrl.set(preview.thumbnailUrl);
        this.form.originalDurationSeconds = preview.durationSeconds;
        this.videoDurationDetected.set(true);
      }
    } catch (error) {
      if (generation === this.previewGeneration) {
        this.previewError.set(error instanceof Error
          ? `${error.message} Informe manualmente a duração original para enviar.`
          : 'Não foi possível ler a duração original. Informe-a manualmente para enviar.');
      }
    } finally {
      if (generation === this.previewGeneration) this.previewLoading.set(false);
    }
  }

  closeModal(): void {
    if (this.saving() || this.zipProcessing()) return;
    this.modal.set(false);
    this.clearZipPreviews();
    this.clearMediaPreview();
  }

  save(): void {
    this.error.set('');
    this.zipBatchError.set('');
    if (this.form.type === 'MESSAGE' && this.form.content.length > this.maxMessageContentLength) {
      this.error.set(`A mensagem pode ter até ${this.maxMessageContentLength} caracteres (cerca de 1 minuto de leitura).`);
      return;
    }
    if (this.currentZipImage()) this.saveZipImageForm();
    this.saving.set(true);
    const current = this.editing();
    const linkUrl = this.normalizeLinkInput(this.form.linkUrl);
    const request = current
      ? this.updateUC.execute(current.id, {
          title: this.form.title.trim(),
          ...(this.form.type === 'MESSAGE' ? { content: this.form.content } : {}),
          ...(this.form.type === 'VIDEO'
            ? { displaySeconds: this.form.displaySeconds }
            : this.form.displaySeconds ? { displaySeconds: this.form.displaySeconds } : {}),
        })
      : this.createUC.execute({
          title: this.form.title, content: this.form.content, type: this.form.type, linkUrl, file: this.form.file,
          displaySeconds: this.form.displaySeconds ?? undefined,
          originalDurationSeconds: this.form.originalDurationSeconds ?? undefined,
        });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        if (this.currentZipImage()) {
          const index = this.zipIndex();
          this.zipImages.update(images => images.map((image, imageIndex) => imageIndex === index
            ? { ...image, created: true }
            : image));
          this.toast.show('Conteúdo criado para esta imagem');
        } else {
          this.closeModal();
          this.toast.show(current ? 'Publicação atualizada' : 'Publicação enviada');
        }
        this.load();
      },
      error: e => { this.saving.set(false); this.error.set(errorMessage(e)); },
    });
  }

  async saveAllZipImages(): Promise<void> {
    this.error.set('');
    this.zipBatchError.set('');
    this.saveZipImageForm();
    const pendingImages = this.zipImages().filter(image => !image.created);
    if (!pendingImages.length) return;
    const displaySeconds = this.zipDisplaySeconds();
    if (displaySeconds === null || !Number.isInteger(displaySeconds) || displaySeconds < 1 || displaySeconds > 3600) {
      this.error.set('A duração deve ser um número inteiro entre 1 e 3600 segundos.');
      return;
    }

    for (const [index, image] of this.zipImages().entries()) {
      if (image.created) continue;
      const validationError = validateNewPublication({
        title: image.title,
        type: 'IMAGE',
        file: image.file,
        displaySeconds,
      });
      if (validationError) {
        this.zipIndex.set(index);
        this.applyZipImage(index);
        this.error.set(`${image.file.name}: ${validationError}`);
        return;
      }
    }

    this.zipBatchProgress.set(0);
    this.zipBatchTotal.set(pendingImages.length);
    this.saving.set(true);
    try {
      for (const image of pendingImages) {
        await firstValueFrom(this.createUC.execute({
          title: image.title,
          type: 'IMAGE',
          file: image.file,
          displaySeconds,
        }));
        this.zipImages.update(images => images.map(candidate => candidate === image
          ? { ...candidate, created: true }
          : candidate));
        this.zipBatchProgress.update(progress => progress + 1);
      }
    } catch (error) {
      this.zipBatchError.set(errorMessage(error));
      this.load();
      return;
    } finally {
      this.saving.set(false);
    }

    this.closeModal();
    this.toast.show(`${pendingImages.length} imagens criadas como conteúdos`);
    this.load();
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
