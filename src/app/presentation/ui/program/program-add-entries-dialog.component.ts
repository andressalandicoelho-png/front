import { Component, OnChanges, SimpleChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddProgramEntriesUseCase } from '@application/program/program.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { ScheduleEntriesUseCase } from '@application/schedule/schedule-entries.usecase';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { datesBetweenInclusive } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { formatDate } from '@presentation/core/format';
import { scheduleEntriesObserver } from '@presentation/core/schedule-entries-observer';
import { completedScheduleMessage } from '@presentation/core/schedule-error-message';
import { createDefaultPublicationSchedule, isPublicationScheduleValid, updatePublicationSchedule } from '@presentation/core/publication-schedule';
import { ToastService } from '@presentation/core/toast.service';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';
import { CalendarReviewRow, CalendarReviewTableComponent } from '../calendar/calendar-review-table.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { PublicationPickerComponent } from '../publication/publication-picker.component';
import { PublicationScheduleFieldsComponent } from '../publication/publication-schedule-fields.component';
import { ScheduleProgressComponent } from './schedule-progress.component';

@Component({
  selector: 'app-program-add-entries-dialog',
  imports: [
    FormsModule,
    CalendarReviewTableComponent,
    IconComponent,
    ModalComponent,
    PublicationPickerComponent,
    PublicationScheduleFieldsComponent,
    ScheduleProgressComponent,
  ],
  templateUrl: './program-add-entries-dialog.component.html',
})
export class ProgramAddEntriesDialogComponent implements OnChanges {
  private readonly listPublications = inject(ListPublicationsUseCase);
  private readonly addProgramEntries = inject(AddProgramEntriesUseCase);
  private readonly scheduleEntriesUseCase = inject(ScheduleEntriesUseCase);
  private readonly toastService = inject(ToastService);
  readonly open = input(false);
  readonly program = input<Program | null>(null);
  readonly today = input.required<string>();
  readonly formatDate = formatDate;
  readonly closed = output<void>();
  readonly programUpdated = output<Program>();
  readonly refreshRequested = output<void>();
  readonly errorChanged = output<string>();

  readonly publications = signal<Publication[]>([]);
  readonly publicationsLoading = signal(false);
  readonly publicationsLoadError = signal('');
  readonly selectedPublicationIds = signal<number[]>([]);
  readonly sharedSchedule = signal<PublicationScheduleForm>({ date: '', endDate: '', startTime: '', endTime: '' });
  readonly scheduledEntries = signal<Array<Pick<ScheduleEntry, 'publicationId' | 'date'>>>([]);
  readonly entriesAdded = signal(false);
  readonly reviewing = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly scheduleProgress = signal({ completed: 0, total: 0 });
  private publicationsLoaded = false;

