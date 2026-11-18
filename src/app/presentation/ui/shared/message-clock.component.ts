import { Component, OnDestroy, OnInit, input, signal } from '@angular/core';

const CLOCK_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const FULL_DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

@Component({
  selector: 'app-message-clock',
  host: {
    class: 'message-band-clock',
    'aria-label': 'Data e hora atuais em Brasília',
  },
  template: `
    <time class="message-band-time">{{ time() }}</time>
    <div class="message-band-date" [class.message-band-date--full]="fullDate()">
      @if (fullDate()) {
        <span class="message-band-full-date">{{ fullDateLabel() }}</span>
      } @else {
        <strong>{{ day() }}</strong>
        <span>{{ month() }}</span>
      }
    </div>
  `,
})
export class MessageClockComponent implements OnInit, OnDestroy {
  readonly fullDate = input(false);
  readonly day = signal('');
  readonly month = signal('');
  readonly time = signal('');
  readonly fullDateLabel = signal('');
  private clockTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
  }

  private updateClock(): void {
    const now = new Date();
    const parts = CLOCK_FORMAT.formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    this.day.set(value('day'));
    this.month.set(value('month').replace('.', '').toLocaleUpperCase('pt-BR'));
    this.time.set(`${value('hour')}:${value('minute')}`);
    const date = FULL_DATE_FORMAT.format(now);
    this.fullDateLabel.set(date.charAt(0).toLocaleUpperCase('pt-BR') + date.slice(1));
  }
}