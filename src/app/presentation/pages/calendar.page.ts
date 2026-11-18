import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { ListProgramsUseCase } from '@application/program/program.usecases';
import { ScheduleEntriesUseCase } from '@application/schedule/schedule-entries.usecase';
import {
  DeleteScheduleEntryUseCase, ListScheduleUseCase, UpdateScheduleEntryUseCase,
} from '@application/schedule/schedule.usecases';
import { Publication } from '@domain/publication/publication.entity';
import { Program } from '@domain/program/program.entity';
import { monthGrid } from '@domain/schedule/calendar';
import { NewScheduleEntry, ScheduleEntry } from '@domain/schedule/schedule.entity';
import { currentBusinessDate, currentBusinessTime, datesBetweenInclusive, missingScheduleEntries, toMinutes } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { completedScheduleMessage } from '@presentation/core/schedule-error-message';
import { scheduleEntriesObserver } from '@presentation/core/schedule-entries-observer';
import {
  groupScheduleEntries, timelineLeft as getTimelineLeft, timelineWidth as getTimelineWidth,
} from '@presentation/core/calendar-view';
import { ToastService } from '@presentation/core/toast.service';
import { formatDate, longDate } from '@presentation/core/format';
import { ConfirmActionComponent } from '@presentation/ui/shared/confirm-action.component';
import { CalendarAddContentDialogComponent } from '@presentation/ui/calendar/calendar-add-content-dialog.component';
import { CalendarDayPostsDialogComponent } from '@presentation/ui/calendar/calendar-day-posts-dialog.component';
import { CalendarMonthViewComponent } from '@presentation/ui/calendar/calendar-month-view.component';
import { CalendarEntryDialogComponent, type CalendarEntryForm } from '@presentation/ui/calendar/calendar-entry-dialog.component';
import { calendarEntryForm, calendarEntryValidationError, emptyCalendarEntryForm } from './calendar.page.helpers';

@Component({
  selector: 'app-calendar',
  imports: [ConfirmActionComponent, CalendarAddContentDialogComponent, CalendarDayPostsDialogComponent, CalendarMonthViewComponent, CalendarEntryDialogComponent],
  templateUrl: './calendar.page.html',
})
export class CalendarPage implements OnInit {
  readonly formatDate = formatDate;
  private pubsUC = inject(ListPublicationsUseCase);
  private programsUC = inject(ListProgramsUseCase);
  private listUC = inject(ListScheduleUseCase);
  private scheduleEntriesUseCase = inject(ScheduleEntriesUseCase);
  private updateUC = inject(UpdateScheduleEntryUseCase);
  private deleteUC = inject(DeleteScheduleEntryUseCase);
  private toast = inject(ToastService);

  today = currentBusinessDate();
  cursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  selected = signal<string | null>(null);
  viewOnly = signal(false);
  private calendarNow = signal(new Date());
  pubs = signal<Publication[]>([]);
  programs = signal<Program[]>([]);
  entries = signal<ScheduleEntry[]>([]);
  editing = signal<ScheduleEntry | null>(null);
  pendingRemoval = signal<ScheduleEntry | null>(null);
  addContentDate = signal<string | null>(null);
  addingContents = signal(false);
  addContentError = signal('');
  error = signal('');
  loadError = signal('');
  loadingEntries = signal(false);
  addProgress = signal({ completed: 0, total: 0 });
  reviewingEntry = signal(false);
  form: CalendarEntryForm = emptyCalendarEntryForm(this.selected());

