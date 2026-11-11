import { Component, OnDestroy, OnInit, computed, effect, input, signal } from '@angular/core';

const MESSAGE_ROTATION_MS = 60_000;
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';
const CLOCK_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface MessageBandItem {
  key?: string;
  title: string;
  content?: string | null;
}

@Component({
  selector: 'app-message-band',
  template: `
    <aside class="message-band" [class.compact]="compact()" aria-label="Mensagem do player">
      <div class="message-band-clock" aria-label="Data e hora atuais em Brasília">
        <time class="message-band-time">{{ time() }}</time>
        <div class="message-band-date">
          <strong>{{ day() }}</strong>
          <span>{{ month() }}</span>
        </div>
      </div>
      @if (currentMessage(); as message) {
        <article class="message-band-text" aria-live="polite">
          <strong class="message-band-title">{{ message.title }}</strong>
          <p>{{ message.content }}</p>
        </article>
      }
    </aside>
  `,
})
export class MessageBandComponent implements OnInit, OnDestroy {
  messages = input<MessageBandItem[]>([]);
  compact = input(false);

  currentIndex = signal(0);
  day = signal('');
  month = signal('');
  time = signal('');
  currentMessage = computed(() => this.messages()[this.currentIndex()] ?? null);

  private messageSignature = '';
  private rotationTimer?: ReturnType<typeof setTimeout>;
  private clockTimer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const signature = JSON.stringify(this.messages().map((message, index) => message.key ?? `${index}:${message.title}`));
      if (signature === this.messageSignature) return;
      this.messageSignature = signature;
      this.currentIndex.set(0);
      this.scheduleRotation();
    });
  }

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1_000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.rotationTimer);
    clearInterval(this.clockTimer);
  }

  private scheduleRotation(): void {
    clearTimeout(this.rotationTimer);
    if (this.messages().length < 2) return;
    this.rotationTimer = setTimeout(() => {
      const count = this.messages().length;
      if (count < 2) return;
      this.currentIndex.update(index => (index + 1) % count);
      this.scheduleRotation();
    }, MESSAGE_ROTATION_MS);
  }

  private updateClock(): void {
    const parts = CLOCK_FORMAT.formatToParts(new Date());
    const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    this.day.set(value('day'));
    this.month.set(value('month').replace('.', '').toLocaleUpperCase('pt-BR'));
    this.time.set(`${value('hour')}:${value('minute')}`);
  }
}
