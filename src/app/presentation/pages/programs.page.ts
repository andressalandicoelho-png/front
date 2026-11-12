import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import {
  AddProgramEntriesUseCase, DeleteProgramUseCase, ListProgramsUseCase, RemoveProgramEntryUseCase, UpdateProgramUseCase,
} from '@application/program/program.usecases';
import {
  ScheduleProgramEntriesError, ScheduleProgramEntriesUseCase,
} from '@application/program/schedule-program-entries.usecase';
import { ListScheduleUseCase } from '@application/schedule/schedule.usecases';
import { GeneratePlayerTokenUseCase } from '@application/user/user.usecases';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { currentBusinessDate, currentBusinessTime, datesBetweenInclusive, toMinutes } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { publicationTypeName } from '@presentation/formatters/publication-type-name';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';
import { DatePickerComponent } from '@presentation/ui/date-picker.component';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { CalendarReviewTableComponent } from '@presentation/ui/calendar-review-table.component';
import { ProgramPreviewComponent, ProgramPreviewItem } from '@presentation/ui/program-preview.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';

@Component({
  selector: 'app-programs',
  imports: [FormsModule, DatePickerComponent, IconComponent, ModalComponent, CalendarReviewTableComponent, ProgramPreviewComponent, SecureMediaComponent],
  template: `
    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }

    <section class="program-workspace" aria-label="Gerenciar programações">
      <aside class="program-browser" aria-label="Lista de programações">
        <div class="program-browser-heading">
          <div><h2>Suas programações</h2></div>
          <button class="btn primary small" type="button" (click)="openCreate()" aria-label="Criar nova programação">
            <app-icon name="plus" [size]="15"/> Nova
          </button>
        </div>
        <label class="search-field program-search">
          <app-icon name="search" [size]="16"/>
          <input class="input" type="search" placeholder="Buscar por nome" aria-label="Buscar programação por nome"
            [ngModel]="search()" (ngModelChange)="search.set($event)">
        </label>
        <div class="program-status-filter" role="group" aria-label="Filtrar por estado">
          <button type="button" [class.active]="statusFilter() === 'ALL'" [attr.aria-pressed]="statusFilter() === 'ALL'" (click)="statusFilter.set('ALL')">Todas</button>
          <button type="button" [class.active]="statusFilter() === 'ACTIVE'" [attr.aria-pressed]="statusFilter() === 'ACTIVE'" (click)="statusFilter.set('ACTIVE')">Ativas</button>
          <button type="button" [class.active]="statusFilter() === 'PAUSED'" [attr.aria-pressed]="statusFilter() === 'PAUSED'" (click)="statusFilter.set('PAUSED')">Pausadas</button>
        </div>
        <nav class="program-browser-list" aria-label="Selecionar programação">
          @for (program of filteredPrograms(); track program.id) {
            <button type="button" class="program-browser-item" [class.selected]="selected()?.id === program.id"
              [attr.aria-current]="selected()?.id === program.id ? 'true' : null" (click)="select(program)">
              <span class="program-browser-item-top">
                <strong>{{ program.name }}</strong>
                <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span>
              </span>
            </button>
          } @empty {
            <div class="program-browser-empty">
              <strong>{{ programs().length ? 'Nenhum resultado' : 'Nenhuma programação ainda' }}</strong>
              <span>{{ programs().length ? 'Tente outro nome ou estado.' : 'Crie uma programação para organizar o conteúdo de uma TV.' }}</span>
            </div>
          }
        </nav>
      </aside>

      @if (selected(); as program) {
        <section class="program-inspector" aria-labelledby="program-inspector-title">
          <header class="program-inspector-head">
            <div class="program-inspector-title">
              <h2 id="program-inspector-title">{{ program.name }}</h2>
              <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span>
            </div>
            <div class="program-inspector-actions">
              <button class="btn small" type="button" [disabled]="!program.entries.length" (click)="previewOpen.set(true)">
                <app-icon name="play" [size]="15"/> Prévia
              </button>
              <button class="btn small" type="button" (click)="toggle(program)">{{ program.active ? 'Pausar' : 'Ativar' }}</button>
              <button class="btn small" type="button" (click)="openEdit(program)">Editar nome</button>
              <button class="btn small program-delete-button" type="button" (click)="requestDelete(program)"><app-icon name="trash" [size]="15"/> Excluir</button>
              <button class="btn primary small" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="15"/> Adicionar conteúdo</button>
            </div>
          </header>

          <section class="program-connection" aria-labelledby="program-connection-title">
            <div class="program-section-heading">
              <div><h3 id="program-connection-title">Conectar à TV</h3></div>
              @if (!program.active) {
                <span class="program-connection-state">Programação pausada</span>
              } @else if (!program.entries.length) {
                <span class="program-connection-state">Adicione conteúdo</span>
              } @else if (programScheduleLoading()) {
                <span class="program-connection-state" role="status">Verificando agenda</span>
              } @else if (programScheduleError()) {
                <span class="program-connection-state" role="alert">Agenda indisponível</span>
              } @else if (upcomingSchedules().length) {
                <span class="program-connection-state" [class.ready]="!!playerToken()">
                  {{ playerToken() ? 'Pronta para testar' : 'Gere o link da TV' }}
                </span>
              }
            </div>
            @if (programScheduleLoading()) {
              <p class="program-connection-note" role="status">Consultando os horários dos próximos 30 dias…</p>
            } @else if (programScheduleError()) {
              <p class="program-connection-note" role="alert">{{ programScheduleError() }} <button class="link-button" type="button" (click)="loadProgramSchedule(program.id)">Tentar novamente</button></p>
            } @else if (upcomingSchedules().length) {
              <p class="program-connection-note">{{ upcomingSchedules().length }} período(s) nos próximos 30 dias. Próximo: {{ formatDate(upcomingSchedules()[0].date) }}, {{ upcomingSchedules()[0].startTime }}–{{ upcomingSchedules()[0].endTime }}.</p>
            }
            @if (playerToken(); as token) {
              <div class="program-tv-actions">
                <input class="input" aria-label="Link da programação para TV" readonly [value]="playerUrl(token, program.id)">
                <button class="btn small" type="button" (click)="copyPlayerUrl(program.id)"><app-icon name="copy" [size]="15"/> Copiar</button>
                <a class="btn small" [href]="playerUrl(token, program.id)" target="_blank" rel="noopener">Testar</a>
                <button class="btn small" type="button" [disabled]="generatingToken()" (click)="generatePlayerToken()">
                  <app-icon name="link" [size]="15"/> {{ generatingToken() ? 'Gerando…' : 'Gerar novo link' }}
                </button>
              </div>
            } @else {
              <button class="btn small" type="button" [disabled]="generatingToken()" (click)="generatePlayerToken()">
                {{ generatingToken() ? 'Gerando link…' : auth.user()?.hasPlayerToken ? 'Renovar link da TV' : 'Gerar link da TV' }}
              </button>
              @if (auth.user()?.hasPlayerToken) {
                <p class="program-token-warning">Renovar o link invalida os endereços de TV já compartilhados.</p>
              }
            }
          </section>

          <section class="program-sequence" aria-labelledby="program-sequence-title">
            <div class="program-section-heading">
              <div><h3 id="program-sequence-title">Sequência de conteúdo</h3><p>A TV segue esta ordem nos horários ativos.</p></div>
            </div>
            @for (entry of program.entries; track entry.id; let index = $index) {
              <article class="program-sequence-item">
                <span class="program-sequence-position">{{ (index + 1).toString().padStart(2, '0') }}</span>
                <span class="program-sequence-thumb media-thumb"><app-secure-media [mediaId]="entry.mediaFileId" [type]="entry.publicationType === 'MESSAGE' ? 'MESSAGE' : entry.publicationType === 'VIDEO' ? 'VIDEO' : entry.publicationType === 'LINK' ? 'LINK' : 'IMAGE'"/></span>
                <span class="program-sequence-copy">
                  @if (entry.publicationType === 'MESSAGE') {
                    <small>Mensagem · Fixa durante o horário agendado</small>
                  } @else {
                    <small>{{ typeName(entry.publicationType) }} · {{ duration(entry) }} s</small>
                  }
                </span>
                <button type="button" class="icon-btn danger" [attr.aria-label]="'Remover ' + entry.publicationTitle + ' da sequência'" title="Remover da sequência" (click)="removeEntry(program, entry.id)">
                  <app-icon name="trash" [size]="17"/>
                </button>
              </article>
            } @empty {
              <div class="program-sequence-empty">
                <span class="empty-icon"><app-icon name="layers" [size]="22"/></span>
                <div><strong>Sequência vazia</strong><p>Adicione conteúdos publicados para definir o que esta TV deve reproduzir.</p></div>
                <button class="btn primary small" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="15"/> Adicionar conteúdo</button>
              </div>
            }
          </section>
        </section>
      } @else {
        <section class="program-inspector program-inspector-empty empty-state" aria-live="polite">
          <span class="empty-icon"><app-icon [name]="programs().length ? 'layers' : 'tv'" [size]="24"/></span>
          <h2>{{ programs().length ? 'Selecione uma programação' : 'Nenhuma programação' }}</h2>
        </section>
      }
    </section>

    @if (selected(); as program) {
      <app-program-preview
        [title]="'Prévia · ' + program.name"
      [items]="previewItems()"
        [open]="previewOpen()"
        (closed)="previewOpen.set(false)"/>
    }

    @if (modal()) {
      @if (modalMode() === 'edit') {
        <app-modal title="Editar programação" (closed)="closeModal()">
          <form class="stack" (ngSubmit)="saveProgram()">
            <label class="field">Nome da programação<input class="input" name="name" [(ngModel)]="name" maxlength="120" required></label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || name.trim().length < 2">Salvar alterações</button>
          </form>
        </app-modal>
      } @else {
        <app-modal class="calendar-modal add-content-modal" title="Adicionar conteúdos"
          subtitle="Selecione as mídias da biblioteca e configure os horários de exibição."
          (closed)="closeModal()">
          <form class="add-content-dialog" (ngSubmit)="saveEntries()">
            @if (reviewingEntries()) {
              <section class="calendar-review-screen">
                <div class="calendar-review-overview">
                  <div class="calendar-review-programs">
                    <i aria-hidden="true"></i>
                    <strong>{{ selected()?.name }}</strong>
                  </div>
                  <div class="calendar-review-counts">
                    <span>{{ selectedPublicationIds().length }} {{ selectedPublicationIds().length === 1 ? 'conteúdo' : 'conteúdos' }}</span>
                    <span>{{ reviewScheduleCount() }} períodos diários</span>
                  </div>
                </div>
                <div class="calendar-review-period">
                  <span><app-icon name="calendar" [size]="13"/> {{ formatDate(sharedSchedule().date) }}{{ sharedSchedule().endDate !== sharedSchedule().date ? ' a ' + formatDate(sharedSchedule().endDate) : '' }}</span>
                  <span><app-icon name="clock" [size]="13"/> {{ sharedSchedule().startTime }}–{{ sharedSchedule().endTime }}</span>
                </div>
                <app-calendar-review-table [rows]="calendarReviewRows()" lastColumnHeading="Agendamentos"
                  emptyMessage="Selecione conteúdos para revisar o agendamento."/>
                @if (error()) { <p class="error add-content-error" role="alert">{{ error() }}</p> }
                @if (saving() && scheduleProgress().total) {
                  <div class="program-progress" role="status" aria-live="polite">
                    <span>Agendando {{ scheduleProgress().completed }} de {{ scheduleProgress().total }} períodos diários…</span>
                    <span class="program-progress-track"><i [style.width.%]="scheduleProgressPercent()"></i></span>
                  </div>
                }
                <div class="add-content-footer calendar-review-footer">
                  <span class="calendar-review-ready"><i aria-hidden="true"></i>{{ selectedPublicationIds().length }} {{ selectedPublicationIds().length === 1 ? 'mídia pronta' : 'mídias prontas' }}</span>
                  <div class="actions">
                    <button class="btn" type="button" [disabled]="saving()" (click)="reviewingEntries.set(false)">Voltar e ajustar</button>
                    <button class="btn primary" type="button" [disabled]="saving() || !selectedPublicationIds().length || !schedulesValid()" (click)="confirmSaveEntries()">
                      {{ saving() ? 'Agendando…' : entriesAdded() ? 'Retomar agendamentos' : 'Confirmar agendamento' }}
                    </button>
                  </div>
                </div>
              </section>
            } @else {
              <div class="add-content-context">
                <div class="add-content-period-fields">
                  <label class="calendar-schedule-time">Data de início
                    <app-date-picker name="programScheduleStartDate" [min]="today" required
                      [disabled]="saving()" [ngModel]="sharedSchedule().date"
                      (ngModelChange)="updateSharedSchedule('date', $event)"/>
                  </label>
                  <label class="calendar-schedule-time">Repetir até a data
                    <app-date-picker name="programScheduleEndDate" [min]="sharedSchedule().date || today" required
                      [disabled]="saving()" [ngModel]="sharedSchedule().endDate"
                      (ngModelChange)="updateSharedSchedule('endDate', $event)"/>
                  </label>
                  <label class="calendar-schedule-time">De
                    <input class="input" type="time" name="programScheduleStartTime" required [disabled]="saving()"
                      [ngModel]="sharedSchedule().startTime" (ngModelChange)="updateSharedSchedule('startTime', $event)">
                  </label>
                  <label class="calendar-schedule-time">Até
                    <input class="input" type="time" name="programScheduleEndTime" required [disabled]="saving()"
                      [ngModel]="sharedSchedule().endTime" (ngModelChange)="updateSharedSchedule('endTime', $event)">
                  </label>
                </div>
                <div class="add-content-program-summary">
                  <app-icon name="layers" [size]="15"/>
                  <strong>Programação</strong>
                  <span>{{ selected()?.name }}</span>
                  <small>Destino selecionado</small>
                </div>
              </div>
              <div class="add-content-library-head">
                <div><strong>Conteúdos publicados</strong></div>
              </div>
              <div class="add-content-filters" role="search">
                <label class="search-field search-field--icon">
                  <app-icon name="search" [size]="17"/>
                  <input class="input" type="search" name="publicationSearch" aria-label="Buscar conteúdo por título" placeholder="Buscar por título"
                    [ngModel]="publicationSearch()" (ngModelChange)="publicationSearch.set($event)">
                </label>
                <select class="input" name="publicationTypeFilter" aria-label="Filtrar por formato"
                  [ngModel]="publicationTypeFilter()" (ngModelChange)="publicationTypeFilter.set($event)">
                  <option value="ALL">Todos os formatos</option><option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option><option value="LINK">Link</option><option value="MESSAGE">Mensagem</option>
                </select>
              </div>
              <div class="add-content-meta">
                <span class="add-content-count" aria-live="polite">
                  <strong>{{ filteredAvailablePublications().length }}</strong> {{ filteredAvailablePublications().length === 1 ? 'resultado' : 'resultados' }}
                </span>
                <span class="add-content-hint">Selecione um ou mais itens</span>
              </div>
              @if (publicationsLoading()) {
                <div class="add-content-empty empty-state" role="status"><strong>Carregando conteúdos publicados…</strong></div>
              } @else if (publicationsLoadError()) {
                <div class="add-content-empty empty-state" role="alert">
                  <strong>Não foi possível carregar os conteúdos.</strong>
                  <span>{{ publicationsLoadError() }}</span>
                  <button class="link-button" type="button" (click)="loadPublications()">Tentar novamente</button>
                </div>
              } @else {
                <div class="add-content-list" role="list" aria-label="Conteúdos disponíveis">
                  @for (publication of filteredAvailablePublications(); track publication.id) {
                    <label class="add-content-item" role="listitem" [class.selected]="selectedPublicationIds().includes(publication.id)" [class.already-added]="entriesAdded()">
                      <input type="checkbox" [checked]="selectedPublicationIds().includes(publication.id)" [disabled]="saving() || entriesAdded()" (change)="togglePublication(publication.id, $event)">
                      <span class="add-content-thumb media-thumb"><app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/></span>
                      <span class="add-content-info">
                        <span class="add-content-title-row"><strong>{{ publication.title }}</strong><small class="add-content-published">{{ entriesAdded() ? 'Na programação' : 'Publicado' }}</small></span>
                        <small>{{ publication.type === 'MESSAGE' ? 'Fixa durante o horário agendado' : typeName(publication.type) + ' · ' + (publication.displaySeconds ?? publication.originalDurationSeconds ?? 30) + ' s' }}</small>
                      </span>
                      <span class="add-content-status">
                        @if (entriesAdded()) { Na programação }
                        @else if (selectedPublicationIds().includes(publication.id)) { Selecionado }
                        @else { Disponível }
                      </span>
                    </label>
                  } @empty {
                    <div class="add-content-empty empty-state">
                      <app-icon name="search" [size]="18"/>
                      <strong>{{ availablePublications().length ? 'Nenhum resultado para esta busca' : 'Nenhum conteúdo publicado disponível' }}</strong>
                      <span>{{ availablePublications().length ? 'Tente outro título ou ajuste os filtros.' : 'Publique conteúdos na biblioteca antes de adicioná-los à programação.' }}</span>
                      @if (hasPublicationFilters()) { <button class="link-button" type="button" (click)="clearPublicationFilters()">Limpar filtros</button> }
                    </div>
                  }
                </div>
              }
              @if (error()) { <p class="error add-content-error" role="alert">{{ error() }}</p> }
              <div class="add-content-footer">
                <div class="add-content-selection">
                  <strong>{{ selectedPublicationIds().length }} {{ selectedPublicationIds().length === 1 ? 'conteúdo selecionado' : 'conteúdos selecionados' }}</strong>
                  <button type="button" class="link-button" [disabled]="!selectedPublicationIds().length || saving() || entriesAdded()" (click)="clearPublicationSelection()">Limpar seleção</button>
                  <small>{{ selectedPublicationSummary() || 'Selecione conteúdos.' }}</small>
                  <small class="add-content-schedule-note">{{ selected()?.name }} · {{ sharedSchedule().startTime }}–{{ sharedSchedule().endTime }}</small>
                  @if (saving() && scheduleProgress().total) {
                    <small class="add-content-progress" role="status" aria-live="polite">Agendando {{ scheduleProgress().completed }} de {{ scheduleProgress().total }} períodos diários…</small>
                  }
                </div>
                <div class="actions">
                  <button class="btn" type="button" [disabled]="saving()" (click)="closeModal()">Cancelar</button>
                  <button class="btn primary" type="submit" [disabled]="saving() || !selectedPublicationIds().length || !schedulesValid()">
                    {{ entriesAdded() ? 'Revisar e retomar agendamentos' : 'Revisar e agendar ' + selectedPublicationIds().length + (selectedPublicationIds().length === 1 ? ' conteúdo' : ' conteúdos') }}
                  </button>
                </div>
              </div>
            }
          </form>
        </app-modal>
      }
    }

    @if (pendingDeletion(); as program) {
      <app-modal title="Excluir programação?" (closed)="closeDeleteConfirmation()">
        <div class="confirm-content program-delete-confirm">
          <span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span>
          <h2>Excluir “{{ program.name }}”?</h2>
          <p class="muted">A sequência e os agendamentos sairão do calendário. O histórico e as publicações serão mantidos.</p>
          @if (deleteError()) { <p class="error" role="alert">{{ deleteError() }}</p> }
          <div class="actions">
            <button class="btn" type="button" [disabled]="deleting()" (click)="closeDeleteConfirmation()">Cancelar</button>
            <button class="btn danger-button" type="button" [disabled]="deleting()" (click)="confirmDelete(program)">
              {{ deleting() ? 'Excluindo…' : 'Excluir programação' }}
            </button>
          </div>
        </div>
      </app-modal>
    }

    @if (pendingTokenRenewal()) {
      <app-modal title="Renovar link da TV?" (closed)="pendingTokenRenewal.set(false)">
        <div class="confirm-content">
          <span class="confirm-icon danger"><app-icon name="info" [size]="22"/></span>
          <p class="muted">Os links atuais de todas as programações serão invalidados. Atualize cada TV.</p>
          <div class="actions">
            <button class="btn" type="button" [disabled]="generatingToken()" (click)="pendingTokenRenewal.set(false)">Manter links atuais</button>
            <button class="btn danger-button" type="button" [disabled]="generatingToken()" (click)="confirmTokenRenewal()">{{ generatingToken() ? 'Renovando…' : 'Renovar todos os links' }}</button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ProgramsPage implements OnInit {
  readonly auth = inject(AuthState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listProgramsUseCase = inject(ListProgramsUseCase);
  private readonly updateProgramUseCase = inject(UpdateProgramUseCase);
  private readonly deleteProgramUseCase = inject(DeleteProgramUseCase);
  private readonly addProgramEntriesUseCase = inject(AddProgramEntriesUseCase);
  private readonly scheduleProgramEntriesUseCase = inject(ScheduleProgramEntriesUseCase);
  private readonly listScheduleUseCase = inject(ListScheduleUseCase);
  private readonly removeProgramEntryUseCase = inject(RemoveProgramEntryUseCase);
  private readonly listPublicationsUseCase = inject(ListPublicationsUseCase);
  private readonly generatePlayerTokenUseCase = inject(GeneratePlayerTokenUseCase);
  private readonly toastService = inject(ToastService);
  readonly typeName = publicationTypeName;

  programs = signal<Program[]>([]);
  publications = signal<Publication[]>([]);
  publicationsLoading = signal(false);
  publicationsLoadError = signal('');
  selected = signal<Program | null>(null);
  search = signal('');
  statusFilter = signal<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  modal = signal(false);
  modalMode = signal<'edit' | 'add'>('edit');
  selectedPublicationIds = signal<number[]>([]);
  publicationSearch = signal('');
  publicationTypeFilter = signal<'ALL' | Publication['type']>('ALL');
  sharedSchedule = signal<PublicationScheduleForm>({ date: '', endDate: '', startTime: '', endTime: '' });
  scheduledEntries = signal<Array<Pick<ScheduleEntry, 'publicationId' | 'date'>>>([]);
  entriesAdded = signal(false);
  reviewingEntries = signal(false);
  previewOpen = signal(false);
  scheduleProgress = signal({ completed: 0, total: 0 });
  today = currentBusinessDate();
  currentBusinessTime = signal(currentBusinessTime());
  name = '';
  saving = signal(false);
  generatingToken = signal(false);
  error = signal('');
  pendingDeletion = signal<Program | null>(null);
  pendingTokenRenewal = signal(false);
  deleteError = signal('');
  deleting = signal(false);
  programSchedules = signal<ScheduleEntry[]>([]);
  programScheduleLoading = signal(false);
  programScheduleError = signal('');
  private publicationsLoaded = false;
  previewItems = computed<ProgramPreviewItem[]>(() => (this.selected()?.entries ?? []).map(entry => this.previewItem(entry)));
  upcomingSchedules = computed(() => this.programSchedules()
    .filter(entry => entry.date > this.today || (entry.date === this.today && entry.endTime > this.currentBusinessTime()))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
  reviewScheduleCount = computed(() => this.selectedPublicationIds().reduce((count, id) =>
    count + this.datesFor().filter(date => !this.isScheduled(id, date)).length, 0));
  calendarReviewRows = computed(() => this.selectedPublicationIds().map(id => {
    const publication = this.publicationFor(id);
    return {
      id,
      title: this.publicationTitle(id),
      type: publication?.type ?? 'LINK',
      status: this.scheduleComplete(id) ? 'Agendado' : 'Disponível',
      scheduleSummary: `${this.scheduledCount(id)} de ${this.datesFor().length} dias agendados`,
    };
  }));
  selectedPublicationSummary = computed(() => this.selectedPublicationIds().map(id => this.publicationTitle(id)).join(' · '));
  filteredPrograms = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.programs().filter(program =>
      program.name.toLocaleLowerCase().includes(query) &&
      (status === 'ALL' || program.active === (status === 'ACTIVE')),
    );
  });
  availablePublications = computed(() => {
    const assigned = new Set(this.selected()?.entries.map(entry => entry.publicationId) ?? []);
    const retryingSelection = new Set(this.entriesAdded() ? this.selectedPublicationIds() : []);
    return this.publications().filter(publication =>
      publication.status === 'READY' && (!assigned.has(publication.id) || retryingSelection.has(publication.id)),
    );
  });
  filteredAvailablePublications = computed(() => {
    const query = this.publicationSearch().trim().toLocaleLowerCase();
    const type = this.publicationTypeFilter();
    return this.availablePublications().filter(publication =>
      (!query || publication.title.toLocaleLowerCase().includes(query)) &&
      (type === 'ALL' || publication.type === type),
    );
  });
  playerToken = computed(() => this.auth.user()?.playerToken ?? null);
  schedulesValid = computed(() => {
    const schedule = this.sharedSchedule();
    const valid = datesBetweenInclusive(schedule.date, schedule.endDate).length > 0 && schedule.date >= this.today &&
      !!schedule.startTime && !!schedule.endTime && toMinutes(schedule.endTime) > toMinutes(schedule.startTime);
    return this.selectedPublicationIds().every(id => {
      if (this.scheduleComplete(id)) return true;
      return valid;
    });
  });

  ngOnInit(): void {
    this.loadPublications();
    this.load();
  }

  loadPublications(): void {
    if (this.publicationsLoading() || this.publicationsLoaded) return;
    this.publicationsLoading.set(true);
    this.publicationsLoadError.set('');
    this.listPublicationsUseCase.execute().subscribe({
      next: publications => {
        this.publications.set(publications);
        this.publicationsLoaded = true;
        this.publicationsLoading.set(false);
      },
      error: error => {
        this.publicationsLoadError.set(errorMessage(error));
        this.publicationsLoading.set(false);
      },
    });
  }

  load(): void {
    this.listProgramsUseCase.execute().subscribe({
      next: programs => {
        const ownerId = this.auth.user()?.id;
        const ownedPrograms = programs.filter(program => program.createdById === ownerId);
        this.programs.set(ownedPrograms);
        const requestedProgramId = Number(this.route.snapshot.queryParamMap.get('programId'));
        const selected = this.selected();
        const target = ownedPrograms.find(program => program.id === requestedProgramId)
          ?? (selected ? ownedPrograms.find(program => program.id === selected.id) : undefined);
        this.selected.set(target ?? null);
        if (target) this.loadProgramSchedule(target.id);
        else this.programSchedules.set([]);
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  select(program: Program): void {
    this.selected.set(program);
    this.loadProgramSchedule(program.id);
    if (this.route.snapshot.queryParamMap.has('programId')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { programId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }
  duration(entry: Program['entries'][number]): number {
    if (entry.publicationType === 'VIDEO') return Math.min(entry.displaySeconds ?? entry.originalDurationSeconds ?? 10, entry.originalDurationSeconds ?? 10);
    return entry.displaySeconds ?? 10;
  }
  private previewItem(entry: Program['entries'][number]): ProgramPreviewItem {
    const schedule = this.upcomingSchedules().find(item => item.publicationId === entry.publicationId);
    return {
      title: entry.publicationTitle,
      type: entry.publicationType,
      content: entry.publicationContent,
      mediaId: entry.mediaFileId,
      linkUrl: entry.linkUrl,
      seconds: schedule ? Math.min(this.duration(entry), schedule.turnSeconds ?? this.duration(entry)) : this.duration(entry),
      schedule: schedule ? `${this.formatDate(schedule.date)} · ${schedule.startTime}–${schedule.endTime}` : undefined,
    };
  }
  playerUrl(token: string, programId: number): string { return `${location.origin}/player/${token}/program/${programId}`; }

  openCreate(): void {
    this.router.navigate(['/programacao/nova']);
  }

  openEdit(program: Program): void {
    this.modalMode.set('edit');
    this.name = program.name;
    this.error.set('');
    this.modal.set(true);
  }

  openAddEntries(): void {
    this.loadPublications();
    this.modalMode.set('add');
    this.selectedPublicationIds.set([]);
    this.publicationSearch.set('');
    this.publicationTypeFilter.set('ALL');
    this.sharedSchedule.set(this.defaultPublicationSchedule());
    this.scheduledEntries.set([]);
    this.entriesAdded.set(false);
    this.reviewingEntries.set(false);
    this.error.set('');
    this.modal.set(true);
  }

  hasPublicationFilters(): boolean {
    return !!this.publicationSearch().trim() || this.publicationTypeFilter() !== 'ALL';
  }

  clearPublicationFilters(): void {
    this.publicationSearch.set('');
    this.publicationTypeFilter.set('ALL');
  }

  clearPublicationSelection(): void {
    if (this.saving() || this.entriesAdded()) return;
    this.selectedPublicationIds.set([]);
  }

  closeModal(): void {
    if (this.saving() || (this.modalMode() === 'add' && this.entriesAdded() &&
      !this.selectedPublicationIds().every(id => this.scheduleComplete(id)))) return;
    this.modal.set(false);
  }

  saveProgram(): void {
    const current = this.selected();
    if (!current) return;
    this.saving.set(true);
    this.updateProgramUseCase.execute(current.id, { name: this.name.trim() }).subscribe({
      next: program => {
        this.saving.set(false);
        this.modal.set(false);
        this.selected.set(program);
        this.toastService.show('Programação atualizada');
        this.load();
      },
      error: error => { this.saving.set(false); this.error.set(errorMessage(error)); },
    });
  }

  toggle(program: Program): void {
    this.updateProgramUseCase.execute(program.id, { active: !program.active }).subscribe({
      next: updated => { this.selected.set(updated); this.toastService.show(updated.active ? 'Programação ativada' : 'Programação pausada'); this.load(); },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  togglePublication(id: number, event: Event): void {
    if (this.entriesAdded()) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPublicationIds.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
  }

  private defaultPublicationSchedule(): PublicationScheduleForm {
    let startMinute = toMinutes(currentBusinessTime());
    let endMinute = startMinute + 60;
    if (endMinute > 1439) {
      startMinute = 1380;
      endMinute = 1439;
    }
    const formatTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    return {
      date: this.today,
      endDate: this.today,
      startTime: formatTime(startMinute),
      endTime: formatTime(endMinute),
    };
  }

  datesFor(): string[] {
    const schedule = this.sharedSchedule();
    return datesBetweenInclusive(schedule.date, schedule.endDate);
  }

  scheduledCount(id: number): number {
    return this.datesFor().filter(date => this.isScheduled(id, date)).length;
  }

  scheduleComplete(id: number): boolean {
    const dates = this.datesFor();
    return dates.length > 0 && this.scheduledCount(id) === dates.length;
  }

  private isScheduled(publicationId: number, date: string): boolean {
    return this.scheduledEntries().some(entry => entry.publicationId === publicationId && entry.date === date);
  }

  updateSharedSchedule(field: keyof PublicationScheduleForm, value: string): void {
    this.sharedSchedule.update(schedule => {
      const updated = { ...schedule, [field]: value };
      if (field === 'date' && updated.endDate < value) updated.endDate = value;
      if (field === 'endDate' && value < updated.date) updated.date = value;
      return updated;
    });
  }

  saveEntries(): void {
    const program = this.selected();
    if (!program) return;
    this.error.set('');
    this.reviewingEntries.set(true);
  }

  confirmSaveEntries(): void {
    const program = this.selected();
    if (!program) return;
    this.reviewingEntries.set(false);
    this.saving.set(true);
    if (this.entriesAdded()) {
      this.scheduleEntries(program);
      return;
    }
    this.addProgramEntriesUseCase.execute(program.id, this.selectedPublicationIds()).subscribe({
      next: updated => {
        this.entriesAdded.set(true);
        this.selected.set(updated);
        this.programs.update(programs => programs.map(item => item.id === updated.id ? updated : item));
        this.scheduleEntries(updated);
      },
      error: error => { this.saving.set(false); this.error.set(errorMessage(error)); },
    });
  }

  private scheduleEntries(program: Program): void {
    const schedule = this.sharedSchedule();
    this.scheduleProgress.set({ completed: 0, total: 0 });
    this.scheduleProgramEntriesUseCase.execute({
      programId: program.id,
      publicationIds: this.selectedPublicationIds(),
      dates: this.datesFor(),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      alreadyScheduled: this.scheduledEntries(),
    }).subscribe({
      next: event => {
        if (event.type === 'started') {
          this.scheduleProgress.set({ completed: 0, total: event.total });
          return;
        }
        this.scheduleProgress.set({ completed: event.completed, total: event.total });
        this.scheduledEntries.update(entries => [
          ...entries,
          { publicationId: event.entry.publicationId, date: event.entry.date },
        ]);
      },
      error: error => {
        this.saving.set(false);
        if (!(error instanceof ScheduleProgramEntriesError)) {
          this.error.set(errorMessage(error));
          return;
        }
        const title = this.publicationTitle(error.task.publicationId);
        const partial = error.completed
          ? ` ${error.completed} ${error.completed === 1 ? 'agendamento concluído' : 'agendamentos concluídos'}.`
          : '';
        this.error.set(`${errorMessage(error.originalError)} Falha ao agendar “${title}” em ${this.formatDate(error.task.date)}.${partial} Ajuste o período e tente novamente.`);
      },
      complete: () => this.finishAddingEntries(),
    });
  }

  private finishAddingEntries(): void {
    const contents = this.selectedPublicationIds().length;
    const schedules = this.scheduledEntries().length;
    this.saving.set(false);
    this.modal.set(false);
    this.load();
    this.toastService.show(`${contents} conteúdo(s) adicionados em ${schedules} agendamento(s) diário(s).`);
  }

  scheduleProgressPercent(): number {
    const { completed, total } = this.scheduleProgress();
    return total ? Math.round(completed / total * 100) : 0;
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }

  publicationTitle(id: number): string {
    return this.publications().find(publication => publication.id === id)?.title ?? `Conteúdo ${id}`;
  }

  publicationFor(id: number): Publication | undefined {
    return this.publications().find(publication => publication.id === id);
  }

  removeEntry(program: Program, entryId: number): void {
    this.removeProgramEntryUseCase.execute(program.id, entryId).subscribe({
      next: updated => { this.selected.set(updated); this.load(); this.toastService.show('Conteúdo removido da programação'); },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  requestDelete(program: Program): void {
    this.deleteError.set('');
    this.pendingDeletion.set(program);
  }

  closeDeleteConfirmation(): void {
    if (this.deleting()) return;
    this.pendingDeletion.set(null);
    this.deleteError.set('');
  }

  confirmDelete(program: Program): void {
    this.deleting.set(true);
    this.deleteError.set('');
    this.deleteProgramUseCase.execute(program.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDeletion.set(null);
        this.selected.set(null);
        this.load();
        this.toastService.show('Programação excluída');
      },
      error: error => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(error));
      },
    });
  }

  generatePlayerToken(): void {
    if (this.auth.user()?.hasPlayerToken) {
      this.pendingTokenRenewal.set(true);
      return;
    }
    this.issuePlayerToken();
  }

  confirmTokenRenewal(): void {
    this.pendingTokenRenewal.set(false);
    this.issuePlayerToken();
  }

  private issuePlayerToken(): void {
    this.generatingToken.set(true);
    this.generatePlayerTokenUseCase.execute().subscribe({
      next: token => {
        this.generatingToken.set(false);
        this.auth.setPlayerToken(token);
        this.toastService.show('Link renovado. Atualize o endereço em todas as TVs que usam suas programações.');
      },
      error: error => { this.generatingToken.set(false); this.error.set(errorMessage(error)); },
    });
  }

  loadProgramSchedule(programId: number): void {
    this.currentBusinessTime.set(currentBusinessTime());
    const start = this.today;
    const endDate = new Date(`${start}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 29);
    const end = endDate.toISOString().slice(0, 10);
    this.programScheduleLoading.set(true);
    this.programScheduleError.set('');
    this.listScheduleUseCase.execute({ from: start, to: end }).subscribe({
      next: entries => {
        this.programSchedules.set(entries.filter(entry => entry.programId === programId));
        this.programScheduleLoading.set(false);
      },
      error: error => {
        this.programSchedules.set([]);
        this.programScheduleError.set(errorMessage(error));
        this.programScheduleLoading.set(false);
      },
    });
  }

  copyPlayerUrl(programId: number): void {
    const token = this.playerToken();
    if (!token) return;
    navigator.clipboard.writeText(this.playerUrl(token, programId)).then(
      () => this.toastService.show('Link copiado'),
      () => this.error.set('Não foi possível copiar o link. Selecione e copie o endereço manualmente.'),
    );
  }
}
