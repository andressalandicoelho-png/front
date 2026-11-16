import { Component, input, output } from '@angular/core';
import { Program } from '@domain/program/program.entity';
import { ConfirmActionComponent } from '../shared/confirm-action.component';
import { ContentPreviewComponent } from '../shared/content-preview.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';

type ProgramEntry = Program['entries'][number];

@Component({
  selector: 'app-program-dialogs',
  imports: [ConfirmActionComponent, ContentPreviewComponent, IconComponent, ModalComponent],
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

    @if (pendingTokenRenewal()) {
      <app-modal title="Renovar link da TV?" (closed)="tokenRenewalCancelled.emit()">
        <div class="confirm-content">
          <span class="confirm-icon danger"><app-icon name="info" [size]="22"/></span>
          <p class="muted">Os links atuais de todas as programações serão invalidados. Atualize cada TV.</p>
          <div class="actions">
            <button class="btn" type="button" [disabled]="generatingToken()" (click)="tokenRenewalCancelled.emit()">Manter links atuais</button>
            <button class="btn danger-button" type="button" [disabled]="generatingToken()" (click)="tokenRenewalConfirmed.emit()">
              @if (generatingToken()) { Renovando… } @else { Renovar todos os links }
            </button>
          </div>
        </div>
      </app-modal>
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
  readonly pendingTokenRenewal = input(false);
  readonly generatingToken = input(false);
  readonly previewEntryClosed = output<void>();
  readonly entryRemovalCancelled = output<void>();
  readonly entryRemovalConfirmed = output<void>();
  readonly deletionCancelled = output<void>();
  readonly deletionConfirmed = output<Program>();
  readonly tokenRenewalCancelled = output<void>();
  readonly tokenRenewalConfirmed = output<void>();
}
