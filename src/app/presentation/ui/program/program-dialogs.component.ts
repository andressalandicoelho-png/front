import { Component, input, output } from '@angular/core';
import { Program } from '@domain/program/program.entity';
import { ConfirmActionComponent } from '../shared/confirm-action.component';
import { ContentPreviewComponent } from '../shared/content-preview.component';
import { ModalComponent } from '../shared/modal.component';

type ProgramEntry = Program['entries'][number];

@Component({
  selector: 'app-program-dialogs',
  imports: [ConfirmActionComponent, ContentPreviewComponent, ModalComponent],
  template: `
    @if (previewEntry(); as entry) {
      <app-modal [title]="entry.publicationTitle" (closed)="previewEntryClosed.emit()">
        <app-content-preview [type]="entry.publicationType" [content]="entry.publicationContent"
          [mediaId]="entry.mediaFileId" [linkUrl]="entry.linkUrl" [autoplay]="entry.publicationType === 'VIDEO'"/>
      </app-modal>
    }

    @if (pendingEntryRemoval(); as pending) {
      <app-confirm-action
        title="Excluir conteúdo da programação?"
        [heading]="'Excluir “' + pending.entry.publicationTitle + '”?'"
        message="O conteúdo será removido da sequência desta programação. A publicação e os agendamentos no calendário serão mantidos."
        confirmLabel="Excluir conteúdo"
        [busy]="deletingEntry()"
        [error]="entryRemovalError()"
        (cancelled)="entryRemovalCancelled.emit()"
        (confirmed)="entryRemovalConfirmed.emit()"/>
    }

    @if (pendingDeletion(); as program) {
      <app-confirm-action
        title="Excluir programação?"
        [heading]="'Excluir “' + program.name + '”?'"
        message="A sequência e os agendamentos sairão do calendário. O histórico e as publicações serão mantidos."
        confirmLabel="Excluir programação"
        [busy]="deleting()"
        [error]="deleteError()"
        (cancelled)="deletionCancelled.emit()"
        (confirmed)="deletionConfirmed.emit(program)"/>
    }

  `,
})
export class ProgramDialogsComponent {
  readonly previewEntry = input<ProgramEntry | null>(null);
  readonly pendingEntryRemoval = input<{ program: Program; entry: ProgramEntry } | null>(null);
  readonly entryRemovalError = input('');
  readonly deletingEntry = input(false);
  readonly pendingDeletion = input<Program | null>(null);
  readonly deleteError = input('');
  readonly deleting = input(false);
  readonly previewEntryClosed = output<void>();
  readonly entryRemovalCancelled = output<void>();
  readonly entryRemovalConfirmed = output<void>();
  readonly deletionCancelled = output<void>();
  readonly deletionConfirmed = output<Program>();
}
