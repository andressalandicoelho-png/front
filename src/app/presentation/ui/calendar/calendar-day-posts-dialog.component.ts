import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Publication } from '@domain/publication/publication.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { currentBusinessTime, toMinutes } from '@domain/schedule/schedule.rules';
import { ContentPreviewComponent } from '../shared/content-preview.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { SecureMediaComponent } from '../shared/secure-media.component';

const PROGRAM_COLORS = ['#159a72', '#dc8a28', '#4b78dc', '#a653be', '#d55252'];

@Component({
  selector: 'app-calendar-day-posts-dialog',
  imports: [FormsModule, ContentPreviewComponent, IconComponent, ModalComponent, SecureMediaComponent],
  template: `
    <app-modal class="calendar-modal" title="Conteúdos agendados" [subtitle]="dateLabel()" (closed)="closed.emit()">
      <div class="day-posts-dialog">
        <header class="day-posts-heading">
          <span class="day-posts-heading-icon"><app-icon name="calendar" [size]="17"/></span>
          <span class="day-posts-heading-copy"><strong>Conteúdos agendados</strong><small>{{ dateLabel() }}</small></span>
          <label class="day-posts-search">
            <app-icon name="search" [size]="15"/>
            <input type="search" aria-label="Buscar conteúdo agendado" placeholder="Buscar mídia..." [ngModel]="search()" (ngModelChange)="search.set($event)">
          </label>
          <button class="icon-btn day-posts-header-close" type="button" aria-label="Fechar" (click)="closed.emit()"><app-icon name="x" [size]="18"/></button>
        </header>
        <section class="day-posts-overview">
          <div class="day-posts-summary">
            <span class="day-posts-summary-copy">
              <strong>
                {{ entries().length }}
                @if (entries().length === 1) { mídia programada } @else { mídias programadas }
              </strong>
              <small>
                @if (entries().length) { Janela ativa: {{ dayWindow().start }}–{{ dayWindow().end }} ({{ dayWindowDuration() }}) }
                @else { Não há conteúdos agendados para este dia. }
              </small>
            </span>
            <span class="day-posts-live" [class.is-playing]="dayStatus() === 'Em exibição'"><i></i>{{ dayStatus() }}</span>
          </div>
          @if (entries().length) {
            <div class="day-posts-window" aria-label="Faixa de horários dos conteúdos agendados">
              <div class="day-posts-axis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
              <div class="day-posts-track">
                <i class="day-posts-window-active" [style.left.%]="dayWindow().left" [style.width.%]="dayWindow().width"></i>
                @if (dayNowPosition() !== null) { <i class="day-posts-now" [style.left.%]="dayNowPosition()"></i> }
              </div>
            </div>
          }
        </section>
        <div class="day-posts-toolbar">
          <label class="day-posts-sort">Ordenar:
            <select aria-label="Ordenar conteúdos agendados" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
              <option value="start">Início (08:00)</option>
              <option value="end">Fim (18:00)</option>
              <option value="name">Nome (A–Z)</option>
            </select>
          </label>
        </div>
        <nav class="day-posts-programs" role="tablist" aria-label="Filtrar por programação">
          <button type="button" role="tab" [attr.aria-selected]="programFilter() === null" [class.active]="programFilter() === null" (click)="programFilter.set(null)">
            Todos <span>{{ entries().length }}</span>
          </button>
          @for (program of dayProgramFilters(); track program.id) {
            <button type="button" role="tab" [attr.aria-selected]="programFilter() === program.id" [class.active]="programFilter() === program.id" (click)="programFilter.set(program.id)">
              <i [style.background]="programColor(program.id)"></i>{{ program.name }} <span>{{ program.count }}</span>
            </button>
          }
        </nav>
        <div class="day-posts-list" role="list" aria-label="Conteúdos programados neste dia">
          @if (loading() && !entries().length) {
            <p class="calendar-load-state" role="status">Carregando os agendamentos…</p>
          } @else if (syncError() && !entries().length) {
            <div class="calendar-load-state calendar-load-error" role="alert">
              <span>{{ syncError() }}</span>
              <button class="btn small" type="button" (click)="loadRequested.emit()">Tentar carregar novamente</button>
            </div>
          } @else {
            @for (entry of visibleEntries(); track entry.id) {
              @let publication = publicationOf(entry.publicationId);
              <article class="day-post-card" role="listitem">
                <span class="day-post-thumb media-thumb"><app-secure-media [mediaId]="publication?.mediaId ?? null" [type]="publication?.type ?? 'IMAGE'"/></span>
                <span class="day-post-copy">
                  <span class="day-post-title-row">
                    <strong>{{ titleFor()(entry) }}</strong>
                    <span class="day-post-program"><i [style.background]="programColor(entry.programId)"></i>{{ programNameFor()(entry.programId) }}</span>
                  </span>
                  <small class="day-post-meta">{{ entry.startTime }}–{{ entry.endTime }} · {{ entryDuration(entry) }}</small>
                </span>
                <div class="day-post-actions">
                  <button class="icon-btn day-post-view" type="button" [attr.aria-label]="'Visualizar ' + titleFor()(entry)" title="Visualizar conteúdo" (click)="previewEntry.set(entry)">
                    <app-icon name="eye" [size]="16"/>
                  </button>
                  <button class="icon-btn danger day-post-remove" type="button" [attr.aria-label]="'Remover agendamento de ' + titleFor()(entry)" title="Remover agendamento" (click)="removeRequested.emit(entry)">
                    <app-icon name="trash" [size]="17"/>
                  </button>
                </div>
              </article>
            } @empty {
              <div class="day-posts-empty empty-state">
                <strong>
                  @if (entries().length) { Nenhum conteúdo encontrado } @else { Nenhum conteúdo neste dia }
                </strong>
                <span>
                  @if (entries().length) {
                    Tente outra busca ou programação.
                  } @else {
                    Não há posts programados para esta data.
                  }
                </span>
              </div>
            }
          }
        </div>
        <footer class="day-posts-footer">
          <div class="day-posts-footer-meta">
            <span class="day-posts-sync" [class.has-error]="!!syncError()" [attr.title]="syncError() || null">
              <i></i>
              @if (syncError()) { Erro ao sincronizar } @else { Sincronizado }
            </span>
            <span class="day-posts-separator">·</span>
            <span>Ciclo: {{ dayCycleLabel() }}</span>
            <span class="day-posts-separator">·</span>
            <span>
              {{ entries().length }}
              @if (entries().length === 1) { item ativo } @else { itens ativos }
            </span>
          </div>
          <div class="day-posts-footer-actions">
            @if (canAddContent()) {
              <button class="day-posts-add" type="button" (click)="addRequested.emit(date())"><app-icon name="plus" [size]="14"/> Adicionar conteúdo</button>
            }
            <button class="day-posts-close" type="button" (click)="closed.emit()">Fechar</button>
          </div>
        </footer>
        @if (previewEntry(); as entry) {
          @let publication = publicationOf(entry.publicationId);
          <div class="day-post-preview-backdrop" (click)="previewEntry.set(null)">
            <section class="day-post-preview" role="dialog" aria-modal="true" [attr.aria-label]="'Visualização de ' + titleFor()(entry)" (click)="$event.stopPropagation()">
              <header><strong>{{ titleFor()(entry) }}</strong><button type="button" class="icon-btn" aria-label="Fechar visualização" (click)="previewEntry.set(null)"><app-icon name="x" [size]="18"/></button></header>
              <app-content-preview [type]="publication?.type ?? 'IMAGE'" [content]="publication?.content ?? null"
                [mediaId]="publication?.mediaId ?? null" [linkUrl]="publication?.linkUrl ?? null"/>
              <small>{{ programNameFor()(entry.programId) }} · {{ entry.startTime }}–{{ entry.endTime }}</small>
            </section>
          </div>
        }
      </div>
    </app-modal>
  `,
})
export class CalendarDayPostsDialogComponent implements OnChanges {
  readonly date = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly entries = input.required<ScheduleEntry[]>();
  readonly publicationsById = input.required<ReadonlyMap<number, Publication>>();
  readonly titleFor = input.required<(entry: ScheduleEntry) => string>();
  readonly programNameFor = input.required<(programId: number | null) => string>();
  readonly today = input.required<string>();
  readonly currentTime = input.required<string>();
  readonly canAddContent = input.required<boolean>();
  readonly loading = input(false);
  readonly syncError = input('');
  readonly closed = output<void>();
  readonly loadRequested = output<void>();
  readonly addRequested = output<string>();
  readonly removeRequested = output<ScheduleEntry>();

