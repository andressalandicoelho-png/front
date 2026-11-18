import { AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { MessageClockComponent } from './message-clock.component';

const MESSAGE_ROTATION_MS = 60_000;
const MESSAGE_ROTATION_BUFFER_MS = 3_000;
const MESSAGE_MARQUEE_READ_CHARACTERS_PER_MINUTE = 600;
export interface MessageBandItem {
  key?: string;
  title: string;
  content?: string | null;
}

@Component({
  selector: 'app-message-band',
  imports: [MessageClockComponent],
  host: { '[class.clock-only]': 'clockOnly()' },
  template: `
    <aside class="message-band" [class.compact]="compact()" [class.clock-only]="clockOnly()"
      [attr.aria-label]="ariaLabel()">
      <app-message-clock [fullDate]="fullDate()"/>
      <div class="message-band-copy" aria-live="polite">
        @for (message of visibleMessages(); track message.key ?? currentIndex()) {
          <article class="message-band-text" [attr.data-message-key]="message.key ?? currentIndex()" animate.enter="message-band-item-enter" animate.leave="message-band-item-leave">
            <span class="message-band-transition-badge" aria-hidden="true">NOVA MENSAGEM</span>
            <strong class="message-band-title">{{ message.title }}</strong>
            <p [class.message-band-marquee]="scrollMessage()" [style.--message-marquee-duration]="marqueeDuration()">
              @if (scrollMessage()) {
                <span class="message-band-marquee-track" aria-hidden="true">
                  <span>{{ message.content }}</span>
                  <span>{{ message.content }}</span>
                </span>
              }
              <span class="message-band-marquee-static">{{ message.content }}</span>
              <span class="message-band-measure" aria-hidden="true">{{ message.content }}</span>
            </p>
          </article>
        }
      </div>
    </aside>
  `,
})
export class MessageBandComponent implements AfterViewInit, OnDestroy {
  messages = input<MessageBandItem[]>([]);
  compact = input(false);
  clockOnly = input(false);
  fullDate = input(false);

  scrollMessage = signal(false);
  marqueeDuration = signal('24s');
  currentIndex = signal(0);
  currentMessage = computed(() => this.messages()[this.currentIndex()] ?? null);
  visibleMessages = computed(() => {
    const message = this.currentMessage();
    if (message) return [message];
    return [];
  });
  ariaLabel(): string {
    if (this.clockOnly()) return 'Data e hora atuais';
    return 'Mensagens do player';
  }

  private messageSignature = '';
  private rotationTimer?: ReturnType<typeof setTimeout>;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private resizeObserver?: ResizeObserver;
  private measurementFrame?: number;

  constructor() {
    effect(() => {
      const signature = JSON.stringify(this.messages().map((message, index) => message.key ?? `${index}:${message.title}`));
      if (signature === this.messageSignature) return;
      this.messageSignature = signature;
      this.currentIndex.set(0);
      this.scheduleRotation();
    });
    effect(() => {
      this.currentMessage();
      this.compact();
      this.scheduleMarqueeMeasurement();
    });
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMarqueeMeasurement());
      this.resizeObserver.observe(this.host.nativeElement);
    }
    this.scheduleMarqueeMeasurement();
  }

  ngOnDestroy(): void {
    clearTimeout(this.rotationTimer);
    this.resizeObserver?.disconnect();
    if (this.measurementFrame !== undefined) cancelAnimationFrame(this.measurementFrame);
  }

  private scheduleMarqueeMeasurement(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    if (this.measurementFrame !== undefined) cancelAnimationFrame(this.measurementFrame);
    this.measurementFrame = requestAnimationFrame(() => {
      this.measurementFrame = undefined;
      this.updateMarqueeState();
    });
  }

  private updateMarqueeState(): void {
    const message = this.currentMessage();
    if (!message?.content) {
      this.scrollMessage.set(false);
      return;
    }

    const messageKey = String(message.key ?? this.currentIndex());
    const article = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.message-band-text[data-message-key]'))
      .find(element => element.dataset['messageKey'] === messageKey);
    const paragraph = article?.querySelector<HTMLElement>('.message-band-text > p');
    const measure = paragraph?.querySelector<HTMLElement>('.message-band-measure');
    if (!paragraph || !measure) return;

    const textWidth = measure.getBoundingClientRect().width;
    const overflows = textWidth > paragraph.clientWidth + 2;
    this.scrollMessage.set(overflows);
    if (overflows) {
      const pixelsPerCharacter = textWidth / message.content.length;
      const readableCharactersPerSecond = MESSAGE_MARQUEE_READ_CHARACTERS_PER_MINUTE / 60;
      const durationSeconds = (textWidth + 72) / (pixelsPerCharacter * readableCharactersPerSecond);
      this.marqueeDuration.set(`${durationSeconds}s`);
    }
  }

  private scheduleRotation(): void {
    clearTimeout(this.rotationTimer);
    if (this.messages().length < 2) return;
    const contentLength = this.currentMessage()?.content?.length ?? 0;
    const readingTimeMs = (contentLength / MESSAGE_MARQUEE_READ_CHARACTERS_PER_MINUTE) * 60_000;
    const rotationDelay = Math.max(MESSAGE_ROTATION_MS, readingTimeMs + MESSAGE_ROTATION_BUFFER_MS);
    this.rotationTimer = setTimeout(() => {
      const count = this.messages().length;
      if (count < 2) return;
      this.currentIndex.update(index => (index + 1) % count);
      this.scheduleRotation();
    }, rotationDelay);
  }
}
