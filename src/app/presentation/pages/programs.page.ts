import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import {
  AddProgramEntriesUseCase, DeleteProgramUseCase, ListProgramsUseCase, RemoveProgramEntryUseCase, UpdateProgramUseCase,
} from '@application/program/program.usecases';
import { CreateScheduleEntryUseCase, ListScheduleUseCase } from '@application/schedule/schedule.usecases';
import { GeneratePlayerTokenUseCase } from '@application/user/user.usecases';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { datesBetweenInclusive, toMinutes } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { ProgramPreviewComponent, ProgramPreviewItem } from '@presentation/ui/program-preview.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';
import { concatMap, from } from 'rxjs';

interface PublicationScheduleInput { date: string; endDate: string; startTime: string; endTime: string; }

const businessDate = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const businessTime = (): string => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date());

@Component({
  selector: 'app-programs',
  imports: [FormsModule, IconComponent, ModalComponent, ProgramPreviewComponent, SecureMediaComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Programação</h1><p class="muted">Organize conteúdos em sequência e conecte cada programação a uma TV.</p></div>
      <button class="btn primary" type="button" (click)="openCreate()"><app-icon name="plus" [size]="18"/> Criar programação</button>
    </header>

    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }
    <section class="summary-grid">
      <article class="card summary-card"><strong>{{ activeCount() }}</strong><div><span>Programações ativas</span><small>{{ programs().length - activeCount() }} pausadas</small></div></article>
      <article class="card summary-card"><strong>{{ entryCount() }}</strong><div><span>Conteúdos em sequência</span><small>Reprodução contínua na TV</small></div></article>
    </section>

    <section class="card table-card">
      <div class="card-head program-list-head">
        <div class="program-list-title"><strong>Programações cadastradas</strong><span class="chip">{{ filteredPrograms().length }} {{ filteredPrograms().length === 1 ? 'registro' : 'registros' }}</span></div>
        <div class="program-list-tools">
          <label class="search-field program-search"><app-icon name="search" [size]="16"/><input class="input" type="search" placeholder="Buscar programação" aria-label="Buscar programação" [ngModel]="search()" (ngModelChange)="search.set($event)"></label>
          <select class="input program-status-select" aria-label="Filtrar programações por status" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativas</option>
            <option value="PAUSED">Pausadas</option>
          </select>
        </div>
      </div>
      <div class="program-table">
        <div class="program-table-head"><span>Programação</span><span>Conteúdos na sequência</span><span>Estado</span><span>Acesso</span></div>
        @for (program of filteredPrograms(); track program.id) {
          <button type="button" class="program-row" [class.selected]="selected()?.id === program.id" (click)="select(program)">
            <strong class="program-name">{{ program.name }}</strong>
            <span class="program-meta"><span>{{ program.entries.length }} {{ program.entries.length === 1 ? 'conteúdo na sequência' : 'conteúdos na sequência' }}</span><small>{{ programSummary(program) }}</small></span>
            <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span>
            <span class="program-open">Ver detalhes <app-icon name="right" [size]="15"/></span>
          </button>
        } @empty {
          <div class="empty">
            <p>{{ programs().length ? 'Nenhuma programação corresponde à busca ou ao filtro.' : 'Sua primeira programação começa aqui.' }}</p>
            <p class="muted">{{ programs().length ? 'Ajuste os filtros e tente novamente.' : 'Organize conteúdos e conecte uma TV em poucos passos.' }}</p>
            @if (!programs().length) { <button class="btn primary" type="button" (click)="openCreate()">Criar minha primeira programação</button> }
          </div>
        }
      </div>
      <div class="table-foot">Exibindo {{ filteredPrograms().length }} de {{ programs().length }} programações</div>
    </section>

    @if (selected(); as program) {
      <section class="card program-detail">
        <div class="row-between">
          <div><small class="muted">Programação selecionada</small><h2>{{ program.name }} <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span></h2></div>
          <div class="actions">
            <button class="btn" type="button" [disabled]="!program.entries.length" (click)="previewOpen.set(true)">
              <app-icon name="play" [size]="16"/> Prévia na TV
            </button>
            <button class="btn" type="button" (click)="toggle(program)">{{ program.active ? 'Pausar' : 'Ativar' }}</button>
            <button class="btn" type="button" (click)="openEdit(program)">Editar nome</button>
            <button class="btn primary" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="16"/> Adicionar conteúdo</button>
            <button class="btn program-delete-button" type="button" (click)="requestDelete(program)"><app-icon name="trash" [size]="16"/> Excluir programação</button>
          </div>
        </div>

        <div class="program-readiness">
          <div>
            <strong>Próximo passo para a TV</strong>
            @if (programScheduleLoading()) {
              <small>Consultando os horários dos próximos 30 dias…</small>
            } @else if (programScheduleError()) {
              <small>{{ programScheduleError() }} <button class="link-button" type="button" (click)="loadProgramSchedule(program.id)">Tentar novamente</button></small>
            } @else if (upcomingSchedules().length) {
              <small>{{ upcomingSchedules().length }} período(s) agendado(s) nos próximos 30 dias. Próximo: {{ formatDate(upcomingSchedules()[0].date) }}, {{ upcomingSchedules()[0].startTime }}–{{ upcomingSchedules()[0].endTime }}.</small>
            } @else {
              <small>Nenhum horário encontrado nos próximos 30 dias. A sequência e o calendário são configurações diferentes; agende os períodos antes de esperar conteúdo na TV.</small>
            }
          </div>
          <span class="status" [class.live]="program.active && program.entries.length > 0 && upcomingSchedules().length > 0 && !!playerToken()">
            {{ !program.active ? 'Pausada' : !program.entries.length ? 'Sem sequência' : programScheduleLoading() ? 'Consultando' : programScheduleError() ? 'Não verificado' : !upcomingSchedules().length ? 'Sem horário próximo' : playerToken() ? 'Pronta para testar' : 'Gerar link da TV' }}
          </span>
        </div>
        <p class="program-sequence-note">A lista abaixo é a sequência de reprodução. Os agendamentos no calendário são janelas de exibição: fora delas, o player não mostra esses conteúdos.</p>
        <div class="program-tv-link">
          <div><strong>Conectar esta programação à TV</strong><small>O link identifica “{{ program.name }}”. Abra-o no navegador da própria TV e confira o nome no canto da tela. O app não confirma remotamente se a TV está online.</small></div>
          @if (playerToken(); as token) {
            <div class="program-tv-actions">
              <input class="input" aria-label="Link da programação para TV" readonly [value]="playerUrl(token, program.id)">
              <button class="btn small" type="button" (click)="copyPlayerUrl(program.id)">Copiar link</button>
              <a class="btn small" [href]="playerUrl(token, program.id)" target="_blank" rel="noopener">Testar neste navegador</a>
            </div>
          } @else {
            <button class="btn small" type="button" [disabled]="generatingToken()" (click)="generatePlayerToken()">
              {{ generatingToken() ? 'Gerando…' : auth.user()?.hasPlayerToken ? 'Renovar link da TV' : 'Gerar link para TV' }}
            </button>
          }
        </div>
        @if (!playerToken() && auth.user()?.hasPlayerToken) {
          <p class="notice warning-notice">O token anterior não pode ser recuperado. Renovar o link invalida todos os links de TV já emitidos.</p>
        }

        @for (entry of program.entries; track entry.id; let index = $index) {
          <div class="program-entry">
            <div class="entry-date">{{ (index + 1).toString().padStart(2, '0') }}</div>
            <div class="grow"><strong>{{ entry.publicationTitle }}</strong><div class="muted">{{ typeName(entry.publicationType) }} · {{ duration(entry) }} s</div></div>
            <button type="button" class="icon-btn danger" aria-label="Remover conteúdo da programação" (click)="removeEntry(program, entry.id)"><app-icon name="trash" [size]="18"/></button>
          </div>
        } @empty {
          <div class="empty program-detail-empty">
            <p>Esta programação está pronta para receber conteúdos.</p>
            <p class="muted">Adicione a sequência para visualizar como ela ficará na TV.</p>
            <button class="btn primary" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="16"/> Adicionar primeiro conteúdo</button>
          </div>
        }
      </section>
      <app-program-preview
        [title]="'Prévia · ' + program.name"
      [items]="previewItems()"
        [open]="previewOpen()"
        (closed)="previewOpen.set(false)"/>
    }

    @if (modal()) {
      <app-modal [title]="modalMode() === 'edit' ? 'Editar programação' : 'Adicionar conteúdos'" (closed)="closeModal()">
        @if (modalMode() === 'edit') {
          <form class="stack" (ngSubmit)="saveProgram()">
            <label class="field">Nome da programação<input class="input" name="name" [(ngModel)]="name" maxlength="120" required></label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || name.trim().length < 2">Salvar alterações</button>
          </form>
        } @else {
          <form class="stack" (ngSubmit)="saveEntries()">
            @if (reviewingEntries()) {
              <div class="program-review">
                <p class="muted">A sequência define a ordem; as datas e os horários definem quando cada item pode aparecer. A API validará conflitos ao salvar. Se houver falha parcial, os períodos concluídos serão mantidos.</p>
                <div class="program-review-heading">
                  <strong>{{ selected()?.name }}</strong>
                  <span>{{ selectedPublicationIds().length }} conteúdos selecionados · {{ reviewScheduleCount() }} períodos diários</span>
                </div>
                <ol class="program-review-list">
                  @for (id of selectedPublicationIds(); track id; let index = $index) {
                    <li>
                      <span class="program-position">{{ (index + 1).toString().padStart(2, '0') }}</span>
                      <span><strong>{{ publicationTitle(id) }}</strong><small>{{ scheduleSummary(id) }}</small></span>
                    </li>
                  }
                </ol>
                @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
                <div class="actions">
                  <button class="btn" type="button" [disabled]="saving()" (click)="reviewingEntries.set(false)">Voltar e revisar</button>
                  <button class="btn primary" type="button" [disabled]="saving()" (click)="confirmSaveEntries()">
                    {{ saving() ? 'Salvando…' : entriesAdded() ? 'Retomar agendamentos' : 'Confirmar e adicionar' }}
                  </button>
                </div>
              </div>
            } @else {
            <p class="muted">Selecione os conteúdos e informe a data e os horários em que cada um será exibido.</p>
            <div class="entry-picker">
              @for (publication of availablePublications(); track publication.id) {
                <div class="entry-option">
                  <label class="entry-option-content">
                    <input type="checkbox" [checked]="selectedPublicationIds().includes(publication.id)" [disabled]="entriesAdded()" (change)="togglePublication(publication.id, $event)">
                    <span class="add-content-thumb"><app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/></span>
                    <span><strong>{{ publication.title }}</strong><small>{{ typeName(publication.type) }} · {{ publication.displaySeconds ?? publication.originalDurationSeconds ?? 10 }} s</small></span>
                  </label>
                  @if (selectedPublicationIds().includes(publication.id)) {
                    <div class="program-schedule-fields">
                      @if (scheduleComplete(publication.id)) {
                        <span class="program-scheduled-label"><app-icon name="check" [size]="14"/> Agendado</span>
                      } @else {
                        <label>Data
                          <input class="input" type="date" [name]="'programDate' + publication.id" [min]="today" required
                            [disabled]="saving()" [ngModel]="scheduleFor(publication.id).date"
                            (ngModelChange)="updateSchedule(publication.id, 'date', $event)">
                        </label>
                        <label>Até (inclusive)
                          <input class="input" type="date" [name]="'programEndDate' + publication.id" [min]="scheduleFor(publication.id).date || today" required
                            [disabled]="saving()" [ngModel]="scheduleFor(publication.id).endDate"
                            (ngModelChange)="updateSchedule(publication.id, 'endDate', $event)">
                        </label>
                        <label>Início
                          <input class="input" type="time" [name]="'programStart' + publication.id" required
                            [disabled]="saving()" [ngModel]="scheduleFor(publication.id).startTime"
                            (ngModelChange)="updateSchedule(publication.id, 'startTime', $event)">
                        </label>
                        <label>Fim
                          <input class="input" type="time" [name]="'programEnd' + publication.id" required
                            [disabled]="saving()" [ngModel]="scheduleFor(publication.id).endTime"
                            (ngModelChange)="updateSchedule(publication.id, 'endTime', $event)">
                        </label>
                        @if (scheduledCount(publication.id)) {
                          <small class="program-scheduled-progress">{{ scheduledCount(publication.id) }} de {{ datesFor(publication.id).length }} dias já agendados</small>
                        }
                      }
                    </div>
                  }
                </div>
              } @empty { <p class="muted">Não há conteúdos publicados disponíveis. Publique conteúdos na biblioteca primeiro.</p> }
            </div>
            @if (saving() && scheduleProgress().total) {
              <div class="program-progress" role="status" aria-live="polite">
                <span>Agendando {{ scheduleProgress().completed }} de {{ scheduleProgress().total }} períodos diários…</span>
                <span class="program-progress-track"><i [style.width.%]="scheduleProgressPercent()"></i></span>
              </div>
            }
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || !selectedPublicationIds().length || !schedulesValid()">
              {{ saving() ? 'Salvando…' : entriesAdded() ? 'Revisar e retomar agendamentos' : 'Revisar conteúdos e horários' }}
            </button>
            }
          </form>
        }
      </app-modal>
    }

    @if (pendingDeletion(); as program) {
      <app-modal title="Excluir programação?" (closed)="closeDeleteConfirmation()">
        <div class="confirm-content program-delete-confirm">
          <span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span>
          <h2>Excluir “{{ program.name }}”?</h2>
          <p class="muted">A programação e sua sequência de conteúdos serão excluídas. Os agendamentos vinculados sairão do calendário, mas serão preservados no histórico de relatórios. As publicações continuarão na biblioteca.</p>
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
          <h2>Os links já compartilhados deixarão de funcionar.</h2>
          <p class="muted">A renovação substitui o token da conta e afeta todas as programações ligadas a ele. Será necessário atualizar o endereço em cada TV.</p>
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
  auth = inject(AuthState);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private listUC = inject(ListProgramsUseCase);
  private updateUC = inject(UpdateProgramUseCase);
  private deleteUC = inject(DeleteProgramUseCase);
  private addEntriesUC = inject(AddProgramEntriesUseCase);
  private createScheduleUC = inject(CreateScheduleEntryUseCase);
  private listScheduleUC = inject(ListScheduleUseCase);
  private removeEntryUC = inject(RemoveProgramEntryUseCase);
  private publicationsUC = inject(ListPublicationsUseCase);
  private tokenUC = inject(GeneratePlayerTokenUseCase);
  private toast = inject(ToastService);

  programs = signal<Program[]>([]);
  publications = signal<Publication[]>([]);
  selected = signal<Program | null>(null);
  search = signal('');
  statusFilter = signal<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  modal = signal(false);
  modalMode = signal<'edit' | 'add'>('edit');
  selectedPublicationIds = signal<number[]>([]);
  schedules = signal<Record<number, PublicationScheduleInput>>({});
  scheduledScheduleKeys = signal<string[]>([]);
  entriesAdded = signal(false);
  reviewingEntries = signal(false);
  previewOpen = signal(false);
  scheduleProgress = signal({ completed: 0, total: 0 });
  today = businessDate();
  currentBusinessTime = signal(businessTime());
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
  activeCount = computed(() => this.programs().filter(program => program.active).length);
  entryCount = computed(() => this.programs().reduce((count, program) => count + program.entries.length, 0));
  previewItems = computed<ProgramPreviewItem[]>(() => (this.selected()?.entries ?? []).map(entry => this.previewItem(entry)));
  upcomingSchedules = computed(() => this.programSchedules()
    .filter(entry => entry.date > this.today || (entry.date === this.today && entry.endTime > this.currentBusinessTime()))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
  reviewScheduleCount = computed(() => this.selectedPublicationIds().reduce((count, id) =>
    count + this.datesFor(id).filter(date => !this.scheduledScheduleKeys().includes(this.scheduleKey(id, date))).length, 0));
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
  playerToken = computed(() => this.auth.user()?.playerToken ?? null);
  schedulesValid = computed(() => this.selectedPublicationIds().every(id => {
    if (this.scheduleComplete(id)) return true;
    const schedule = this.scheduleFor(id);
    return datesBetweenInclusive(schedule.date, schedule.endDate).length > 0 && schedule.date >= this.today &&
      !!schedule.startTime && !!schedule.endTime &&
      toMinutes(schedule.endTime) > toMinutes(schedule.startTime);
  }));

  ngOnInit(): void {
    this.publicationsUC.execute().subscribe({
      next: publications => this.publications.set(publications),
      error: error => this.error.set(errorMessage(error)),
    });
    this.load();
  }

  load(): void {
    this.listUC.execute().subscribe({
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
  typeName(type: string): string { return type === 'IMAGE' ? 'Imagem' : type === 'VIDEO' ? 'Vídeo' : 'Link'; }
  programSummary(program: Program): string {
    const titles = program.entries.slice(0, 2).map(entry => entry.publicationTitle);
    if (!titles.length) return 'Nenhum conteúdo na sequência';
    return titles.length < program.entries.length ? `${titles.join(' · ')} · +${program.entries.length - titles.length}` : titles.join(' · ');
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
    this.modalMode.set('add');
    this.selectedPublicationIds.set([]);
    this.schedules.set({});
    this.scheduledScheduleKeys.set([]);
    this.entriesAdded.set(false);
    this.reviewingEntries.set(false);
    this.error.set('');
    this.modal.set(true);
  }

  closeModal(): void {
    if (this.saving() || (this.modalMode() === 'add' && this.entriesAdded() &&
      !this.selectedPublicationIds().every(id => this.scheduleComplete(id)))) return;
    this.modal.set(false);
  }

  saveProgram(): void {
    const current = this.selected();
    this.saving.set(true);
    const request = current ? this.updateUC.execute(current.id, { name: this.name.trim() }) : null;
    if (!request) { this.saving.set(false); return; }
    request.subscribe({
      next: program => {
        this.saving.set(false);
        this.modal.set(false);
        this.selected.set(program);
        this.toast.show('Programação atualizada');
        this.load();
      },
      error: error => { this.saving.set(false); this.error.set(errorMessage(error)); },
    });
  }

  toggle(program: Program): void {
    this.updateUC.execute(program.id, { active: !program.active }).subscribe({
      next: updated => { this.selected.set(updated); this.toast.show(updated.active ? 'Programação ativada' : 'Programação pausada'); this.load(); },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  togglePublication(id: number, event: Event): void {
    if (this.entriesAdded()) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPublicationIds.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
    if (!checked) {
      this.schedules.update(schedules => {
        const { [id]: _removed, ...remaining } = schedules;
        return remaining;
      });
    }
  }

  scheduleFor(id: number): PublicationScheduleInput {
    return this.schedules()[id] ?? { date: '', endDate: '', startTime: '', endTime: '' };
  }

  datesFor(id: number): string[] {
    const schedule = this.scheduleFor(id);
    return datesBetweenInclusive(schedule.date, schedule.endDate);
  }

  scheduledCount(id: number): number {
    return this.datesFor(id).filter(date => this.scheduledScheduleKeys().includes(this.scheduleKey(id, date))).length;
  }

  scheduleComplete(id: number): boolean {
    const dates = this.datesFor(id);
    return dates.length > 0 && this.scheduledCount(id) === dates.length;
  }

  updateSchedule(id: number, field: keyof PublicationScheduleInput, value: string): void {
    this.schedules.update(schedules => ({
      ...schedules,
      [id]: { ...this.scheduleFor(id), [field]: value },
    }));
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
    this.addEntriesUC.execute(program.id, this.selectedPublicationIds()).subscribe({
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
    const pending = this.selectedPublicationIds().flatMap(publicationId =>
      this.datesFor(publicationId)
        .filter(date => !this.scheduledScheduleKeys().includes(this.scheduleKey(publicationId, date)))
        .map(date => ({ publicationId, date })),
    );
    if (!pending.length) {
      this.finishAddingEntries();
      return;
    }

    this.scheduleProgress.set({ completed: 0, total: pending.length });
    let scheduledNow = 0;
    let activeItem = pending[0];
    from(pending).pipe(
      concatMap(({ publicationId, date }) => {
        activeItem = { publicationId, date };
        const schedule = this.scheduleFor(publicationId);
        return this.createScheduleUC.execute({
          publicationId,
          programId: program.id,
          date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        });
      }),
    ).subscribe({
      next: entry => {
        scheduledNow++;
        this.scheduleProgress.update(progress => ({ ...progress, completed: scheduledNow }));
        this.scheduledScheduleKeys.update(keys => [...keys, this.scheduleKey(entry.publicationId, entry.date)]);
      },
      error: error => {
        this.saving.set(false);
        const title = this.publications().find(publication => publication.id === activeItem.publicationId)?.title ?? `Conteúdo ${activeItem.publicationId}`;
        const partial = scheduledNow ? ` ${scheduledNow} agendamento(s) já foram concluídos.` : '';
        this.error.set(`${errorMessage(error)} Não foi possível agendar “${title}” em ${this.formatDate(activeItem.date)}.${partial} Ajuste o período ou horário e tente concluir novamente.`);
      },
      complete: () => this.finishAddingEntries(),
    });
  }

  private finishAddingEntries(): void {
    const contents = this.selectedPublicationIds().length;
    const schedules = this.scheduledScheduleKeys().length;
    this.saving.set(false);
    this.modal.set(false);
    this.load();
    this.toast.show(`${contents} conteúdo(s) adicionados em ${schedules} agendamento(s) diário(s).`);
  }

  scheduleProgressPercent(): number {
    const { completed, total } = this.scheduleProgress();
    return total ? Math.round(completed / total * 100) : 0;
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }

  private scheduleKey(publicationId: number, date: string): string {
    return `${publicationId}:${date}`;
  }

  publicationTitle(id: number): string {
    return this.publications().find(publication => publication.id === id)?.title ?? `Conteúdo ${id}`;
  }

  scheduleSummary(id: number): string {
    const schedule = this.scheduleFor(id);
    const dates = this.datesFor(id);
    const range = dates.length
      ? `${this.formatDate(dates[0])}${dates.length > 1 ? ` a ${this.formatDate(dates[dates.length - 1])}` : ''}`
      : 'Período não definido';
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime}–${schedule.endTime}` : 'Horário não definido';
    const completed = this.scheduledCount(id);
    return `${range} · ${time}${completed ? ` · ${completed} de ${dates.length} dias concluídos` : ''}`;
  }

  removeEntry(program: Program, entryId: number): void {
    this.removeEntryUC.execute(program.id, entryId).subscribe({
      next: updated => { this.selected.set(updated); this.load(); this.toast.show('Conteúdo removido da programação'); },
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
    this.deleteUC.execute(program.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDeletion.set(null);
        this.selected.set(null);
        this.load();
        this.toast.show('Programação excluída');
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
    this.tokenUC.execute().subscribe({
      next: token => {
        this.generatingToken.set(false);
        this.auth.setPlayerToken(token);
        this.toast.show('Link renovado. Atualize o endereço em todas as TVs que usam suas programações.');
      },
      error: error => { this.generatingToken.set(false); this.error.set(errorMessage(error)); },
    });
  }

  loadProgramSchedule(programId: number): void {
    this.currentBusinessTime.set(businessTime());
    const start = this.today;
    const endDate = new Date(`${start}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 29);
    const end = endDate.toISOString().slice(0, 10);
    this.programScheduleLoading.set(true);
    this.programScheduleError.set('');
    this.listScheduleUC.execute({ from: start, to: end }).subscribe({
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
      () => this.toast.show('Link copiado'),
      () => this.error.set('Não foi possível copiar o link. Selecione e copie o endereço manualmente.'),
    );
  }
}
