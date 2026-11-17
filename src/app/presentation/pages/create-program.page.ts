import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AddProgramEntriesUseCase, CreateProgramUseCase } from '@application/program/program.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { ScheduleEntriesError, ScheduleEntriesUseCase } from '@application/schedule/schedule-entries.usecase';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { currentBusinessDate } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { formatDate } from '@presentation/core/format';
import { completedScheduleMessage } from '@presentation/core/schedule-error-message';
import { createDefaultPublicationSchedule, isPublicationScheduleValid, updatePublicationSchedule } from '@presentation/core/publication-schedule';
import { ToastService } from '@presentation/core/toast.service';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';
import type { ProgramPreviewItem } from '@presentation/ui/program/program-preview.component';
import { ScheduleProgressComponent } from '@presentation/ui/program/schedule-progress.component';
import { ProgramCreateContentPanelComponent } from '@presentation/ui/program/program-create-content-panel.component';
import { ProgramCreationReviewDialogComponent } from '@presentation/ui/program/program-creation-review-dialog.component';
import { ProgramCreateDialogsComponent } from '@presentation/ui/program/program-create-dialogs.component';
import {
  createProgramScheduleTasks, durationLabel, programDuration, programPreviewItems, programScheduleKey,
  publicationScheduleSummary as programScheduleSummary, programSchedulesValid, programSummaryPeriod, pickerSchedule,
  publicationSchedule, publicationScheduleDates, removePublicationSchedule, toggleId,
  totalScheduledDateCount, updateSelectedSchedules, selectedProgramPublications,
} from './create-program.helpers';

@Component({
  selector: 'app-create-program',
  imports: [FormsModule, RouterLink, ScheduleProgressComponent, ProgramCreateContentPanelComponent, ProgramCreationReviewDialogComponent, ProgramCreateDialogsComponent],
  templateUrl: './create-program.page.html',
})
export class CreateProgramPage implements OnInit {
  private readonly listPublications = inject(ListPublicationsUseCase);
  private readonly createProgram = inject(CreateProgramUseCase);
  private readonly addProgramEntries = inject(AddProgramEntriesUseCase);
  private readonly scheduleEntriesUseCase = inject(ScheduleEntriesUseCase);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  name = '';
  readonly currentYear = new Date().getFullYear();
  today = currentBusinessDate();
  libraryOpen = signal(false);
  pickerPublicationIds = signal<number[]>([]);
  pickerSchedule = signal<PublicationScheduleForm>(createDefaultPublicationSchedule(this.today));
  loading = signal(false);
  publicationLoadError = signal('');
  saving = signal(false);
  error = signal('');
  createdProgram = signal<Program | null>(null);
  readyPublications = signal<Publication[]>([]);
  selectedPublicationIds = signal<number[]>([]);
  schedules = signal<Record<number, PublicationScheduleForm>>({});
  scheduledScheduleKeys = signal<string[]>([]);
  entriesAdded = signal(false);
  previewOpen = signal(false);
  previewPublication = signal<Publication | null>(null);
  reviewOpen = signal(false);
  scheduleProgress = signal({ completed: 0, total: 0 });

  selectedPublications = computed(() => selectedProgramPublications(this.readyPublications(), this.selectedPublicationIds()));
  totalDuration = computed(() => this.selectedPublications().reduce(
    (sum, publication) => {
      if (publication.type === 'MESSAGE') return sum;
      return sum + programDuration(publication);
    }, 0,
  ));
  previewItems = computed<ProgramPreviewItem[]>(() =>
    programPreviewItems(this.selectedPublications(), this.schedules(), this.formatDate));
  schedulesValid = computed(() =>
    programSchedulesValid(this.selectedPublications(), this.schedules(), this.scheduledScheduleKeys(), this.today));

  ngOnInit(): void {
    this.loadPublications();
  }

  loadPublications(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.publicationLoadError.set('');
    this.listPublications.execute({ status: 'READY' }).subscribe({
      next: publications => {
        this.readyPublications.set(publications.filter(publication => publication.status === 'READY'));
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.publicationLoadError.set(errorMessage(error));
      },
    });
  }

  readonly formatDate = formatDate;
  scheduleSummary = (publication: Publication): string =>
    programScheduleSummary(publication.id, this.schedules(), this.formatDate);

  summaryPeriod(): string {
    return programSummaryPeriod(this.selectedPublications(), this.schedules(), this.formatDate);
  }

  totalDurationLabel = (): string => durationLabel(this.totalDuration());

  scheduledEntryCount(): number {
    return totalScheduledDateCount(this.selectedPublications(), this.schedules(), this.scheduledScheduleKeys());
  }

  openPublicationPicker(): void {
    this.pickerPublicationIds.set([...this.selectedPublicationIds()]);
    this.pickerSchedule.set(pickerSchedule(this.selectedPublicationIds(), this.schedules(), this.today));
    this.libraryOpen.set(true);
  }

