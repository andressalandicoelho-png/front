import { Component, input } from '@angular/core';
import { PublicationType } from '@domain/publication/publication.entity';
import { SecureMediaComponent } from './secure-media.component';

@Component({
  selector: 'app-content-preview',
  imports: [SecureMediaComponent],
  template: `
    @if (type() === 'MESSAGE') {
      <p class="content-preview-message">{{ content() }}</p>
    } @else if (type() === 'LINK') {
      @if (linkUrl()) {
        <a class="content-preview-link" [href]="linkUrl()" target="_blank" rel="noopener noreferrer">{{ linkUrl() }}</a>
      } @else {
        <p class="muted">Endereço não disponível.</p>
      }
    } @else {
      <div class="content-preview-media">
        <app-secure-media [mediaId]="mediaId()" [type]="mediaType()" [autoplay]="autoplay()" [fit]="'contain'"/>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .content-preview-media { width: 100%; max-width: 960px; aspect-ratio: 16 / 9; max-height: min(55dvh, 560px); min-height: 160px; overflow: hidden; border: 1px solid var(--border-soft); border-radius: var(--radius-control); background: #000; }
    .content-preview-message { max-height: 65dvh; overflow: auto; margin: 0; padding: 16px; border: 1px solid var(--border-soft); border-radius: var(--radius-control); color: #fff; background: #263f85; font-size: 15px; line-height: 1.55; white-space: pre-wrap; }
    .content-preview-link { display: block; overflow-wrap: anywhere; color: #285dcc; font-size: 14px; }
  `],
})
export class ContentPreviewComponent {
  type = input.required<PublicationType>();
  content = input<string | null>(null);
  mediaId = input<number | null>(null);
  linkUrl = input<string | null>(null);
  autoplay = input(false);

  mediaType(): PublicationType {
    if (this.type() === 'VIDEO') return 'VIDEO';
    return 'IMAGE';
  }
}