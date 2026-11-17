import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DeleteProgramUseCase, GenerateProgramPlayerTokenUseCase, ListProgramsUseCase, RemoveProgramEntryUseCase, UpdateProgramUseCase,
} from '@application/program/program.usecases';
import { ListExpiredProgramPublicationsUseCase, ListScheduleUseCase } from '@application/schedule/schedule.usecases';
import { Program } from '@domain/program/program.entity';
import { currentBusinessDate, currentBusinessTime } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { formatDate } from '@presentation/core/format';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/shared/icon.component';
import { ProgramPreviewComponent, ProgramPreviewItem } from '@presentation/ui/program/program-preview.component';
import { ProgramBrowserComponent } from '@presentation/ui/program/program-browser.component';
import { ProgramConnectionPanelComponent } from '@presentation/ui/program/program-connection-panel.component';
import { ProgramSequenceComponent } from '@presentation/ui/program/program-sequence.component';
import { ProgramAddEntriesDialogComponent } from '@presentation/ui/program/program-add-entries-dialog.component';
import { ProgramDialogsComponent } from '@presentation/ui/program/program-dialogs.component';
import {
  copyProgramPlayerUrl, nextProgramSchedule, nextProgramScheduleLabel,
  programPreviewItem, upcomingProgramSchedules,
} from './program-page.helpers';
import { ProgramScheduleState } from './program-schedule-state';

