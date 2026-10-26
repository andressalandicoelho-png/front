import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ListChannelsUseCase } from '@application/channel/channel.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { ListScheduleUseCase } from '@application/schedule/schedule.usecases';
import { Channel } from '@domain/channel/channel.entity';
import { DEFAULT_DISPLAY_SECONDS, Publication } from '@domain/publication/publication.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { buildQueue, loopSeconds, toIsoDate, toTime } from '@domain/schedule/schedule.rules';
import { AuthState } from '@presentation/core/auth.state';
import { addDays, duration, greeting, shortDate } from '@presentation/core/format';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, SecureMediaComponent],
  template: `
    <header class="page-head">
      <h1>{{ greeting }}, {{ firstName() }}</h1>
      <p class="muted">Veja o que está no ar e o que vem por aí.</p>
    </header>

    <section class="stories" aria-label="Canais">
      @for (c of channels(); track c.id) {
        <button type="button" class="story" [class.on]="selected() === c.id" (click)="selected.set(c.id)">
          <span class="ring" [class.off]="!c.active"><span class="ring-in">{{ initials(c.name) }}</span></span>
          <span class="story-name">{{ c.name }}</span>
        </button>
      } @empty {
        <p class="muted">Nenhum canal ainda. <a routerLink="/canais">Criar canal</a></p>
      }
    </section>

    <section class="card">
      <div class="card-head">
        <strong>No ar agora</strong>
        @if (queue().length) { <span class="muted">Ciclo de {{ cycle() }}</span> }
      </div>
      @for (q of queue(); track q.entry.id) {
        <div class="row">
          <div class="thumb"><app-secure-media [mediaId]="q.pub?.mediaId ?? null" [type]="q.pub?.type ?? 'IMAGE'"/></div>
          <div class="grow">
            <div class="title">{{ q.title }}</div>
            <div class="muted">{{ q.entry.startTime }}–{{ q.entry.endTime }}</div>
          </div>
          <span class="chip">{{ q.seconds }}s</span>
        </div>
      } @empty {
        <div class="empty"><p>Nada programado para agora neste canal.</p><a class="btn" routerLink="/calendario">Abrir calendário</a></div>
      }
    </section>

    <section class="card">
      <div class="card-head"><strong>Próximos agendamentos</strong><a routerLink="/calendario" class="link">Ver calendário</a></div>
      @for (e of upcoming(); track e.id) {
        <div class="row">
          <div class="date-badge"><strong>{{ short(e.date) }}</strong></div>
          <div class="grow">
            <div class="title">{{ titleOf(e) }}</div>
            <div class="muted">{{ e.startTime }}–{{ e.endTime }} · {{ channelName(e.channelId) }}</div>
          </div>
        </div>
      } @empty {
        <div class="empty"><p>Sem agendamentos nos próximos 90 dias.</p></div>
      }
    </section>
  `,
})
export class DashboardPage implements OnInit, OnDestroy {
  private channelsUC = inject(ListChannelsUseCase);
  private scheduleUC = inject(ListScheduleUseCase);
  private pubsUC = inject(ListPublicationsUseCase);
  private auth = inject(AuthState);

  greeting = greeting();
  channels = signal<Channel[]>([]);
  selected = signal<number | null>(null);
  entries = signal<ScheduleEntry[]>([]);
  pubs = signal<Publication[]>([]);
  now = signal(new Date());
  private timer?: ReturnType<typeof setInterval>;

  firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);
  pubById = computed(() => new Map(this.pubs().map(p => [p.id, p])));

  queue = computed(() => {
    const now = this.now();
    const today = toIsoDate(now);
    const items = this.entries().filter(e => e.channelId === this.selected() && e.date === today);
    return buildQueue(items, now).map(entry => {
      const pub = this.pubById().get(entry.publicationId);
      return {
        entry, pub,
        title: entry.publicationTitle ?? pub?.title ?? `Publicação ${entry.publicationId}`,
        seconds: entry.turnSeconds ?? pub?.displaySeconds ?? DEFAULT_DISPLAY_SECONDS,
      };
    });
  });

  cycle = computed(() => duration(loopSeconds(this.queue().map(q => q.seconds))));

  upcoming = computed(() => {
    const now = this.now();
    const today = toIsoDate(now);
    const time = toTime(now);
    return this.entries()
      .filter(e => e.date > today || (e.date === today && e.endTime > time))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      .slice(0, 6);
  });

  ngOnInit(): void {
    const today = toIsoDate(new Date());
    forkJoin({
      channels: this.channelsUC.execute(),
      entries: this.scheduleUC.execute({ from: today, to: addDays(today, 90) }),
      pubs: this.pubsUC.execute(),
    }).subscribe(({ channels, entries, pubs }) => {
      this.channels.set(channels);
      this.entries.set(entries);
      this.pubs.set(pubs);
      this.selected.set(channels[0]?.id ?? null);
    });
    this.timer = setInterval(() => this.now.set(new Date()), 30_000);
  }

  ngOnDestroy(): void { clearInterval(this.timer); }

  initials = (name: string) => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  short = shortDate;
  channelName = (id: number) => this.channels().find(c => c.id === id)?.name ?? `Canal ${id}`;
  titleOf = (e: ScheduleEntry) => e.publicationTitle ?? this.pubById().get(e.publicationId)?.title ?? `Publicação ${e.publicationId}`;
}
