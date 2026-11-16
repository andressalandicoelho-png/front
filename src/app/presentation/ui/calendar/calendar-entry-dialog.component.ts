import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Publication } from '@domain/publication/publication.entity';
import { Program } from '@domain/program/program.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { DatePickerComponent } from '../shared/date-picker.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';

export interface CalendarEntryForm {
  publicationId: number | null;
  programId: number | null;
  endDate: string;
  startTime: string;
  endTime: string;
  turnSeconds: number | null;
}

type FormField = keyof CalendarEntryForm;

@Component({
  selector: 'app-calendar-entry-dialog',
  imports: [FormsModule, DatePickerComponent, IconComponent, ModalComponent],
  template: `
    <app-modal class="calendar-modal" [title]="dateLabel()" (closed)="closed.emit()">
      @for (entry of entries(); track entry.id) {
        <div class="row">
          <div class="grow">
            <div class="title">{{ titleFor()(entry) }}</div>
            <div class="muted">{{ programNameFor()(entry.programId) }} · {{ entry.startTime }}–{{ entry.endTime }}@if (entry.turnSeconds) { · {{ entry.turnSeconds }}s }</div>
          </div>
          <button class="icon-btn" type="button" aria-label="Editar" (click)="editRequested.emit(entry)"><app-icon name="edit" [size]="20"/></button>
          <button class="icon-btn danger" type="button" aria-label="Remover" (click)="removeRequested.emit(entry)"><app-icon name="trash" [size]="20"/></button>
        </div>
      } @empty {
        <p class="muted">Nenhuma publicação neste dia.</p>
      }

      <form class="stack" (ngSubmit)="saveRequested.emit()">
        <strong>
          @if (editing()) {
            Editar agendamento
          } @else if (reviewing()) {
            Revisar agendamento
          } @else {
            Adicionar ao dia
          }
        </strong>
        @if (reviewing()) {
          <div class="program-review">
            <p class="muted">Confira o conteúdo e o período antes de confirmar.</p>
            <div class="program-review-heading">
              <strong>{{ publicationTitle()(form().publicationId) }}</strong>
              <span>{{ programNameFor()(form().programId) }}</span>
            </div>
            <p class="program-review-period">
              {{ formatDate()(date()) }}
              @if (form().endDate !== date()) { a {{ formatDate()(form().endDate) }} }
              · {{ form().startTime }}–{{ form().endTime }}
            </p>
            <div class="actions">
              <button class="btn" type="button" (click)="reviewBackRequested.emit()">Voltar e ajustar</button>
              <button class="btn primary" type="submit" [disabled]="past()">Confirmar agendamento</button>
            </div>
          </div>
        } @else {
          @if (past()) { <p class="muted">Esta data já passou.</p> }
          <label class="field">Programação
            <select class="input" name="editProgram" [ngModel]="form().programId" (ngModelChange)="updateForm('programId', $event)" required>
              <option [ngValue]="null" disabled>Escolha uma programação</option>
              @for (program of programs(); track program.id) { <option [ngValue]="program.id">{{ program.name }}</option> }
            </select>
          </label>
          <select class="input" name="pub" [ngModel]="form().publicationId" (ngModelChange)="updateForm('publicationId', $event)" [disabled]="!!editing()">
            <option [ngValue]="null" disabled>Conteúdo publicado</option>
            @for (publication of readyPublications(); track publication.id) { <option [ngValue]="publication.id">{{ publication.title }}</option> }
          </select>
          @if (!editing()) {
            <label class="field">Repetir até (inclusive)
              <app-date-picker name="scheduleEndDate" [min]="date()" [ngModel]="form().endDate" (ngModelChange)="updateForm('endDate', $event)" required/>
            </label>
          }
          <div class="grid-2">
            <label class="field">Início<input class="input" type="time" name="start" [ngModel]="form().startTime" (ngModelChange)="updateForm('startTime', $event)"></label>
            <label class="field">Fim<input class="input" type="time" name="end" [ngModel]="form().endTime" (ngModelChange)="updateForm('endTime', $event)"></label>
          </div>
          @if (publicationOf()(form().publicationId ?? 0)?.type === 'MESSAGE') {
            <p class="muted">A mensagem ficará fixa na faixa inferior durante todo o horário agendado.</p>
          } @else {
            <label class="field">Duração planejada (segundos, opcional)
              <input class="input" type="number" min="1" max="3600" name="turn" [ngModel]="form().turnSeconds" (ngModelChange)="updateForm('turnSeconds', $event)" placeholder="Usa a duração do conteúdo">
            </label>
          }
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="actions">
            @if (editing()) { <button class="btn" type="button" (click)="resetRequested.emit()">Cancelar</button> }
            <button class="btn primary" type="submit" [disabled]="past()">
              @if (editing()) { Salvar alterações } @else { Revisar agendamento }
            </button>
          </div>
        }
      </form>
    </app-modal>
  `,
})
export class CalendarEntryDialogComponent {
  readonly date = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly entries = input.required<ScheduleEntry[]>();
  readonly programs = input.required<Program[]>();
  readonly readyPublications = input.required<Publication[]>();
  readonly form = input.required<CalendarEntryForm>();
  readonly editing = input<ScheduleEntry | null>(null);
  readonly reviewing = input(false);
  readonly past = input(false);
  readonly error = input('');
  readonly titleFor = input.required<(entry: ScheduleEntry) => string>();
  readonly programNameFor = input.required<(programId: number | null) => string>();
  readonly publicationTitle = input.required<(publicationId: number | null) => string>();
  readonly publicationOf = input.required<(publicationId: number) => Publication | undefined>();
  readonly formatDate = input.required<(date: string) => string>();
  readonly closed = output<void>();
  readonly editRequested = output<ScheduleEntry>();
  readonly removeRequested = output<ScheduleEntry>();
  readonly formChanged = output<CalendarEntryForm>();
  readonly reviewBackRequested = output<void>();
  readonly resetRequested = output<void>();
  readonly saveRequested = output<void>();

  updateForm<K extends FormField>(field: K, value: CalendarEntryForm[K]): void {
    this.formChanged.emit({ ...this.form(), [field]: value });
  }
}
