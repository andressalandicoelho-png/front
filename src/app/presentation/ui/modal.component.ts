import { Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <header class="modal-head">
          <strong>{{ title() }}</strong>
          <button type="button" class="icon-btn" aria-label="Fechar" (click)="closed.emit()"><app-icon name="x" [size]="20"/></button>
        </header>
        <div class="modal-body"><ng-content/></div>
      </div>
    </div>`,
})
export class ModalComponent {
  title = input.required<string>();
  closed = output<void>();
}