  readonly availablePublications = computed(() => {
    const assigned = new Set(this.program()?.entries.map(entry => entry.publicationId) ?? []);
    const retryingSelection = new Set<number>();
    if (this.entriesAdded()) {
      for (const id of this.selectedPublicationIds()) retryingSelection.add(id);
    }
    return this.publications().filter(publication =>
      publication.status === 'READY' && (!assigned.has(publication.id) || retryingSelection.has(publication.id)),
    );
  });
  readonly schedulesValid = computed(() => {
    const schedule = this.sharedSchedule();
    const valid = isPublicationScheduleValid(schedule, this.today());
    return this.selectedPublicationIds().every(id => this.scheduleComplete(id) || valid);
  });
  readonly reviewScheduleCount = computed(() => this.selectedPublicationIds().reduce((count, id) =>
    count + this.datesFor().filter(date => !this.isScheduled(id, date)).length, 0));
  readonly reviewRows = computed<CalendarReviewRow[]>(() => this.selectedPublicationIds().map(id => {
    const publication = this.publications().find(item => item.id === id);
    let status = 'Disponível';
    if (this.scheduleComplete(id)) status = 'Agendado';
    return {
      id,
      title: publication?.title ?? `Conteúdo ${id}`,
      type: publication?.type ?? 'LINK',
      status,
      scheduleSummary: `${this.scheduledCount(id)} de ${this.datesFor().length} dias agendados`,
    };
  }));
  readonly cancelDisabled = computed(() => this.saving() || (this.entriesAdded() &&
    !this.selectedPublicationIds().every(id => this.scheduleComplete(id))));
  readonly confirmLabel = computed(() => {
    if (this.saving()) return 'Agendando…';
    if (this.entriesAdded()) return 'Revisar e retomar agendamentos';
    const count = this.selectedPublicationIds().length;
    let contentLabel = 'conteúdos';
    if (count === 1) contentLabel = 'conteúdo';
    return `Revisar e agendar ${count} ${contentLabel}`;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open'] || !this.open()) return;
    this.selectedPublicationIds.set([]);
    this.sharedSchedule.set(createDefaultPublicationSchedule(this.today()));
    this.scheduledEntries.set([]);
    this.entriesAdded.set(false);
    this.reviewing.set(false);
    this.setError('');
    this.loadPublications();
  }

  loadPublications(): void {
    if (this.publicationsLoading() || this.publicationsLoaded) return;
    this.publicationsLoading.set(true);
    this.publicationsLoadError.set('');
    this.listPublications.execute().subscribe({
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

  requestClose(): void {
    if (!this.cancelDisabled()) this.closed.emit();
  }

  clearPublicationSelection(): void {
    if (this.saving() || this.entriesAdded()) return;
    this.selectedPublicationIds.set([]);
  }

  togglePublication(id: number, checked: boolean): void {
    if (this.entriesAdded()) return;
    this.selectedPublicationIds.update(ids => {
      if (checked) return [...ids, id];
      return ids.filter(value => value !== id);
    });
  }

  updateSharedSchedule(field: keyof PublicationScheduleForm, value: string): void {
    this.sharedSchedule.update(schedule => updatePublicationSchedule(schedule, field, value));
  }

  saveEntries(): void {
    if (!this.program()) return;
    this.setError('');
    this.reviewing.set(true);
  }

  confirmSaveEntries(): void {
    const program = this.program();
    if (!program) return;
    this.reviewing.set(false);
    this.saving.set(true);
    if (this.entriesAdded()) {
      this.scheduleEntries(program);
      return;
    }
    this.addProgramEntries.execute(program.id, this.selectedPublicationIds()).subscribe({
      next: updated => {
        this.entriesAdded.set(true);
        this.programUpdated.emit(updated);
        this.scheduleEntries(updated);
      },
      error: error => { this.saving.set(false); this.setError(errorMessage(error)); },
    });
  }

  private scheduleEntries(program: Program): void {
    const schedule = this.sharedSchedule();
    this.scheduleProgress.set({ completed: 0, total: 0 });
    const alreadyScheduled = new Set(this.scheduledEntries().map(entry => `${entry.publicationId}:${entry.date}`));
    const tasks = this.selectedPublicationIds().flatMap(publicationId =>
      this.datesFor()
        .filter(date => !alreadyScheduled.has(`${publicationId}:${date}`))
        .map(date => ({ publicationId, programId: program.id, date, startTime: schedule.startTime, endTime: schedule.endTime })),
    );
    this.scheduleEntriesUseCase.execute({ tasks }).subscribe(scheduleEntriesObserver({
      started: total => this.scheduleProgress.set({ completed: 0, total }),
      progress: event => {
        this.scheduleProgress.set({ completed: event.completed, total: event.total });
        this.scheduledEntries.update(entries => [...entries, { publicationId: event.entry.publicationId, date: event.entry.date }]);
      },
      error: error => {
        this.saving.set(false);
        this.setError(errorMessage(error));
      },
      scheduleError: error => {
        this.saving.set(false);
        const title = this.publications().find(publication => publication.id === error.task.publicationId)?.title
          ?? `Conteúdo ${error.task.publicationId}`;
        const partial = completedScheduleMessage(error.completed);
        this.setError(`${errorMessage(error.originalError)} Falha ao agendar “${title}” em ${formatDate(error.task.date)}.${partial} Ajuste o período e tente novamente.`);
      },
      complete: () => this.finishAddingEntries(),
    }));
  }

  private finishAddingEntries(): void {
    const contents = this.selectedPublicationIds().length;
    const schedules = this.scheduledEntries().length;
    this.saving.set(false);
    this.closed.emit();
    this.refreshRequested.emit();
    this.toastService.show(`${contents} conteúdo(s) adicionados em ${schedules} agendamento(s) diário(s).`);
  }

  private datesFor(): string[] {
    const schedule = this.sharedSchedule();
    return datesBetweenInclusive(schedule.date, schedule.endDate);
  }

  private scheduledCount(id: number): number {
    return this.datesFor().filter(date => this.isScheduled(id, date)).length;
  }

  private scheduleComplete(id: number): boolean {
    const dates = this.datesFor();
    return dates.length > 0 && this.scheduledCount(id) === dates.length;
  }

  private isScheduled(publicationId: number, date: string): boolean {
    return this.scheduledEntries().some(entry => entry.publicationId === publicationId && entry.date === date);
  }

  private setError(message: string): void {
    this.error.set(message);
    this.errorChanged.emit(message);
  }
}
