import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { SecureMediaComponent } from '../shared/secure-media.component';
import { MessageBandComponent } from '../shared/message-band.component';

export interface ProgramPreviewItem {
  title: string;
  type: string;
  content?: string | null;
  mediaId: number | null;
  linkUrl?: string | null;
  seconds: number;
  schedule?: string;
}

@Component({
  selector: 'app-program-preview',
  imports: [IconComponent, ModalComponent, SecureMediaComponent, MessageBandComponent],
  template: `
    @if (open()) {
      <app-modal [title]="title()" (closed)="closed.emit()">
        <div class="program-preview-dialog">
          <div class="program-preview-screen" [class.has-messages]="messages().length > 0" aria-label="Prévia da programação">
            <div class="program-preview-stage">
              @if (current(); as item) {
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
                  <app-secure-media [mediaId]="item.mediaId" [type]="mediaType(item.type)" [autoplay]="playing()" [fit]="'contain'"/>
                }
                <span class="program-preview-screen-caption">{{ item.title }}</span>
              } @else {
                <div class="program-preview-placeholder"><span>Sem conteúdos rotativos neste horário</span></div>
              }
            </div>
            @if (messages().length) {
              <app-message-band [messages]="messages()" [compact]="true"/>
            }
          </div>
          @if (current(); as item) {
            <div class="program-preview-controls">
              <button class="btn small" type="button" aria-label="Conteúdo anterior" [disabled]="rotatingItems().length < 2" (click)="previous()">
                <app-icon name="left" [size]="16"/> Anterior
              </button>
              <span aria-live="polite">{{ currentIndex() + 1 }} de {{ rotatingItems().length }}</span>
              <button class="btn small" type="button" [disabled]="rotatingItems().length < 2" (click)="togglePlayback()">
                @if (playing()) {
                  Desligar avanço automático
                } @else {
                  Ativar avanço automático
                }
              </button>
              <button class="btn small" type="button" aria-label="Próximo conteúdo" [disabled]="rotatingItems().length < 2" (click)="next()">
                Próximo <app-icon name="right" [size]="16"/>
              </button>
            </div>
            <div class="program-preview-details">
              <span>
                <strong>{{ item.title }}</strong>
                <small>
                  @if (item.type === 'IMAGE') {
                    Imagem
                  } @else if (item.type === 'VIDEO') {
                    Vídeo
                  } @else {
                    Link
                  }
                  · {{ item.seconds }} s por exibição
                </small>
              </span>
              @if (item.schedule) { <small>{{ item.schedule }}</small> }
            </div>
          }
          <div class="program-preview-sequence" role="list" aria-label="Ordem da sequência">
            @for (item of rotatingItems(); track $index; let index = $index) {
              <button class="program-preview-item" type="button" role="listitem" [class.active]="index === currentIndex()" [attr.aria-current]="index === currentIndex()" (click)="currentIndex.set(index)">
                <span>{{ (index + 1).toString().padStart(2, '0') }}</span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.seconds }} s</small>
              </button>
            }
          </div>
          @if (messages().length) {
            <div class="program-preview-fixed-messages"><strong>Mensagens na faixa inferior</strong>@for (message of messages(); track $index) { <span>{{ message.title }}</span> }</div>
          }
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
  rotatingItems = computed(() => this.items().filter(item => item.type !== 'MESSAGE'));
  messages = computed(() => this.items().filter(item => item.type === 'MESSAGE'));
  current = computed(() => this.rotatingItems()[this.currentIndex()] ?? null);
  private sanitizer = inject(DomSanitizer);
  safeLinkUrl = computed<SafeResourceUrl | null>(() => {
    const linkUrl = this.current()?.linkUrl;
    if (!linkUrl) return null;
    try {
      const url = new URL(linkUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return this.sanitizer.bypassSecurityTrustResourceUrl(url.toString());
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
      if (!this.open() || !this.playing() || !item || this.rotatingItems().length < 2) return;
      const timer = setTimeout(() => this.next(), Math.max(1, item.seconds) * 1000);
      onCleanup(() => clearTimeout(timer));
    });
  }

  next(): void {
    const count = this.rotatingItems().length;
    if (count > 1) this.currentIndex.update(index => (index + 1) % count);
  }

  previous(): void {
    const count = this.rotatingItems().length;
    if (count > 1) this.currentIndex.update(index => (index - 1 + count) % count);
  }

  togglePlayback(): void {
    this.playing.update(value => !value);
  }

  mediaType(type: string): 'VIDEO' | 'IMAGE' {
    if (type === 'VIDEO') return 'VIDEO';
    return 'IMAGE';
  }
}
