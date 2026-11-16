import { signal } from '@angular/core';
import { ListExpiredProgramPublicationsUseCase, ListScheduleUseCase } from '@application/schedule/schedule.usecases';
import { Program } from '@domain/program/program.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { errorMessage } from '@presentation/core/error-message';

export class ProgramScheduleState {
  readonly programSchedules = signal<ScheduleEntry[]>([]);
  readonly expiredPublicationIds = signal<number[] | null>(null);
  readonly programScheduleLoading = signal(false);
  readonly programScheduleError = signal('');
  private selectedProgramId: number | null = null;
  private expiredPublicationRequest = 0;

  constructor(
    private readonly listExpiredPublications: ListExpiredProgramPublicationsUseCase,
    private readonly listSchedule: ListScheduleUseCase,
  ) {}

  load(programId: number, from: string): void {
    this.selectedProgramId = programId;
    const endDate = new Date(`${from}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 29);
    this.programScheduleLoading.set(true);
    this.programScheduleError.set('');
    this.expiredPublicationIds.set(null);
    this.refreshExpiredPublications(programId);
    this.listSchedule.execute({ from, to: endDate.toISOString().slice(0, 10) }).subscribe({
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

  refreshExpiredPublications(programId: number): void {
    if (programId !== this.selectedProgramId) return;
    const request = ++this.expiredPublicationRequest;
    this.listExpiredPublications.execute(programId).subscribe({
      next: ids => {
        if (request === this.expiredPublicationRequest && this.selectedProgramId === programId) {
          this.expiredPublicationIds.set(ids);
        }
      },
      error: () => {
        if (request === this.expiredPublicationRequest && this.selectedProgramId === programId && this.expiredPublicationIds() === null) {
          this.expiredPublicationIds.set([]);
        }
      },
    });
  }

  allEntriesExpired(program: Program): boolean {
    const expired = this.expiredPublicationIds();
    return !!expired?.length && program.entries.length > 0 &&
      program.entries.every(entry => expired.includes(entry.publicationId));
  }

  clear(): void {
    this.selectedProgramId = null;
    this.expiredPublicationRequest++;
    this.programSchedules.set([]);
    this.expiredPublicationIds.set(null);
    this.programScheduleError.set('');
    this.programScheduleLoading.set(false);
  }
}
