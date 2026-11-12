import { Component, Input } from '@angular/core';

@Component({
  selector: 'header[app-page-header]',
  template: `
    <div class="page-head-content">
      @if (eyebrow) { <span class="eyebrow">{{ eyebrow }}</span> }
      <h1>{{ title }}</h1>
      @if (description) { <p class="muted">{{ description }}</p> }
    </div>
    <ng-content />
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() eyebrow = '';
}