  readonly search = signal('');
  readonly programFilter = signal<number | null>(null);
  readonly sort = signal<'start' | 'end' | 'name'>('start');
  readonly previewEntry = signal<ScheduleEntry | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['date'] || changes['date'].firstChange) return;
    this.search.set('');
    this.programFilter.set(null);
    this.sort.set('start');
    this.previewEntry.set(null);
  }

  readonly dayProgramFilters = computed(() => {
    const programs = new Map<number, { id: number; name: string; count: number }>();
    for (const entry of this.entries()) {
      const id = entry.programId ?? -1;
      const program = programs.get(id) ?? { id, name: this.programNameFor()(entry.programId), count: 0 };
      program.count++;
      programs.set(id, program);
    }
    return [...programs.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  readonly visibleEntries = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const programId = this.programFilter();
    const sort = this.sort();
    return this.entries()
      .filter(entry => (programId === null || (entry.programId ?? -1) === programId) &&
        (!query || `${this.titleFor()(entry)} ${this.programNameFor()(entry.programId)}`.toLocaleLowerCase().includes(query)))
      .sort((a, b) => {
        if (sort === 'name') return this.titleFor()(a).localeCompare(this.titleFor()(b), 'pt-BR');
        if (sort === 'end') return a.endTime.localeCompare(b.endTime);
        return a.startTime.localeCompare(b.startTime);
      });
  });

  readonly dayWindow = computed(() => {
    const first = this.entries().at(0);
    if (!first) return { start: '00:00', end: '00:00', left: 0, width: 0 };
    const bounds = this.entries().reduce((result, entry) => {
      let start = result.start;
      let end = result.end;
      if (toMinutes(entry.startTime) < toMinutes(result.start.startTime)) start = entry;
      if (toMinutes(entry.endTime) > toMinutes(result.end.endTime)) end = entry;
      return { start, end };
    }, { start: first, end: first });
    const start = toMinutes(bounds.start.startTime);
    const end = toMinutes(bounds.end.endTime);
    return {
      start: bounds.start.startTime,
      end: bounds.end.endTime,
      left: start / 1440 * 100,
      width: (end - start) / 1440 * 100,
    };
  });

  readonly dayNowPosition = computed(() => {
    if (this.date() !== this.today()) return null;
    return toMinutes(this.currentTime()) / 1440 * 100;
  });
  readonly dayStatus = computed(() => {
    const date = this.date();
    if (date < this.today()) return 'Encerrado';
    const isPlaying = date === this.today() && this.entries().some(entry =>
      entry.startTime <= this.currentTime() && entry.endTime > this.currentTime());
    if (isPlaying) return 'Em exibição';
    return 'Agendado';
  });
  readonly dayWindowDuration = computed(() => {
    const minutes = toMinutes(this.dayWindow().end) - toMinutes(this.dayWindow().start);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours}h ${remainder}min`;
    if (hours) return `${hours}h`;
    return `${remainder}min`;
  });
  readonly dayCycleLabel = computed(() => {
    const seconds = this.entries().reduce((total, entry) => {
      const publication = this.publicationOf(entry.publicationId);
      if (publication?.type === 'MESSAGE') return total;
      return total + (entry.turnSeconds ?? publication?.displaySeconds ?? publication?.originalDurationSeconds ?? 30);
    }, 0);
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
    return `${seconds}s`;
  });

  publicationOf(id: number): Publication | undefined {
    return this.publicationsById().get(id);
  }

  programColor(programId: number | null): string {
    if (programId === null) return '#8592a8';
    return PROGRAM_COLORS[Math.abs(programId) % PROGRAM_COLORS.length];
  }

  entryDuration(entry: ScheduleEntry): string {
    const publication = this.publicationOf(entry.publicationId);
    if (publication?.type === 'MESSAGE') return 'Fixa durante o horário';
    return `${entry.turnSeconds ?? publication?.displaySeconds ?? publication?.originalDurationSeconds ?? 30}s duração`;
  }
}
