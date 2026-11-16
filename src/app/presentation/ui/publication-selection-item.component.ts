import { Component, input, output } from '@angular/core';
import { Publication } from '@domain/publication/publication.entity';
import { SecureMediaComponent } from './secure-media.component';

@Component({
  selector: 'app-publication-selection-item',
  imports: [SecureMediaComponent],
  template: `
    <label class="add-content-item" role="listitem" [class.selected]="selected()" [class.already-added]="alreadyAdded()">
      <input type="checkbox" [checked]="checked()" [disabled]="disabled()" (change)="onChange($event)">
      <span class="add-content-thumb media-thumb"><app-secure-media [mediaId]="publication().mediaId" [type]="publication().type"/></span>
      <span class="add-content-info">
        <span class="add-content-title-row"><strong>{{ publication().title }}</strong><small class="add-content-published">{{ badge() }}</small></span>
        <small>{{ description() }}</small>
      </span>
      <span class="add-content-status">{{ status() }}</span>
    </label>
  `,
})
export class PublicationSelectionItemComponent {
  publication = input.required<Publication>();
  checked = input(false);
  disabled = input(false);
  selected = input(false);
  alreadyAdded = input(false);
  badge = input.required<string>();
  description = input.required<string>();
  status = input.required<string>();
  selectionChanged = output<boolean>();

  onChange(event: Event): void {
    this.selectionChanged.emit((event.target as HTMLInputElement).checked);
  }
}