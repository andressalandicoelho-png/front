import { Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-action',
  imports: [IconComponent, ModalComponent],
  template: `
    <app-modal [class.confirm-action--stacked]="stackAboveModal()" [title]="title()" (closed)="cancelled.emit()">
      <div class="confirm-content">
        <span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span>
        <h2>{{ heading() }}</h2>
        <p class="muted">{{ message() }}</p>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="actions">
          <button class="btn" type="button" [disabled]="busy()" (click)="cancelled.emit()">Cancelar</button>
          <button class="btn danger-button" type="button" [disabled]="busy()" (click)="confirmed.emit()">
            {{ busy() ? busyLabel() : confirmLabel() }}
          </button>
        </div>
      </div>
    </app-modal>
  `,
})
export class ConfirmActionComponent {
  title = input.required<string>();
  heading = input.required<string>();
  message = input.required<string>();
  confirmLabel = input.required<string>();
  busy = input(false);
  busyLabel = input('Excluindo…');
  error = input('');
  stackAboveModal = input(false);
  cancelled = output<void>();
  confirmed = output<void>();
}