@Component({
  selector: 'app-programs',
  imports: [IconComponent, ProgramPreviewComponent, ProgramBrowserComponent, ProgramConnectionPanelComponent, ProgramSequenceComponent, ProgramAddEntriesDialogComponent, ProgramDialogsComponent],
  templateUrl: './programs.page.html',
})
export class ProgramsPage implements OnInit, OnDestroy {
  readonly auth = inject(AuthState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listProgramsUseCase = inject(ListProgramsUseCase);
  private readonly updateProgramUseCase = inject(UpdateProgramUseCase);
  private readonly deleteProgramUseCase = inject(DeleteProgramUseCase);
  private readonly listExpiredProgramPublicationsUseCase = inject(ListExpiredProgramPublicationsUseCase);
  private readonly listScheduleUseCase = inject(ListScheduleUseCase);
  private readonly removeProgramEntryUseCase = inject(RemoveProgramEntryUseCase);
  private readonly generatePlayerTokenUseCase = inject(GenerateProgramPlayerTokenUseCase);
  private readonly toastService = inject(ToastService);
  readonly formatDate = formatDate;
  private readonly scheduleState = new ProgramScheduleState(
    this.listExpiredProgramPublicationsUseCase, this.listScheduleUseCase,
  );

  programs = signal<Program[]>([]);
  selected = signal<Program | null>(null);
  modal = signal(false);
  previewOpen = signal(false);
  previewEntry = signal<Program['entries'][number] | null>(null);
  today = currentBusinessDate();
  currentBusinessTime = signal(currentBusinessTime());
  generatingToken = signal(false);
  copiedProgramId = signal<number | null>(null);
  error = signal('');
  pendingEntryRemoval = signal<{ program: Program; entry: Program['entries'][number] } | null>(null);
  entryRemovalError = signal('');
  deletingEntry = signal(false);
  pendingDeletion = signal<Program | null>(null);
  deleteError = signal('');
  deleting = signal(false);
  private readonly copiedLinkTimer: { value: ReturnType<typeof setTimeout> | null } = { value: null };
  readonly programSchedules = this.scheduleState.programSchedules;
  readonly expiredPublicationIds = this.scheduleState.expiredPublicationIds;
  readonly programScheduleLoading = this.scheduleState.programScheduleLoading;
  readonly programScheduleError = this.scheduleState.programScheduleError;
  private scheduleStatusTimer: ReturnType<typeof setInterval> | null = null;
  previewItems = computed<ProgramPreviewItem[]>(() => (this.selected()?.entries ?? []).map(entry =>
    programPreviewItem(entry, nextProgramSchedule(this.upcomingSchedules(), entry.publicationId), this.formatDate)));
  upcomingSchedules = computed(() =>
    upcomingProgramSchedules(this.programSchedules(), this.today, this.currentBusinessTime()));
  playerToken = signal<string | null>(null);
  ngOnInit(): void {
    this.load();
    this.scheduleStatusTimer = setInterval(() => {
      this.today = currentBusinessDate();
      this.currentBusinessTime.set(currentBusinessTime());
      const selected = this.selected();
      if (selected) this.scheduleState.refreshExpiredPublications(selected.id);
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.scheduleStatusTimer) clearInterval(this.scheduleStatusTimer);
  }

  load(): void {
    this.listProgramsUseCase.execute().subscribe({
      next: programs => {
        const ownerId = this.auth.user()?.id;
        const ownedPrograms = programs.filter(program => program.createdById === ownerId);
        this.programs.set(ownedPrograms);
        const requestedProgramId = Number(this.route.snapshot.queryParamMap.get('programId'));
        const selected = this.selected();
        let target = ownedPrograms.find(program => program.id === requestedProgramId);
        if (!target && selected) {
          target = ownedPrograms.find(program => program.id === selected.id);
        }
        this.selected.set(target ?? null);
        if (target) {
          this.playerToken.set(this.auth.getProgramPlayerToken(target.id));
          this.loadProgramSchedule(target.id);
        }
        else {
          this.playerToken.set(null);
          this.scheduleState.clear();
        }
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  select(program: Program): void {
    this.selected.set(program);
    this.playerToken.set(this.auth.getProgramPlayerToken(program.id));
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
  nextScheduleLabelFor = (publicationId: number): string =>
    nextProgramScheduleLabel(nextProgramSchedule(this.upcomingSchedules(), publicationId), this.formatDate);
  allEntriesExpired(program: Program): boolean { return this.scheduleState.allEntriesExpired(program); }
  playerUrl(token: string, programId: number): string { return `${location.origin}/player/${token}/program/${programId}`; }

  openCreate(): void {
    this.router.navigate(['/programacao/nova']);
  }

  openAddEntries(): void {
    this.error.set('');
    this.modal.set(true);
  }

  toggle(program: Program): void {
    this.updateProgramUseCase.execute(program.id, { active: !program.active }).subscribe({
      next: updated => {
        this.selected.set(updated);
        if (updated.active) this.toastService.show('Programação ativada');
        else this.toastService.show('Programação pausada');
        this.load();
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  updateSelectedProgram(program: Program): void {
    this.selected.set(program);
    this.programs.update(programs => programs.map(item => {
      if (item.id === program.id) return program;
      return item;
    }));
  }

  requestRemoveEntry(program: Program, entry: Program['entries'][number]): void {
    this.entryRemovalError.set('');
    this.pendingEntryRemoval.set({ program, entry });
  }

  closeEntryRemoval(): void {
    if (this.deletingEntry()) return;
    this.pendingEntryRemoval.set(null);
    this.entryRemovalError.set('');
  }

  confirmEntryRemoval(): void {
    const pending = this.pendingEntryRemoval();
    if (!pending) return;
    this.deletingEntry.set(true);
    this.entryRemovalError.set('');
    this.removeProgramEntryUseCase.execute(pending.program.id, pending.entry.id).subscribe({
      next: updated => {
        this.deletingEntry.set(false);
        this.pendingEntryRemoval.set(null);
        this.selected.set(updated);
        this.load();
        this.toastService.show('Conteúdo removido da programação');
      },
      error: error => {
        this.deletingEntry.set(false);
        this.entryRemovalError.set(errorMessage(error));
      },
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

  generatePlayerToken(programId: number): void {
    const program = this.selected();
    if (!program || program.id !== programId) return;
    const renewing = program.hasPlayerToken;
    this.generatingToken.set(true);
    this.generatePlayerTokenUseCase.execute(programId).subscribe({
      next: token => {
        this.generatingToken.set(false);
        this.auth.setProgramPlayerToken(programId, token);
        this.playerToken.set(token);
        this.selected.update(current => current?.id === programId ? { ...current, hasPlayerToken: true } : current);
        this.programs.update(programs => programs.map(item => item.id === programId ? { ...item, hasPlayerToken: true } : item));
        if (renewing) this.toastService.show('Link desta programação renovado. As outras programações não foram alteradas.');
        else this.toastService.show('Link gerado somente para esta programação.');
      },
      error: error => { this.generatingToken.set(false); this.error.set(errorMessage(error)); },
    });
  }

  loadProgramSchedule(programId: number): void {
    this.currentBusinessTime.set(currentBusinessTime());
    this.scheduleState.load(programId, this.today);
  }

  copyPlayerUrl(programId: number): void {
    const token = this.auth.getProgramPlayerToken(programId);
    if (!token) return;
    copyProgramPlayerUrl(token, programId, this.copiedProgramId, this.copiedLinkTimer,
      message => this.toastService.show(message), message => this.error.set(message));
  }
}
