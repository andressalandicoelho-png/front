import { Component, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { MediaRepository } from '@domain/media/media.repository';
import { PublicationType } from '@domain/publication/publication.entity';
import { IconComponent } from './icon.component';

/** Exibe mídia protegida (GET /media/:id exige token) baixando como blob. */
@Component({
  selector: 'app-secure-media',
  imports: [IconComponent],
  template: `
    @if (url(); as src) {
      @if (type() === 'VIDEO') { <video [src]="src" muted preload="metadata"></video> }
      @else { <img [src]="src" alt=""> }
    } @else {
      <div class="media-ph"><app-icon [name]="type() === 'LINK' ? 'link' : type() === 'VIDEO' ? 'video' : 'image'" [size]="28"/></div>
    }`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    img, video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .media-ph { width: 100%; height: 100%; display: grid; place-items: center; background: #efefef; color: #a8a8a8; }
  `],
})
export class SecureMediaComponent implements OnDestroy {
  mediaId = input<number | null>(null);
  type = input<PublicationType>('IMAGE');
  url = signal<string | null>(null);

  private repo = inject(MediaRepository);

  constructor() {
    effect(onCleanup => {
      const id = this.mediaId();
      if (id === null || this.type() === 'LINK') { this.url.set(null); return; }
      const sub = this.repo.blob(id).subscribe({
        next: blob => this.setUrl(URL.createObjectURL(blob)),
        error: () => this.setUrl(null),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  private setUrl(next: string | null): void {
    const prev = this.url();
    if (prev) URL.revokeObjectURL(prev);
    this.url.set(next);
  }

  ngOnDestroy(): void {
    const prev = this.url();
    if (prev) URL.revokeObjectURL(prev);
  }
}
