import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ListChannelsUseCase } from '@application/channel/channel.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import {
  CreateScheduleEntryUseCase, DeleteScheduleEntryUseCase, ListScheduleUseCase, UpdateScheduleEntryUseCase,
} from '@application/schedule/schedule.usecases';
import { Channel } from '@domain/channel/channel.entity';
import { Publication } from '@domain/publication/publication.entity';
import { monthGrid } from '@domain/schedule/calendar';
import { NewScheduleEntry, ScheduleEntry } from '@domain/schedule/schedule.entity';
import { toIsoDate } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@infra/http/auth.interceptor';
import { ToastService } from '@presentation/core/toast.service';
import { longDate, monthTitle } from '@presentation/core/format';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';

interface EntryForm { channelId: number | null; publicationId: number | null; startTime: string; endTime: string; turnSeconds: number | null; }

const businessDate = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

@Component({
  selector: 'app-calendar',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Calendário</h1><p class="muted">Planeje o que vai ao ar, dia a dia.</p></div>
      <select class="input slim" [ngModel]="channelFilter()" (ngModelChange)="channelFilter.set($event)" aria-label="Filtrar por canal">
        <option [ngValue]="null">Todos os canais</option>
        @for (c of channels(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
      </select>
    </header>

    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" type="button" (click)="move(-1)" aria-label="Mês anterior"><app-icon name="left" [size]="22"/></button>
        <strong>{{ title() }}</strong>
        <button class="icon-btn" type="button" (click)="move(1)" aria-label="Próximo mês"><app-icon name="right" [size]="22"/></button>
      </div>
      <div class="cal-grid weekdays">@for (w of weekdays; track w) { <span>{{ w }}</span> }</div>
      <div class="cal-grid">
        @for (d of grid(); track d.date) {
          <button type="button" class="day" [class.out]="!d.inMonth" [class.today]="d.date === today" [class.sel]="d.date === selected()"
                  (click)="select(d.date)">
            <span class="num">{{ d.day }}</span>
            @if (countOf(d.date); as n) { <span class="dots">@for (i of dots(n); track i) { <i></i> }</span> }
          </button>
        }
      </div>
    </section>

    @if (selected(); as day) {
      <app-modal [title]="dayLabel()" (closed)="selected.set(null)">
        @for (e of dayEntries(); track e.id) {
          <div class="row">
            <div class="grow">
              <div class="title">{{ titleOf(e) }}</div>
              <div class="muted">{{ e.startTime }}–{{ e.endTime }} · {{ channelName(e.channelId) }}@if (e.turnSeconds) { · {{ e.turnSeconds }}s por turno }</div>
            </div>
            <button class="icon-btn" type="button" aria-label="Editar" (click)="edit(e)"><app-icon name="edit" [size]="20"/></button>
            <button class="icon-btn danger" type="button" aria-label="Remover" (click)="remove(e)"><app-icon name="trash" [size]="20"/></button>
          </div>
        } @empty {
          <p class="muted">Nenhuma publicação neste dia.</p>
        }

        <form class="stack" (ngSubmit)="save(day)">
          <strong>{{ editing() ? 'Editar agendamento' : 'Adicionar ao dia' }}</strong>
          @if (isPast(day)) { <p class="muted">Não é possível adicionar programação para uma data passada.</p> }
          <select class="input" name="channel" [(ngModel)]="form.channelId" [disabled]="!!editing()">
            <option [ngValue]="null" disabled>Canal</option>
            @for (c of channels(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select>
          <select class="input" name="pub" [(ngModel)]="form.publicationId" [disabled]="!!editing()">
            <option [ngValue]="null" disabled>Publicação</option>
            @for (p of pubs(); track p.id) { <option [ngValue]="p.id">{{ p.title }}</option> }
          </select>
          <div class="grid-2">
            <label class="field">Início<input class="input" type="time" name="start" [(ngModel)]="form.startTime"></label>
            <label class="field">Fim<input class="input" type="time" name="end" [(ngModel)]="form.endTime"></label>
          </div>
          <label class="field">Segundos por turno (opcional)
            <input class="input" type="number" min="1" max="3600" name="turn" [(ngModel)]="form.turnSeconds" placeholder="Usa a duração da publicação">
          </label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="actions">
            @if (editing()) { <button class="btn" type="button" (click)="resetForm()">Cancelar</button> }
            <button class="btn primary" type="submit" [disabled]="isPast(day)">{{ editing() ? 'Salvar alterações' : 'Adicionar' }}</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class CalendarPage implements OnInit {
  private channelsUC = inject(ListChannelsUseCase);
  private pubsUC = inject(ListPublicationsUseCase);
  private listUC = inject(ListScheduleUseCase);
  private createUC = inject(CreateScheduleEntryUseCase);
  private updateUC = inject(UpdateScheduleEntryUseCase);
  private deleteUC = inject(DeleteScheduleEntryUseCase);
  private toast = inject(ToastService);

  weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  today = businessDate();
  cursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  selected = signal<string | null>(null);
  channelFilter = signal<number | null>(null);
  channels = signal<Channel[]>([]);
  pubs = signal<Publication[]>([]);
  entries = signal<ScheduleEntry[]>([]);
  editing = signal<ScheduleEntry | null>(null);
  error = signal('');
  form: EntryForm = this.emptyForm();

  grid = computed(() => monthGrid(this.cursor().getFullYear(), this.cursor().getMonth()));
  title = computed(() => monthTitle(this.cursor()));
  filtered = computed(() => this.entries().filter(e => this.channelFilter() === null || e.channelId === this.channelFilter()));
  byDate = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.filtered()) map.set(e.date, (map.get(e.date) ?? 0) + 1);
    return map;
  });
  dayEntries = computed(() =>
    this.filtered().filter(e => e.date === this.selected()).sort((a, b) => a.startTime.localeCompare(b.startTime)));
  dayLabel = computed(() => (this.selected() ? longDate(this.selected()!) : ''));

  ngOnInit(): void {
    forkJoin({ channels: this.channelsUC.execute(), pubs: this.pubsUC.execute() }).subscribe(({ channels, pubs }) => {
      this.channels.set(channels);
      this.pubs.set(pubs);
    });
    this.load();
  }

  load(): void {
    const g = this.grid();
    this.listUC.execute({ from: g[0].date, to: g[g.length - 1].date }).subscribe(list => this.entries.set(list));
  }

  move(delta: number): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + delta, 1));
    this.load();
  }

  select(date: string): void { this.selected.set(date); this.resetForm(); }
  countOf = (date: string) => this.byDate().get(date) ?? 0;
  dots = (n: number) => Array.from({ length: Math.min(n, 3) }, (_, i) => i);
  channelName = (id: number) => this.channels().find(c => c.id === id)?.name ?? `Canal ${id}`;
  titleOf = (e: ScheduleEntry) => e.publicationTitle ?? this.pubs().find(p => p.id === e.publicationId)?.title ?? `Publicação ${e.publicationId}`;
  isPast = (date: string) => date < this.today;

  private emptyForm(): EntryForm {
    return { channelId: this.channelFilter() ?? null, publicationId: null, startTime: '08:00', endTime: '18:00', turnSeconds: null };
  }

  resetForm(): void {
    this.editing.set(null);
    this.error.set('');
    this.form = { ...this.emptyForm(), channelId: this.channelFilter() ?? this.channels()[0]?.id ?? null };
  }

  edit(e: ScheduleEntry): void {
    this.editing.set(e);
    this.form = { channelId: e.channelId, publicationId: e.publicationId, startTime: e.startTime, endTime: e.endTime, turnSeconds: e.turnSeconds };
  }

  save(date: string): void {
    this.error.set('');
    if (date < businessDate()) {
      this.error.set('Não é possível programar para uma data passada.');
      return;
    }
    const turn = this.form.turnSeconds ?? undefined;
    const current = this.editing();
    const request = current
      ? this.updateUC.execute(current.id, { date, startTime: this.form.startTime, endTime: this.form.endTime, turnSeconds: turn })
      : this.createUC.execute({
          channelId: this.form.channelId!, publicationId: this.form.publicationId!, date,
          startTime: this.form.startTime, endTime: this.form.endTime, turnSeconds: turn,
        } as NewScheduleEntry);
    request.subscribe({
      next: () => { this.toast.show(current ? 'Agendamento atualizado' : 'Agendamento adicionado'); this.resetForm(); this.load(); },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  remove(e: ScheduleEntry): void {
    if (!confirm('Remover este agendamento?')) return;
    this.deleteUC.execute(e.id).subscribe({
      next: () => { this.toast.show('Agendamento removido'); this.load(); },
      error: err => this.toast.show(errorMessage(err)),
    });
  }
}
