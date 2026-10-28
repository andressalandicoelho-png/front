import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';
import { SecureMediaComponent } from './secure-media.component';

export interface ProgramPreviewItem {
  title: string;
  type: string;
  mediaId: number | null;
  linkUrl?: string | null;
  seconds: number;
  schedule?: string;
}

@Component({
  selector: 'app-program-preview',
  imports: [IconComponent, ModalComponent, SecureMediaComponent],
  template: `
    @if (open()) {
      <app-modal [title]="title()" (closed)="closed.emit()">
        <div class="program-preview-dialog">
          @if (current(); as item) {
            <div class="program-preview-screen" [attr.aria-label]="'Prévia do conteúdo: ' + item.title">
              @if (item.type === 'LINK') {
                @if (safeLinkUrl(); as url) {
                  <iframe [src]="url" [title]="'Prévia do link: ' + item.title" sandbox="allow-scripts allow-forms allow-presentation"></iframe>
                } @else {
                  <div class="program-preview-placeholder">
                    <app-icon name="link" [size]="36"/>
                    <span>Não foi possível pré-visualizar este endereço</span>
                  </div>
                }
                @if (item.linkUrl) { <a class="program-preview-link" [href]="item.linkUrl" target="_blank" rel="noopener noreferrer">Abrir link em outra aba</a> }
              } @else {
                <app-secure-media [mediaId]="item.mediaId" [type]="item.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'" [autoplay]="playing()"/>
              }
              <span class="program-preview-screen-caption">{{ item.title }}</span>
            </div>
            <div class="program-preview-controls">
              <button class="btn small" type="button" aria-label="Conteúdo anterior" [disabled]="items().length < 2" (click)="previous()">
                <app-icon name="left" [size]="16"/> Anterior
              </button>
              <span aria-live="polite">{{ currentIndex() + 1 }} de {{ items().length }}</span>
              <button class="btn small" type="button" [disabled]="items().length < 2" (click)="togglePlayback()">
                {{ playing() ? 'Desligar avanço automático' : 'Ativar avanço automático' }}
              </button>
              <button class="btn small" type="button" aria-label="Próximo conteúdo" [disabled]="items().length < 2" (click)="next()">
                Próximo <app-icon name="right" [size]="16"/>
              </button>
            </div>
            <div class="program-preview-details">
              <span><strong>{{ item.title }}</strong><small>{{ item.type === 'IMAGE' ? 'Imagem' : item.type === 'VIDEO' ? 'Vídeo' : 'Link' }} · {{ item.seconds }} s por exibição</small></span>
              @if (item.schedule) { <small>{{ item.schedule }}</small> }
            </div>
          }
          <div class="program-preview-sequence" role="list" aria-label="Ordem da sequência">
            @for (item of items(); track $index; let index = $index) {
              <button class="program-preview-item" type="button" role="listitem" [class.active]="index === currentIndex()" [attr.aria-current]="index === currentIndex() ? 'true' : null" (click)="currentIndex.set(index)">
                <span>{{ (index + 1).toString().padStart(2, '0') }}</span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.seconds }} s</small>
              </button>
            }
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ProgramPreviewComponent {
  title = input('Prévia para TV');
  items = input.required<ProgramPreviewItem[]>();
  open = input(false);
  closed = output<void>();
  currentIndex = signal(0);
  playing = signal(true);
  current = computed(() => this.items()[this.currentIndex()] ?? null);
  private sanitizer = inject(DomSanitizer);
  safeLinkUrl = computed<SafeResourceUrl | null>(() => {
    const linkUrl = this.current()?.linkUrl;
    if (!linkUrl) return null;
    try {
      const url = new URL(linkUrl);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? this.sanitizer.bypassSecurityTrustResourceUrl(url.toString())
        : null;
    } catch {
      return null;
    }
  });

  constructor() {
    effect(() => {
      this.items();
      this.currentIndex.set(0);
    });
    effect(onCleanup => {
      const item = this.current();
      if (!this.open() || !this.playing() || !item || this.items().length < 2) return;
      const timer = setTimeout(() => this.next(), Math.max(1, item.seconds) * 1000);
      onCleanup(() => clearTimeout(timer));
    });
  }

  next(): void {
    const count = this.items().length;
    if (count > 1) this.currentIndex.update(index => (index + 1) % count);
  }

  previous(): void {
    const count = this.items().length;
    if (count > 1) this.currentIndex.update(index => (index - 1 + count) % count);
  }

  togglePlayback(): void {
    this.playing.update(value => !value);
  }
}
