import { Component, input, output } from '@angular/core';
import { PublicationType } from '@domain/publication/publication.entity';
import { publicationTypeName } from '@presentation/formatters/publication-type-name';
import { IconComponent } from '../shared/icon.component';
import { SecureMediaComponent } from '../shared/secure-media.component';

@Component({
  selector: 'app-program-publication-row',
  imports: [IconComponent, SecureMediaComponent],
  template: `
    <article class="program-sequence-item">
      <span class="program-sequence-position">{{ position().toString().padStart(2, '0') }}</span>
      <span class="program-sequence-thumb media-thumb">
        <app-secure-media [mediaId]="mediaId()" [type]="type()"/>
      </span>
      <span class="program-sequence-copy">
        <span class="program-sequence-title-row">
          <strong>{{ title() }}</strong>
        </span>
        @if (type() === 'MESSAGE') {
          <small class="program-sequence-duration">Fixa durante o horário agendado</small>
        }
        @if (detailLabel()) {
          <small class="program-sequence-schedule">{{ detailLabel() }}</small>
        }
      </span>
      <span class="program-sequence-type">{{ typeName(type()) }}</span>
      <span class="program-sequence-preview">
        <button type="button" class="icon-btn program-sequence-view"
          [attr.aria-label]="'Visualizar ' + title()" title="Visualizar"
          (click)="previewRequested.emit()">
          <app-icon name="eye" [size]="17"/>
        </button>
      </span>
      <button type="button" class="icon-btn danger"
        [attr.aria-label]="'Remover ' + title() + ' da programação'" title="Excluir"
        [disabled]="removeDisabled()" (click)="removeRequested.emit()">
        <app-icon name="trash" [size]="17"/>
      </button>
    </article>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
  `],
})
export class ProgramPublicationRowComponent {
  position = input.required<number>();
  title = input.required<string>();
  type = input.required<PublicationType>();
  mediaId = input<number | null>(null);
  detailLabel = input('');
  removeDisabled = input(false);

  previewRequested = output<void>();
  removeRequested = output<void>();

  readonly typeName = publicationTypeName;
}
