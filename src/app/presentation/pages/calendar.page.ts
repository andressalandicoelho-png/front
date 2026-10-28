import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { ListProgramsUseCase } from '@application/program/program.usecases';
import {
  CreateScheduleEntryUseCase, DeleteScheduleEntryUseCase, ListScheduleUseCase, UpdateScheduleEntryUseCase,
} from '@application/schedule/schedule.usecases';
import { Publication } from '@domain/publication/publication.entity';
import { Program } from '@domain/program/program.entity';
import { monthGrid } from '@domain/schedule/calendar';
import { NewScheduleEntry, ScheduleEntry } from '@domain/schedule/schedule.entity';
import { toIsoDate } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@infra/http/auth.interceptor';
import { ToastService } from '@presentation/core/toast.service';
import { longDate, monthTitle } from '@presentation/core/format';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';

interface EntryForm { publicationId: number | null; programId: number | null; startTime: string; endTime: string; turnSeconds: number | null; }

const businessDate = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

@Component({
  selector: 'app-calendar',
  imports: [DatePipe, RouterLink, FormsModule, IconComponent, ModalComponent, SecureMediaComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Uma visão de tudo que conecta.</h1><p class="muted">Organize a comunicação das suas TVs, um dia de cada vez.</p></div>
      <a class="btn primary" routerLink="/publicacoes">Novo conteúdo</a>
    </header>

    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" type="button" (click)="move(-1)" aria-label="Mês anterior"><app-icon name="left" [size]="22"/></button>
        <strong>{{ title() }}</strong>
        <button class="icon-btn" type="button" (click)="move(1)" aria-label="Próximo mês"><app-icon name="right" [size]="22"/></button>
      </div>
      <div class="cal-grid weekdays">@for (w of weekdays; track w) { <span>{{ w }}</span> }</div>
      <div class="cal-grid month-grid" [style.grid-template-rows]="gridRows()">
        @for (d of grid(); track d.date) {
          <div class="day" role="button" tabindex="0" [class.out]="!d.inMonth" [class.today]="d.date === today" [class.sel]="d.date === selected()" [class.menu-open]="openMenuDate() === d.date"
               [attr.aria-label]="popupTitle(d.date)" (click)="select(d.date)" (keydown.enter)="select(d.date)" (keydown.space)="$event.preventDefault(); select(d.date)">
            <span class="day-top">
              <span class="num">{{ d.day }}</span>
              <button class="day-menu-trigger" type="button" aria-label="Opções do dia" aria-haspopup="menu" [attr.aria-expanded]="openMenuDate() === d.date"
                      (click)="$event.stopPropagation(); toggleDayMenu(d.date, $event)" (keydown)="$event.stopPropagation()">
                <span class="day-menu-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              </button>
            </span>
            <span class="day-events">
              @if (entriesOf(d.date)[0]; as entry) {
                <span class="day-event">{{ entry.startTime }} · {{ titleOf(entry) }}</span>
                @if (countOf(d.date) > 1) { <span class="day-more">+{{ countOf(d.date) - 1 }} outros</span> }
              }
            </span>
          </div>
        }
      </div>
      <div class="calendar-agenda">
        @for (entry of agendaEntries(); track entry.id) {
          <button type="button" class="agenda-row" (click)="select(entry.date)">
            <span class="agenda-date"><strong>{{ entry.date | date:'dd' }}</strong><small>{{ entry.date | date:'MMM' }}</small></span>
            <span class="grow"><strong>{{ titleOf(entry) }}</strong><small>{{ entry.startTime }}–{{ entry.endTime }}</small></span>
            <app-icon name="right" [size]="18"/>
          </button>
        } @empty { <p class="empty">Nenhum conteúdo agendado neste mês.</p> }
        <div class="agenda-pagination"><button class="btn small" type="button" (click)="previousAgendaPage()" [disabled]="agendaPage() === 0">Anterior</button><span>{{ agendaPage() + 1 }} / {{ agendaPageCount() }}</span><button class="btn small" type="button" (click)="nextAgendaPage()" [disabled]="agendaPage() + 1 >= agendaPageCount()">Próxima</button></div>
      </div>
    </section>
    <footer class="calendar-footer"><span><i></i> Conteúdo agendado</span><span>Horário de Brasília · GMT−3</span></footer>
    @if (openMenuDate(); as date) {
      <div class="calendar-day-popover" role="menu" [style.top.px]="dayMenuPosition().top" [style.left.px]="dayMenuPosition().left" (click)="$event.stopPropagation()">
        <strong class="calendar-popover-title">{{ popupTitle(date) }}</strong>
        <span class="calendar-popover-date">{{ popupSubtitle(date) }}</span>
        <span class="calendar-popover-action-wrap" [attr.title]="isPast(date) ? 'Impossível adicionar conteúdo em uma data passada.' : null">
          <button type="button" role="menuitem" class="calendar-popover-action" [class.disabled]="isPast(date)" [disabled]="isPast(date)" (click)="addContent(date)">
            <app-icon name="plus" [size]="16"/> <span>Adicionar conteúdo</span>
          </button>
        </span>
        <button type="button" role="menuitem" class="calendar-popover-action" (click)="viewPosts(date)">
          <app-icon name="calendar" [size]="16"/> <span>Ver posts do dia</span>
        </button>
        @if (!isPast(date)) { <p class="calendar-popover-note">Escolha a programação e os conteúdos que devem aparecer nesse horário.</p> }
      </div>
    }

    @if (selected(); as day) {
      @if (viewOnly()) {
        <app-modal [title]="'Conteúdos · ' + dayLabel()" (closed)="selected.set(null)">
          <div class="day-posts-dialog">
            <p class="day-posts-summary">{{ dayEntries().length }} {{ dayEntries().length === 1 ? 'conteúdo programado' : 'conteúdos programados' }}</p>
            <div class="day-posts-list" role="list" aria-label="Conteúdos programados neste dia">
              @for (entry of dayEntries(); track entry.id) {
                @let publication = publicationOf(entry.publicationId);
                <article class="day-post-card" role="listitem">
                  <span class="day-post-thumb"><app-secure-media [mediaId]="publication?.mediaId ?? null" [type]="publication?.type ?? 'IMAGE'"/></span>
                  <span class="day-post-copy">
                    <strong>{{ titleOf(entry) }}</strong>
                    <small>{{ publication ? typeName(publication.type) : 'Conteúdo' }} · {{ programName(entry.programId) }}</small>
                  </span>
                  <span class="day-post-timing">
                    <strong>{{ entry.startTime }}–{{ entry.endTime }}</strong>
                    @if (entry.turnSeconds) { <small>{{ entry.turnSeconds }} s previstos</small> }
                    @else if (publication?.displaySeconds) { <small>{{ publication?.displaySeconds }} s de exibição</small> }
                  </span>
                </article>
              } @empty {
                <div class="day-posts-empty">
                  <strong>Nenhum conteúdo neste dia</strong>
                  <span>Não há posts programados para esta data.</span>
                </div>
              }
            </div>
          </div>
        </app-modal>
      } @else {
      <app-modal [title]="dayLabel()" (closed)="selected.set(null)">
        @for (e of dayEntries(); track e.id) {
          <div class="row">
            <div class="grow">
              <div class="title">{{ titleOf(e) }}</div>
              <div class="muted">{{ programName(e.programId) }} · {{ e.startTime }}–{{ e.endTime }}@if (e.turnSeconds) { · {{ e.turnSeconds }}s }</div>
            </div>
            <button class="icon-btn" type="button" aria-label="Editar" (click)="edit(e)"><app-icon name="edit" [size]="20"/></button>
            <button class="icon-btn danger" type="button" aria-label="Remover" (click)="remove(e)"><app-icon name="trash" [size]="20"/></button>
          </div>
        } @empty {
          <p class="muted">Nenhuma publicação neste dia.</p>
        }

        @if (!viewOnly()) {
        <form class="stack" (ngSubmit)="save(day)">
          <strong>{{ editing() ? 'Editar agendamento' : 'Adicionar ao dia' }}</strong>
          @if (isPast(day)) { <p class="muted">Não é possível adicionar programação para uma data passada.</p> }
          <label class="field">Programação
            <select class="input" name="editProgram" [(ngModel)]="form.programId" required>
              <option [ngValue]="null" disabled>Escolha uma programação</option>
              @for (program of programs(); track program.id) { <option [ngValue]="program.id">{{ program.name }}</option> }
            </select>
          </label>
          <select class="input" name="pub" [(ngModel)]="form.publicationId" [disabled]="!!editing()">
            <option [ngValue]="null" disabled>Conteúdo publicado</option>
            @for (p of readyPubs(); track p.id) { <option [ngValue]="p.id">{{ p.title }}</option> }
          </select>
          <div class="grid-2">
            <label class="field">Início<input class="input" type="time" name="start" [(ngModel)]="form.startTime"></label>
            <label class="field">Fim<input class="input" type="time" name="end" [(ngModel)]="form.endTime"></label>
          </div>
          <label class="field">Duração planejada (segundos, opcional)
            <input class="input" type="number" min="1" max="3600" name="turn" [(ngModel)]="form.turnSeconds" placeholder="Usa a duração do conteúdo">
          </label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="actions">
            @if (editing()) { <button class="btn" type="button" (click)="resetForm()">Cancelar</button> }
            <button class="btn primary" type="submit" [disabled]="isPast(day)">{{ editing() ? 'Salvar alterações' : 'Adicionar' }}</button>
          </div>
        </form>
        }
      </app-modal>
      }
    }
    @if (pendingRemoval(); as entry) {
      <app-modal title="Remover agendamento?" (closed)="pendingRemoval.set(null)">
        <div class="confirm-content"><span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span>
          <h2>Remover este conteúdo do calendário?</h2>
          <p class="muted">“{{ titleOf(entry) }}” será removido do calendário em {{ entry.date | date:'dd/MM/yyyy' }}. A publicação continuará na biblioteca.</p>
          <div class="actions"><button class="btn" type="button" (click)="pendingRemoval.set(null)">Cancelar</button><button class="btn danger-button" type="button" (click)="confirmRemove(entry)">Remover agendamento</button></div>
        </div>
      </app-modal>
    }
    @if (addContentDate(); as date) {
      <app-modal title="Adicionar conteúdos" (closed)="closeAddContent()">
        <div class="add-content-dialog">
          <div class="add-content-context">
            <div class="add-content-section-title">Escolha a programação</div>
            <div class="add-content-date">
              <span>Data</span>
              <strong>{{ popupFullDate(date) }}</strong>
            </div>
            <label class="calendar-schedule-time">De<input class="input" type="time" aria-label="Horário de início do agendamento" [(ngModel)]="addStartTime"></label>
            <label class="calendar-schedule-time">Até<input class="input" type="time" aria-label="Horário de fim do agendamento" [(ngModel)]="addEndTime"></label>
          </div>
          @if (programs().length) {
            <div class="calendar-program-options" role="group" aria-label="Programações de destino">
              @for (program of programs(); track program.id) {
                <button type="button" class="calendar-program-option" [class.selected]="selectedProgramId() === program.id" [disabled]="addingContents()" (click)="selectProgram(program.id)">
                  <app-icon name="layers" [size]="15"/>
                  <span>{{ program.name }}</span>
                  @if (selectedProgramId() === program.id) { <app-icon name="check" [size]="15"/> }
                </button>
              }
            </div>
          } @else {
            <div class="calendar-program-empty">
              <p>Crie uma programação antes de agendar conteúdos para a TV.</p>
              <a class="btn primary small" routerLink="/programacao/nova" (click)="closeAddContent()">Criar programação</a>
            </div>
          }
          <div class="add-content-library-head">
            <strong>Conteúdos publicados</strong>
            <a class="add-content-create" routerLink="/publicacoes" [queryParams]="{ date: date }" (click)="closeAddContent()">
              <app-icon name="plus" [size]="14"/> Criar conteúdo
            </a>
          </div>
          <div class="add-content-filters" role="search">
            <label class="search-field">
              <app-icon name="search" [size]="17"/>
              <input class="input" type="search" aria-label="Buscar conteúdo por título" placeholder="Buscar por título" [ngModel]="contentSearch()" (ngModelChange)="contentSearch.set($event)">
            </label>
            <select class="input" aria-label="Filtrar por formato" [ngModel]="contentTypeFilter()" (ngModelChange)="contentTypeFilter.set($event)">
              <option value="ALL">Todos os formatos</option><option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option><option value="LINK">Link</option>
            </select>
            <span class="calendar-publication-rule">Somente conteúdos publicados podem ser agendados.</span>
          </div>
          <div class="add-content-meta">
            <span class="add-content-count" aria-live="polite">
              <strong>{{ pickerPublications().length }}</strong> {{ pickerPublications().length === 1 ? 'resultado' : 'resultados' }}
            </span>
            <span class="add-content-hint">Selecione um ou mais itens</span>
          </div>
          <div class="add-content-list" role="list" aria-label="Conteúdos disponíveis">
            @for (publication of pickerPublications(); track publication.id) {
              <label class="add-content-item" role="listitem" [class.selected]="isContentSelected(publication.id)" [class.already-added]="alreadyScheduled().has(publication.id)">
                <input type="checkbox" [checked]="isContentSelected(publication.id) || alreadyScheduled().has(publication.id)"
                       [disabled]="alreadyScheduled().has(publication.id) || addingContents()" (change)="toggleContent(publication.id)">
                <span class="add-content-thumb"><app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/></span>
                <span class="add-content-info">
                  <strong>{{ publication.title }}</strong>
                  <small>{{ typeName(publication.type) }} · {{ publication.displaySeconds ?? 10 }} s</small>
                </span>
                <span class="add-content-status">
                  @if (alreadyScheduled().has(publication.id)) { Já agendado nesta programação }
                  @else if (isContentSelected(publication.id)) { Selecionado }
                </span>
              </label>
            } @empty {
              <div class="add-content-empty">
                <app-icon name="search" [size]="18"/>
                <strong>{{ contentSearch() ? 'Nenhum resultado para esta busca' : 'Nenhum conteúdo encontrado' }}</strong>
                <span>{{ contentSearch() ? 'Tente outro título ou ajuste os filtros.' : 'Ajuste os filtros para ver outros conteúdos da biblioteca.' }}</span>
              </div>
            }
          </div>
          @if (addContentError()) { <p class="error add-content-error" role="alert">{{ addContentError() }}</p> }
          <div class="add-content-footer">
            <div class="add-content-selection">
              <strong>{{ selectedNewContentCount() }} {{ selectedNewContentCount() === 1 ? 'novo conteúdo selecionado' : 'novos conteúdos selecionados' }}</strong>
              <button type="button" class="link-button" [disabled]="selectedNewContentCount() === 0 || addingContents()" (click)="clearContentSelection()">Limpar seleção</button>
              <small>{{ selectedContentSummary() || 'Selecione conteúdos para montar a sequência.' }}</small>
              <small class="add-content-schedule-note">{{ selectedProgramName() || 'Escolha uma programação' }} · {{ addStartTime }}–{{ addEndTime }}</small>
            </div>
            <div class="actions">
              <button class="btn" type="button" [disabled]="addingContents()" (click)="closeAddContent()">Cancelar</button>
              <button class="btn primary" type="button" [disabled]="!selectedProgramId() || !selectedNewContentCount() || isPast(date) || addingContents()" (click)="scheduleSelectedContent(date)">
                {{ addingContents() ? 'Adicionando…' : 'Adicionar ' + selectedNewContentCount() + (selectedNewContentCount() === 1 ? ' conteúdo' : ' conteúdos') }}
              </button>
            </div>
          </div>
          @if (isPast(date)) { <p class="error add-content-error">Não é possível adicionar conteúdo a uma data passada.</p> }
        </div>
      </app-modal>
    }
  `,
})
export class CalendarPage implements OnInit {
  private pubsUC = inject(ListPublicationsUseCase);
  private programsUC = inject(ListProgramsUseCase);
  private listUC = inject(ListScheduleUseCase);
  private createUC = inject(CreateScheduleEntryUseCase);
  private updateUC = inject(UpdateScheduleEntryUseCase);
  private deleteUC = inject(DeleteScheduleEntryUseCase);
  private toast = inject(ToastService);

  weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  today = businessDate();
  cursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  selected = signal<string | null>(null);
  openMenuDate = signal<string | null>(null);
  dayMenuPosition = signal({ top: 8, left: 8 });
  viewOnly = signal(false);
  pubs = signal<Publication[]>([]);
  programs = signal<Program[]>([]);
  entries = signal<ScheduleEntry[]>([]);
  editing = signal<ScheduleEntry | null>(null);
  pendingRemoval = signal<ScheduleEntry | null>(null);
  addContentDate = signal<string | null>(null);
  selectedContentIds = signal<number[]>([]);
  selectedProgramId = signal<number | null>(null);
  contentSearch = signal('');
  contentTypeFilter = signal<'ALL' | Publication['type']>('ALL');
  addingContents = signal(false);
  addContentError = signal('');
  addStartTime = '08:00';
  addEndTime = '18:00';
  agendaPage = signal(0);
  error = signal('');
  form: EntryForm = this.emptyForm();

  grid = computed(() => monthGrid(this.cursor().getFullYear(), this.cursor().getMonth()));
  gridRows = computed(() => `repeat(${this.grid().length / 7}, minmax(0, 1fr))`);
  title = computed(() => monthTitle(this.cursor()));
  filtered = computed(() => this.entries());
  byDate = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.filtered()) map.set(e.date, (map.get(e.date) ?? 0) + 1);
    return map;
  });
  dayEntries = computed(() =>
    this.filtered().filter(e => e.date === this.selected()).sort((a, b) => a.startTime.localeCompare(b.startTime)));
  monthEntries = computed(() => {
    const c = this.cursor();
    const prefix = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`;
    return this.filtered().filter(e => e.date.startsWith(prefix)).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  });
  agendaEntries = computed(() => this.monthEntries().slice(this.agendaPage() * 6, this.agendaPage() * 6 + 6));
  agendaPageCount = computed(() => Math.max(1, Math.ceil(this.monthEntries().length / 6)));
  dayLabel = computed(() => (this.selected() ? longDate(this.selected()!) : ''));
  selectedProgramName = computed(() => this.programs().find(program => program.id === this.selectedProgramId())?.name ?? '');
  alreadyScheduled = computed(() => new Set(this.entries()
    .filter(entry => this.selectedProgramId() !== null && entry.date === this.addContentDate() && entry.programId === this.selectedProgramId())
    .map(entry => entry.publicationId)));
  pickerPublications = computed(() => {
    const query = this.contentSearch().trim().toLocaleLowerCase();
    const type = this.contentTypeFilter();
    return this.pubs().filter(publication =>
      publication.status === 'READY' &&
      (!query || publication.title.toLocaleLowerCase().includes(query)) &&
      (type === 'ALL' || publication.type === type),
    );
  });
  readyPubs = computed(() => this.pubs().filter(publication => publication.status === 'READY'));
  selectedNewContentCount = computed(() => this.selectedContentIds().filter(id => !this.alreadyScheduled().has(id)).length);
  selectedContentSummary = computed(() => this.pubs()
    .filter(publication => this.selectedContentIds().includes(publication.id) && !this.alreadyScheduled().has(publication.id))
    .map(publication => publication.title).join(' · '));

  ngOnInit(): void {
    this.pubsUC.execute().subscribe({ next: pubs => this.pubs.set(pubs), error: error => this.error.set(errorMessage(error)) });
    this.programsUC.execute().subscribe({
      next: programs => this.programs.set(programs),
      error: error => this.error.set(errorMessage(error)),
    });
    this.load();
  }

  load(): void {
    const g = this.grid();
    this.listUC.execute({ from: g[0].date, to: g[g.length - 1].date }).subscribe(list => this.entries.set(list));
  }

  move(delta: number): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + delta, 1));
    this.agendaPage.set(0);
    this.load();
  }

  select(date: string): void { this.viewPosts(date); }
  toggleDayMenu(date: string, event: MouseEvent): void {
    if (this.openMenuDate() === date) {
      this.openMenuDate.set(null);
      return;
    }

    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLElement)) return;
    const bounds = trigger.getBoundingClientRect();
    const menuWidth = Math.min(232, window.innerWidth - 24);
    const menuHeight = Math.min(196, window.innerHeight - 24);
    const margin = 12;
    const left = Math.max(margin, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - margin));
    const below = bounds.bottom + menuHeight + margin <= window.innerHeight;
    const top = below
      ? bounds.bottom + 4
      : Math.max(margin, Math.min(bounds.top - menuHeight - 4, window.innerHeight - menuHeight - margin));
    this.dayMenuPosition.set({ top, left });
    this.openMenuDate.set(date);
  }
  addContent(date: string): void {
    if (this.isPast(date)) return;
    this.openMenuDate.set(null);
    this.addContentDate.set(date);
    this.selectedContentIds.set([]);
    this.addStartTime = '08:00';
    this.addEndTime = '18:00';
    this.contentSearch.set('');
    this.contentTypeFilter.set('ALL');
    this.selectedProgramId.set(null);
    this.addContentError.set('');
  }
  closeAddContent(): void {
    if (this.addingContents()) return;
    this.addContentDate.set(null);
    this.addContentError.set('');
  }
  isContentSelected(id: number): boolean { return this.selectedContentIds().includes(id); }
  selectProgram(programId: number): void {
    if (this.selectedProgramId() === programId) return;
    this.selectedProgramId.set(programId);
    this.selectedContentIds.update(ids => ids.filter(id => !this.alreadyScheduled().has(id)));
  }
  toggleContent(id: number): void {
    if (this.alreadyScheduled().has(id)) return;
    this.selectedContentIds.update(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  }
  clearContentSelection(): void { this.selectedContentIds.set([]); }
  typeName(type: Publication['type']): string {
    return type === 'IMAGE' ? 'Imagem' : type === 'VIDEO' ? 'Vídeo' : 'Link';
  }
  publicationOf(id: number): Publication | undefined {
    return this.pubs().find(publication => publication.id === id);
  }
  programName(id: number | null): string {
    return this.programs().find(program => program.id === id)?.name ?? 'Sem programação';
  }
  scheduleSelectedContent(date: string): void {
    this.addContentError.set('');
    const selected = this.selectedContentIds().filter(id => !this.alreadyScheduled().has(id));
    const programId = this.selectedProgramId();
    if (!selected.length || !programId) return;
    if (this.isPast(date)) {
      this.addContentError.set('Não é possível adicionar conteúdo a uma data passada.');
      return;
    }
    this.addingContents.set(true);
    let created = 0;
    from(selected).pipe(
      concatMap(publicationId => this.createUC.execute({
        publicationId,
        programId,
        date,
        startTime: this.addStartTime,
        endTime: this.addEndTime,
      })),
    ).subscribe({
      next: entry => {
        created++;
        this.entries.update(entries => [...entries, entry]);
        this.selectedContentIds.update(ids => ids.filter(id => id !== entry.publicationId));
      },
      error: error => {
        this.addingContents.set(false);
        this.addContentError.set(created
          ? `${errorMessage(error)} ${created} conteúdo(s) adicionado(s) antes da falha.`
          : errorMessage(error));
      },
      complete: () => {
        this.addingContents.set(false);
        this.addContentDate.set(null);
        this.toast.show(`${created} conteúdo(s) adicionado(s) à sequência`);
      },
    });
  }
  viewPosts(date: string): void { this.openMenuDate.set(null); this.selected.set(date); this.viewOnly.set(true); this.resetForm(); }
  popupTitle(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }
  popupSubtitle(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long' });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${year}`;
  }
  popupFullDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }
  @HostListener('document:click')
  closeDayMenu(): void { this.openMenuDate.set(null); }
  @HostListener('document:keydown.escape')
  closeDayMenuOnEscape(): void { this.openMenuDate.set(null); }
  previousAgendaPage(): void { this.agendaPage.update(page => Math.max(0, page - 1)); }
  nextAgendaPage(): void { this.agendaPage.update(page => Math.min(this.agendaPageCount() - 1, page + 1)); }
  countOf = (date: string) => this.byDate().get(date) ?? 0;
  entriesOf = (date: string) => this.filtered().filter(e => e.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 2);
  dots = (n: number) => Array.from({ length: Math.min(n, 3) }, (_, i) => i);
  titleOf = (e: ScheduleEntry) => e.publicationTitle ?? this.pubs().find(p => p.id === e.publicationId)?.title ?? `Publicação ${e.publicationId}`;
  isPast = (date: string) => date < this.today;

  private emptyForm(): EntryForm {
    return { publicationId: null, programId: null, startTime: '08:00', endTime: '18:00', turnSeconds: null };
  }

  resetForm(): void {
    this.editing.set(null);
    this.error.set('');
    this.form = this.emptyForm();
  }

  edit(e: ScheduleEntry): void {
    this.editing.set(e);
    this.form = { publicationId: e.publicationId, programId: e.programId, startTime: e.startTime, endTime: e.endTime, turnSeconds: e.turnSeconds };
  }

  save(date: string): void {
    this.error.set('');
    if (date < businessDate()) {
      this.error.set('Não é possível programar para uma data passada.');
      return;
    }
    const turn = this.form.turnSeconds ?? undefined;
    const current = this.editing();
    const request = current
      ? this.updateUC.execute(current.id, { date, programId: this.form.programId ?? undefined, startTime: this.form.startTime, endTime: this.form.endTime, turnSeconds: turn })
      : this.createUC.execute({
          publicationId: this.form.publicationId!, programId: this.form.programId!, date,
          startTime: this.form.startTime, endTime: this.form.endTime, turnSeconds: turn,
        } as NewScheduleEntry);
    request.subscribe({
      next: () => { this.toast.show(current ? 'Agendamento atualizado' : 'Agendamento adicionado'); this.resetForm(); this.load(); },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  remove(e: ScheduleEntry): void {
    this.pendingRemoval.set(e);
  }

  confirmRemove(e: ScheduleEntry): void {
    this.deleteUC.execute(e.id).subscribe({
      next: () => { this.pendingRemoval.set(null); this.toast.show('Agendamento removido'); this.load(); },
      error: err => { this.pendingRemoval.set(null); this.toast.show(errorMessage(err)); },
    });
  }
}