  grid = computed(() => monthGrid(this.cursor().getFullYear(), this.cursor().getMonth()));
  currentTime = computed(() => currentBusinessTime(this.calendarNow()));
  entriesByDate = computed(() => groupScheduleEntries(this.entries()));
  dayEntries = computed(() => this.entriesByDate().get(this.selected() ?? '') ?? []);
  publicationsById = computed(() => new Map(this.pubs().map(publication => [publication.id, publication])));
  programsById = computed(() => new Map(this.programs().map(program => [program.id, program.name])));
  dayLabel = computed(() => {
    const selected = this.selected();
    if (!selected) return '';
    return longDate(selected);
  });
  readyPubs = computed(() => this.pubs().filter(publication => publication.status === 'READY'));

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
    this.loadingEntries.set(true);
    this.loadError.set('');
    this.listUC.execute({ from: g[0].date, to: g[g.length - 1].date }).subscribe({
      next: list => { this.entries.set(list); this.loadingEntries.set(false); },
      error: error => { this.loadError.set(errorMessage(error)); this.loadingEntries.set(false); },
    });
  }

  move(delta: number): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + delta, 1));
    this.load();
  }
  select(date: string): void { this.viewPosts(date); }
  addContent(date: string): void {
    if (this.isPast(date)) return;
    this.addContentDate.set(date); this.addContentError.set('');
  }
  closeAddContent(): void {
    if (this.addingContents()) return;
    this.addContentDate.set(null); this.addContentError.set('');
  }
  toMinutes = toMinutes;
  publicationOf = (id: number): Publication | undefined => this.publicationsById().get(id);
  programName = (id: number | null): string => this.programsById().get(id ?? -1) ?? 'Sem programação';
  scheduleSelectedContent(tasks: NewScheduleEntry[]): void {
    this.addContentError.set('');
    if (!tasks.length) {
      this.addingContents.set(false);
      this.addContentDate.set(null);
      this.toast.show('Conteúdos já agendados neste período e horário.');
      return;
    }

    this.addingContents.set(true);
    let created = 0;
    this.addProgress.set({ completed: 0, total: tasks.length });
    this.scheduleEntriesUseCase.execute({ tasks }).subscribe(scheduleEntriesObserver({
      started: total => this.addProgress.set({ completed: 0, total }),
      progress: event => {
        created = event.completed;
        this.addProgress.set({ completed: event.completed, total: event.total });
        this.entries.update(entries => [...entries, event.entry]);
      },
      error: error => {
        this.addingContents.set(false);
        this.addContentError.set(errorMessage(error));
      },
      scheduleError: error => {
        this.addingContents.set(false);
        const failed = error.task;
        const title = this.publicationTitle(failed.publicationId);
        const dateLabel = this.formatDate(failed.date);
        const programLabel = this.programName(failed.programId);
        const partial = completedScheduleMessage(created);
        this.addContentError.set(`${errorMessage(error.originalError)} Falha ao agendar “${title}” em ${programLabel}, ${dateLabel}.${partial} Os agendamentos concluídos foram mantidos; tente novamente.`);
      },
      complete: () => {
        this.addingContents.set(false);
        this.addContentDate.set(null);
        let createdLabel = 'agendamentos criados';
        if (created === 1) createdLabel = 'agendamento criado';
        this.toast.show(`${created} ${createdLabel}.`);
      },
    }));
  }
  scheduleDay(date: string): void { this.selected.set(null); this.addContent(date); }
  timelineLeft(entry: ScheduleEntry): number { return getTimelineLeft(entry); }
  timelineWidth(entry: ScheduleEntry): number { return getTimelineWidth(entry); }
  viewPosts(date: string): void {
    this.selected.set(date);
    this.viewOnly.set(true);
    this.calendarNow.set(new Date());
    this.resetForm();
  }
  closeDayPosts(): void {
    this.selected.set(null);
  }
  titleOf = (e: ScheduleEntry) => e.publicationTitle ?? this.publicationOf(e.publicationId)?.title ?? `Publicação ${e.publicationId}`;
  isPast = (date: string) => date < this.today;

  resetForm(): void {
    this.editing.set(null);
    this.error.set('');
    this.reviewingEntry.set(false);
    this.form = emptyCalendarEntryForm(this.selected());
  }

  edit(e: ScheduleEntry): void {
    this.editing.set(e);
    this.error.set('');
    this.reviewingEntry.set(false);
    this.form = calendarEntryForm(e);
  }

  editDayEntry(entry: ScheduleEntry): void {
    this.selected.set(entry.date);
    this.viewOnly.set(false);
    this.calendarNow.set(new Date());
    this.edit(entry);
  }

  save(date: string): void {
    if (!this.editing() && !this.reviewingEntry()) {
      this.reviewingEntry.set(true);
      return;
    }
    this.error.set('');
    const validationError = calendarEntryValidationError(date, this.form);
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    const turn = this.form.turnSeconds ?? undefined;
    const current = this.editing();
    if (current) {
      this.updateUC.execute(current.id, { date, programId: this.form.programId ?? undefined, startTime: this.form.startTime, endTime: this.form.endTime, turnSeconds: turn }).subscribe({
        next: () => { this.toast.show('Agendamento atualizado'); this.resetForm(); this.load(); },
        error: e => this.error.set(errorMessage(e)),
      });
      return;
    }
    const dates = datesBetweenInclusive(date, this.form.endDate);
    if (!dates.length) {
      this.error.set('A data final deve ser igual ou posterior à inicial.');
      return;
    }
    const publicationId = this.form.publicationId;
    const programId = this.form.programId;
    if (publicationId === null || programId === null) {
      this.error.set('Selecione o conteúdo e a programação antes de agendar.');
      return;
    }
    const pending = missingScheduleEntries(
      [publicationId], [programId], dates, this.entries(), this.form.startTime, this.form.endTime, this.form.turnSeconds ?? undefined,
    );
    if (!pending.length) {
      this.error.set('Este conteúdo já está agendado nesse período e horário.');
      return;
    }
    let created = 0;
    this.scheduleEntriesUseCase.execute({ tasks: pending }).subscribe(scheduleEntriesObserver({
      progress: event => {
        created = event.completed;
        this.entries.update(entries => [...entries, event.entry]);
      },
      error: err => this.error.set(errorMessage(err)),
      scheduleError: err => {
        let completedLabel = '';
        if (err.completed) completedLabel = ` ${err.completed} dia(s) já foram agendados.`;
        this.error.set(`${errorMessage(err.originalError)}${completedLabel} Ajuste o período e tente novamente.`);
      },
      complete: () => {
        let createdLabel = 'agendamentos criados';
        if (created === 1) createdLabel = 'agendamento criado';
        this.toast.show(`${created} ${createdLabel}`);
        this.resetForm();
        this.load();
      },
    }));
  }

  publicationTitle = (publicationId: number | null): string =>
    this.pubs().find(publication => publication.id === publicationId)?.title ?? 'Conteúdo selecionado';

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
