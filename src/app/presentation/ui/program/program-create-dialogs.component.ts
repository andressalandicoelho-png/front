import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Publication } from '@domain/publication/publication.entity';
import { ProgramPreviewComponent } from './program-preview.component';
import { ProgramPreviewItem } from '@presentation/models/program-preview-item';
import { ContentPreviewComponent } from '../shared/content-preview.component';
import { ModalComponent } from '../shared/modal.component';
import { PublicationPickerComponent } from '../publication/publication-picker.component';
import { PublicationScheduleFieldsComponent } from '../publication/publication-schedule-fields.component';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';

@Component({
  selector: 'app-program-create-dialogs',
  imports: [
    FormsModule,
    ContentPreviewComponent,
    ModalComponent,
    ProgramPreviewComponent,
    PublicationPickerComponent,
    PublicationScheduleFieldsComponent,
  ],
  template: `
    @if (libraryOpen()) {
      <app-modal class="calendar-modal add-content-modal" title="Adicionar conteúdos"
        subtitle="Selecione as mídias da biblioteca e configure os horários de exibição."
        (closed)="libraryClosed.emit()">
        <form class="add-content-dialog" (ngSubmit)="selectionConfirmed.emit()">
          <div class="add-content-context">
            <div class="add-content-period-heading">
              <strong>Período e horários de exibição</strong>
              <small>Aplicados a todos os conteúdos selecionados. Você pode ajustar cada conteúdo depois.</small>
            </div>
            <app-publication-schedule-fields [schedule]="schedule()" [minDate]="minDate()"
              namePrefix="pickerSchedule"
              (scheduleChanged)="scheduleChanged.emit($event)"/>
            @if (!scheduleValid()) {
              <small class="error" role="alert">Informe um período válido, com o horário final após o inicial.</small>
            }
          </div>
          <app-publication-picker
            [publications]="publications()"
            [selectedIds]="selectedIds()"
            [loading]="loading()"
            [loadError]="loadError()"
            [confirmDisabled]="!selectedIds().length || !scheduleValid()"
            [confirmLabel]="publicationPickerConfirmLabel()"
            (selectionChanged)="selectionChanged.emit($event)"
            (clearSelectionRequested)="clearSelectionRequested.emit()"
            (retryRequested)="retryRequested.emit()"
            (cancelled)="libraryClosed.emit()"/>
        </form>
      </app-modal>
    }

    <app-program-preview
      title="Prévia da programação"
      [items]="previewItems()"
      [open]="previewOpen()"
      (closed)="previewClosed.emit()"/>

    @if (previewPublication(); as publication) {
      <app-modal [title]="publication.title" (closed)="publicationPreviewClosed.emit()">
        <app-content-preview [type]="publication.type" [content]="publication.content"
          [mediaId]="publication.mediaId" [linkUrl]="publication.linkUrl"
          [autoplay]="publication.type === 'VIDEO'"/>
      </app-modal>
    }
  `,
})
export class ProgramCreateDialogsComponent {
  readonly libraryOpen = input(false);
  readonly publications = input.required<Publication[]>();
  readonly selectedIds = input.required<number[]>();
  readonly schedule = input.required<PublicationScheduleForm>();
  readonly minDate = input.required<string>();
  readonly loading = input(false);
  readonly loadError = input('');
  readonly scheduleValid = input(false);
  readonly previewItems = input.required<ProgramPreviewItem[]>();
  readonly previewOpen = input(false);
  readonly previewPublication = input<Publication | null>(null);

  publicationPickerConfirmLabel(): string {
    let contentLabel = 'conteúdos';
    if (this.selectedIds().length === 1) contentLabel = 'conteúdo';
    return `Adicionar ${this.selectedIds().length} ${contentLabel}`;
  }

  readonly libraryClosed = output<void>();
  readonly selectionConfirmed = output<void>();
  readonly scheduleChanged = output<{ field: keyof PublicationScheduleForm; value: string }>();
  readonly selectionChanged = output<{ publicationId: number; checked: boolean }>();
  readonly clearSelectionRequested = output<void>();
  readonly retryRequested = output<void>();
  readonly previewClosed = output<void>();
  readonly publicationPreviewClosed = output<void>();
}
