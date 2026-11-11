import { Component, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { MediaRepository } from '@domain/media/media.repository';
import { PublicationType } from '@domain/publication/publication.entity';
import { IconComponent } from './icon.component';
import { generateVideoThumbnail } from './video-thumbnail';

/** Exibe mídia protegida (GET /media/:id exige token) baixando como blob. */
@Component({
  selector: 'app-secure-media',
  imports: [IconComponent],
  template: `
    @if (type() === 'VIDEO') {
      @if (autoplay()) {
        @if (url(); as src) {
          <video [src]="src" muted preload="metadata" playsinline autoplay></video>
        } @else {
          @if (thumbnail(); as poster) {
            <img [src]="poster" alt="Miniatura do vídeo">
          } @else {
            <div class="media-ph" [attr.title]="thumbnailError() || 'Miniatura do vídeo indisponível'"><app-icon name="video" [size]="28"/></div>
          }
        }
      } @else {
        @if (thumbnail(); as poster) {
          <img [src]="poster" alt="Miniatura do vídeo">
        } @else {
          <div class="media-ph" [attr.title]="thumbnailError() || 'Miniatura do vídeo indisponível'"><app-icon name="video" [size]="28"/></div>
        }
      }
    } @else {
      @if (url(); as src) {
        <img [src]="src" alt="">
      } @else if (type() === 'MESSAGE') {
        <div class="media-ph message-ph"><strong>MSG</strong></div>
      } @else {
        <div class="media-ph"><app-icon [name]="type() === 'LINK' ? 'link' : 'image'" [size]="28"/></div>
      }
    }`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    img, video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .media-ph { width: 100%; height: 100%; display: grid; place-items: center; background: #efefef; color: #a8a8a8; }
    .message-ph { color: #fff; background: #263f85; }
  `],
})
export class SecureMediaComponent implements OnDestroy {
  mediaId = input<number | null>(null);
  type = input<PublicationType>('IMAGE');
  autoplay = input(false);
  url = signal<string | null>(null);
  thumbnail = signal<string | null>(null);
  thumbnailError = signal<string | null>(null);

  private repo = inject(MediaRepository);
  private requestGeneration = 0;
  private objectUrl: string | null = null;

  constructor() {
    effect(onCleanup => {
      const generation = ++this.requestGeneration;
      const id = this.mediaId();
      const type = this.type();
      this.thumbnail.set(null);
      this.thumbnailError.set(null);
      this.setUrl(null);
      if (id === null || type === 'LINK' || type === 'MESSAGE') return;

      const sub = this.repo.blob(id).subscribe({
        next: blob => {
          if (generation !== this.requestGeneration) return;
          this.setUrl(URL.createObjectURL(blob));
          if (type === 'VIDEO') {
            void generateVideoThumbnail(blob).then(
              thumbnail => {
                if (generation === this.requestGeneration) this.thumbnail.set(thumbnail);
              },
              error => {
                if (generation === this.requestGeneration) {
                  this.thumbnailError.set(error instanceof Error ? error.message : 'Não foi possível gerar a miniatura do vídeo.');
                }
              },
            );
          }
        },
        error: () => {
          if (generation !== this.requestGeneration) return;
          this.thumbnailError.set('Não foi possível carregar a miniatura do vídeo.');
        },
      });
      onCleanup(() => {
        this.requestGeneration++;
        sub.unsubscribe();
      });
    });
  }

  private setUrl(next: string | null): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = next;
    this.url.set(next);
  }

  ngOnDestroy(): void {
    this.requestGeneration++;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
