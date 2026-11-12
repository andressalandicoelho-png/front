import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'footer[app-pagination]',
  host: { '[attr.aria-label]': 'ariaLabel' },
  template: `
    <ng-content select="[paginationSummary]"/>
    <div class="actions">
      <button class="btn small" type="button" [disabled]="previousDisabled" (click)="previousPage.emit()">Anterior</button>
      <ng-content select="[paginationStatus]"/>
      <button class="btn small" type="button" [disabled]="nextDisabled" (click)="nextPage.emit()">Próxima</button>
    </div>
  `,
})
export class PaginationComponent {
  @Input() ariaLabel = 'Paginação';
  @Input() previousDisabled = false;
  @Input() nextDisabled = false;
  @Output() previousPage = new EventEmitter<void>();
  @Output() nextPage = new EventEmitter<void>();
}
