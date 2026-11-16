import { DatePipe } from '@angular/common';
import { Component, HostListener, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { monthGrid } from '@domain/schedule/calendar';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { monthTitle } from '@presentation/core/format';
import { movePage, paginate } from '@presentation/core/pagination';
import { IconComponent } from '../shared/icon.component';
import { PaginationComponent } from '../shared/pagination.component';

type CalendarGrid = ReturnType<typeof monthGrid>;

@Component({
  selector: 'app-calendar-month-view',
  imports: [DatePipe, IconComponent, PaginationComponent],
  styles: [':host { display: flex; flex: 1 1 auto; min-height: 0; width: 100%; }'],
  template: `
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" type="button" (click)="monthChanged.emit(-1)" aria-label="Mês anterior"><app-icon name="left" [size]="22"/></button>
        <strong>{{ title() }}</strong>
        <button class="icon-btn" type="button" (click)="monthChanged.emit(1)" aria-label="Próximo mês"><app-icon name="right" [size]="22"/></button>
      </div>
      <div class="cal-grid weekdays">@for (weekday of weekdays; track weekday) { <span>{{ weekday }}</span> }</div>
      <div class="cal-grid month-grid" [style.grid-template-rows]="gridRows()">
        @for (day of grid(); track day.date) {
          <div class="day" role="button" tabindex="0" [class.out]="!day.inMonth" [class.today]="day.date === today()" [class.sel]="day.date === selected()" [class.menu-open]="openMenuDate() === day.date"
            [attr.aria-label]="popupTitle(day.date)" (click)="daySelected.emit(day.date)" (keydown.enter)="daySelected.emit(day.date)" (keydown.space)="$event.preventDefault(); daySelected.emit(day.date)">
            <span class="day-top">
              <span class="num">{{ day.day }}</span>
              <button class="day-menu-trigger" type="button" aria-label="Opções do dia" aria-haspopup="menu" [attr.aria-expanded]="openMenuDate() === day.date"
                (click)="$event.stopPropagation(); toggleDayMenu(day.date, $event)" (keydown)="$event.stopPropagation()">
                <span class="day-menu-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              </button>
            </span>
            <span class="day-events">
              @if (entriesOf(day.date)[0]; as entry) {
                <span class="day-event">{{ entry.startTime }} · {{ titleFor()(entry) }}</span>
                @if (countOf(day.date) > 1) { <span class="day-more">+{{ countOf(day.date) - 1 }} outros</span> }
              }
            </span>
          </div>
        }
      </div>
      <div class="calendar-agenda">
        @if (loading()) {
          <p class="calendar-load-state" role="status">Carregando os agendamentos…</p>
        } @else if (loadError()) {
          <div class="calendar-load-state calendar-load-error" role="alert">
            <span>{{ loadError() }}</span>
            <button class="btn small" type="button" (click)="loadRequested.emit()">Tentar carregar novamente</button>
          </div>
        } @else {
          @for (entry of agendaEntries(); track entry.id) {
            <button type="button" class="agenda-row" (click)="daySelected.emit(entry.date)">
              <span class="agenda-date"><strong>{{ entry.date | date:'dd' }}</strong><small>{{ entry.date | date:'MMM' }}</small></span>
              <span class="grow"><strong>{{ titleFor()(entry) }}</strong><small>{{ entry.startTime }}–{{ entry.endTime }}</small></span>
              <app-icon name="right" [size]="18"/>
            </button>
          } @empty {
            <div class="calendar-agenda-empty empty-state">
              <strong>Nenhum agendamento.</strong>
              @if (!isPast(today())) { <button class="btn primary small" type="button" (click)="addRequested.emit(today())"><app-icon name="plus" [size]="15"/> Agendar hoje</button> }
            </div>
          }
          @if (monthEntries().length) {
            <footer app-pagination class="pagination agenda-pagination" ariaLabel="Paginação da agenda"
              [previousDisabled]="agendaPage() === 0" [nextDisabled]="agendaPage() + 1 >= agendaPageCount()"
              (previousPage)="previousAgendaPage()" (nextPage)="nextAgendaPage()">
              <span paginationStatus>{{ agendaPage() + 1 }} / {{ agendaPageCount() }}</span>
            </footer>
          }
        }
      </div>
    </section>
    @if (openMenuDate(); as date) {
      <div class="calendar-day-popover" role="menu" [style.top.px]="dayMenuPosition().top" [style.left.px]="dayMenuPosition().left" (click)="$event.stopPropagation()">
        <div class="calendar-popover-heading">
          <span class="calendar-popover-day" aria-hidden="true">{{ popupDay(date) }}</span>
          <span class="calendar-popover-copy">
            <strong class="calendar-popover-title">{{ popupTitle(date) }}</strong>
            <span class="calendar-popover-date">{{ popupSubtitle(date) }}</span>
          </span>
        </div>
        <span class="calendar-popover-action-wrap" [attr.title]="addContentTitle(date)">
          <button type="button" role="menuitem" class="calendar-popover-action" [class.disabled]="isPast(date)" [disabled]="isPast(date)" (click)="requestAdd(date)">
            <app-icon name="plus" [size]="16"/> <span>Adicionar conteúdo</span>
          </button>
        </span>
        <button type="button" role="menuitem" class="calendar-popover-action" (click)="requestView(date)">
          <app-icon name="calendar" [size]="16"/> <span>Ver agendamentos</span>
        </button>
      </div>
    }
  `,
})
export class CalendarMonthViewComponent implements OnChanges {
  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  readonly month = input.required<Date>();
  readonly grid = input.required<CalendarGrid>();
  readonly entries = input.required<ScheduleEntry[]>();
  readonly entriesByDate = input.required<ReadonlyMap<string, ScheduleEntry[]>>();
  readonly today = input.required<string>();
  readonly selected = input<string | null>(null);
  readonly loading = input(false);
  readonly loadError = input('');
  readonly titleFor = input.required<(entry: ScheduleEntry) => string>();
  readonly monthChanged = output<number>();
  readonly daySelected = output<string>();
  readonly addRequested = output<string>();
  readonly viewRequested = output<string>();
  readonly loadRequested = output<void>();

  readonly openMenuDate = signal<string | null>(null);
  readonly dayMenuPosition = signal({ top: 8, left: 8 });
  readonly agendaPage = signal(0);
  readonly title = computed(() => monthTitle(this.month()));
  readonly gridRows = computed(() => `repeat(${this.grid().length / 7}, minmax(0, 1fr))`);
  readonly monthEntries = computed(() => {
    const month = this.month();
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    return this.entries().filter(entry => entry.date.startsWith(prefix))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  });
  private readonly agendaPagination = computed(() => paginate(this.monthEntries(), this.agendaPage(), 6));
  readonly agendaEntries = computed(() => this.agendaPagination().items);
  readonly agendaPageCount = computed(() => this.agendaPagination().count);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['month']) this.agendaPage.set(0);
  }

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
    let top = bounds.bottom + 4;
    if (!below) top = Math.max(margin, Math.min(bounds.top - menuHeight - 4, window.innerHeight - menuHeight - margin));
    this.dayMenuPosition.set({ top, left });
    this.openMenuDate.set(date);
  }

  addContentTitle(date: string): string | null {
    if (!this.isPast(date)) return null;
    return 'Impossível adicionar conteúdo em uma data passada.';
  }

  @HostListener('document:click')
  closeDayMenu(): void {
    this.openMenuDate.set(null);
  }

  @HostListener('document:keydown.escape')
  closeDayMenuOnEscape(): void {
    this.openMenuDate.set(null);
  }

  previousAgendaPage(): void {
    movePage(this.agendaPage, this.agendaPageCount, -1);
  }

  nextAgendaPage(): void {
    movePage(this.agendaPage, this.agendaPageCount, 1);
  }

  countOf(date: string): number {
    return this.entriesByDate().get(date)?.length ?? 0;
  }

  entriesOf(date: string): ScheduleEntry[] {
    return (this.entriesByDate().get(date) ?? []).slice(0, 2);
  }

  popupTitle(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }

  popupDay(date: string): number {
    return Number(date.split('-')[2]);
  }

  popupSubtitle(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long' });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${year}`;
  }

  isPast(date: string): boolean {
    return date < this.today();
  }

  requestAdd(date: string): void {
    this.openMenuDate.set(null);
    this.addRequested.emit(date);
  }

  requestView(date: string): void {
    this.openMenuDate.set(null);
    this.viewRequested.emit(date);
  }
}