  closePublicationPicker = (): void => this.libraryOpen.set(false);

  confirmPublicationSelection(): void {
    if (!this.pickerScheduleValid()) return;
    const selectedIds = this.pickerPublicationIds();
    const previousIds = this.selectedPublicationIds();
    this.selectedPublicationIds.set([...selectedIds]);
    this.schedules.update(schedules =>
      updateSelectedSchedules(schedules, previousIds, selectedIds, this.pickerSchedule()));
    this.libraryOpen.set(false);
  }

  togglePickerPublication(publicationId: number, checked: boolean): void {
    this.pickerPublicationIds.update(ids => toggleId(ids, publicationId, checked));
  }

  updatePickerSchedule(field: keyof PublicationScheduleForm, value: string): void {
    this.pickerSchedule.update(schedule => updatePublicationSchedule(schedule, field, value));
  }

  pickerScheduleValid = (): boolean => isPublicationScheduleValid(this.pickerSchedule(), this.today);

  togglePublication(publicationId: number): void {
    const wasSelected = this.selectedPublicationIds().includes(publicationId);
    this.selectedPublicationIds.update(ids => toggleId(ids, publicationId));
    if (wasSelected) this.schedules.update(schedules => removePublicationSchedule(schedules, publicationId));
  }

  save(): void {
    this.error.set('');
    if (!this.validateBeforeSave()) return;
    if (!this.createdProgram()) {
      this.reviewOpen.set(true);
      return;
    }
    this.confirmSave();
  }

  confirmSave(): void {
    if (!this.validateBeforeSave()) return;
    this.reviewOpen.set(false);
    const existing = this.createdProgram();
    if (existing) {
      if (this.entriesAdded()) this.scheduleEntries(existing);
      else this.addEntries(existing);
      return;
    }
    const name = this.name.trim();

    this.saving.set(true);
    this.error.set('');
    this.createProgram.execute(name).subscribe({
      next: program => {
        this.createdProgram.set(program);
        if (this.selectedPublicationIds().length) this.addEntries(program);
        else this.finish(program);
      },
      error: error => {
        this.saving.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  private addEntries(program: Program): void {
    this.addProgramEntries.execute(program.id, this.selectedPublicationIds()).subscribe({
      next: updatedProgram => {
        this.entriesAdded.set(true);
        this.scheduleEntries(updatedProgram);
      },
      error: error => {
        this.saving.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  private scheduleEntries(program: Program): void {
    const alreadyScheduled = new Set(this.scheduledScheduleKeys());
    const tasks = createProgramScheduleTasks(
      this.selectedPublications(), this.schedules(), alreadyScheduled, program.id,
    );
    if (!tasks.length) {
      this.finish(program);
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.scheduleEntriesUseCase.execute({ tasks }).subscribe({
      next: event => {
        if (event.type === 'started') {
          this.scheduleProgress.set({ completed: 0, total: event.total });
          return;
        }
        this.scheduleProgress.set({ completed: event.completed, total: event.total });
        this.scheduledScheduleKeys.update(keys => [...keys, programScheduleKey(event.entry.publicationId, event.entry.date)]);
      },
      error: error => {
        this.saving.set(false);
        if (!(error instanceof ScheduleEntriesError)) {
          this.error.set(errorMessage(error));
          return;
        }
        const title = this.selectedPublications().find(publication => publication.id === error.task.publicationId)?.title
          ?? `Conteúdo ${error.task.publicationId}`;
        const partial = completedScheduleMessage(error.completed);
        this.error.set(`${errorMessage(error.originalError)} Falha ao agendar “${title}” em ${this.formatDate(error.task.date)}.${partial} Ajuste o período e tente novamente.`);
      },
      complete: () => this.finish(program),
    });
  }

  private finish(program: Program): void {
    this.saving.set(false);
    const contents = this.selectedPublications().length;
    const schedules = this.scheduledEntryCount();
    let message = 'Programação criada. Adicione conteúdos depois.';
    if (contents) {
      let contentLabel = 'conteúdos';
      let scheduleLabel = 'agendamentos';
      if (contents === 1) contentLabel = 'conteúdo';
      if (schedules === 1) scheduleLabel = 'agendamento';
      message = `Programação criada: ${contents} ${contentLabel}, ${schedules} ${scheduleLabel}.`;
    }
    this.toast.show(message);
    this.router.navigate(['/programacao'], { queryParams: { programId: program.id } });
  }

  private validateBeforeSave(): boolean {
    if (!this.createdProgram() && this.name.trim().length < 2) {
      this.error.set('Informe um nome com 2 caracteres ou mais.');
      return false;
    }
    if (!this.schedulesValid()) {
      this.error.set('Preencha datas e horários; o fim deve ser posterior ao início.');
      return false;
    }
    return true;
  }

}
