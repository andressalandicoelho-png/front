import { Component, Input } from '@angular/core';
import type { PublicationType } from '@domain/publication/publication.entity';
import { IconComponent } from '@presentation/ui/icon.component';

export interface CalendarReviewRow {
  id: number;
  title: string;
  type: PublicationType;
  status: string;
  scheduleSummary: string;
}

@Component({
  selector: 'app-calendar-review-table',
  imports: [IconComponent],
  template: `
    <div class="calendar-review-table">
      <div class="calendar-review-table-head"><span>Arquivo de mídia</span><span>Status</span><span>{{ lastColumnHeading }}</span></div>
      <div class="calendar-review-list" role="list" aria-label="Mídias prontas para agendamento">
        @for (row of rows; track row.id) {
          <div class="calendar-review-row" role="listitem">
            <span class="calendar-review-file">
              <span class="calendar-review-file-icon"><app-icon [name]="row.type === 'IMAGE' ? 'image' : row.type === 'VIDEO' ? 'video' : 'document'" [size]="14"/></span>
              <strong>{{ row.title }}</strong>
            </span>
            <span class="calendar-review-status">{{ row.status }}</span>
            <small>{{ row.scheduleSummary }}</small>
          </div>
        } @empty {
          <p class="calendar-review-empty">{{ emptyMessage }}</p>
        }
      </div>
    </div>
  `,
})
export class CalendarReviewTableComponent {
  @Input() rows: readonly CalendarReviewRow[] = [];
  @Input() lastColumnHeading = 'Agendamentos';
  @Input() emptyMessage = '';
}
