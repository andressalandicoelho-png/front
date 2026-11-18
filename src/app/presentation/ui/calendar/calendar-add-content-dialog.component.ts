import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Program } from '@domain/program/program.entity';
import { NewScheduleEntry, ScheduleEntry } from '@domain/schedule/schedule.entity';
import { Publication } from '@domain/publication/publication.entity';
import {
  datesBetweenInclusive, fullyScheduledPublicationIds, missingScheduleEntries, overlappingScheduleEntries, toMinutes,
} from '@domain/schedule/schedule.rules';
import { formatDate } from '@presentation/core/format';
import { publicationTypeName } from '@presentation/formatters/publication-type-name';
import { CalendarReviewRow, CalendarReviewTableComponent } from './calendar-review-table.component';
import { DatePickerComponent } from '../shared/date-picker.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { PublicationSelectionItemComponent } from '../publication/publication-selection-item.component';

interface ScheduleConflict {
  publicationId: number;
  programId: number;
  programName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CalendarReviewItem extends CalendarReviewRow {
  scheduledSlots: number;
}

@Component({
  selector: 'app-calendar-add-content-dialog',
  imports: [
    FormsModule,
    RouterLink,
    CalendarReviewTableComponent,
    DatePickerComponent,
    IconComponent,
    ModalComponent,
    PublicationSelectionItemComponent,
  ],
  templateUrl: './calendar-add-content-dialog.component.html',
})
export class CalendarAddContentDialogComponent implements OnChanges {
  readonly date = input.required<string>();
  readonly today = input.required<string>();
  readonly programs = input.required<Program[]>();
  readonly programsById = input.required<ReadonlyMap<number, string>>();
  readonly publicationsById = input.required<ReadonlyMap<number, Publication>>();
  readonly entries = input.required<ScheduleEntry[]>();
  readonly busy = input(false);
  readonly failureMessage = input('');
  readonly progress = input({ completed: 0, total: 0 });
  readonly closed = output<void>();
  readonly scheduleRequested = output<NewScheduleEntry[]>();

  readonly formatDate = formatDate;
  readonly typeName = publicationTypeName;
  readonly selectedContentIds = signal<number[]>([]);
  readonly selectedProgramIds = signal<number[]>([]);
  readonly search = signal('');
  readonly typeFilter = signal<'ALL' | Publication['type']>('ALL');
  readonly startTime = signal('08:00');
  readonly endTime = signal('18:00');
  readonly endDate = signal('');
  readonly reviewing = signal(false);
  readonly validationError = signal('');
  readonly dialogTitle = computed(() => {
    if (this.reviewing()) return 'Adicionar Conteúdos';
    return 'Adicionar conteúdos';
  });
  readonly dialogSubtitle = computed(() => {
    if (this.reviewing()) return 'Revise o agendamento';
    return '';
  });

  readonly dates = computed(() => datesBetweenInclusive(this.date(), this.endDate()));
  readonly selectedProgramNames = computed(() => this.selectedProgramIds()
    .map(id => this.programsById().get(id))
    .filter((name): name is string => !!name)
    .join(', '));
  readonly pickerPublications = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const type = this.typeFilter();
    return [...this.publicationsById().values()].filter(publication =>
      publication.status === 'READY' &&
      (!query || publication.title.toLocaleLowerCase().includes(query)) &&
      (type === 'ALL' || publication.type === type),
    );
  });
  readonly alreadyScheduled = computed(() => fullyScheduledPublicationIds(
    this.selectedContentIds(), this.selectedProgramIds(), this.dates(), this.entries(), this.startTime(), this.endTime(),
  ));
  readonly selectedNewContentCount = computed(() => this.selectedContentIds()
    .filter(id => !this.alreadyScheduled().has(id)).length);
  readonly selectedContentSummary = computed(() => [...this.publicationsById().values()]
    .filter(publication => this.selectedContentIds().includes(publication.id) && !this.alreadyScheduled().has(publication.id))
    .map(publication => publication.title).join(' · '));
  readonly calendarReviewItems = computed<CalendarReviewItem[]>(() =>
    [...this.publicationsById().values()]
      .filter(publication => this.selectedContentIds().includes(publication.id) && !this.alreadyScheduled().has(publication.id))
      .map(publication => {
        const scheduledSlots = new Set(this.entries()
          .filter(entry => entry.publicationId === publication.id &&
            this.selectedProgramIds().includes(entry.programId ?? -1) && this.dates().includes(entry.date) &&
            entry.startTime === this.startTime() && entry.endTime === this.endTime())
          .map(entry => `${entry.programId}:${entry.date}`));
        return {
          id: publication.id,
          title: publication.title,
          type: publication.type,
          status: 'Disponível',
          scheduleSummary: `${scheduledSlots.size} de ${this.dates().length * this.selectedProgramIds().length} agendadas`,
          scheduledSlots: scheduledSlots.size,
        };
      }),
  );
  readonly calendarReviewRows = computed<CalendarReviewRow[]>(() => this.calendarReviewItems()
    .map(({ scheduledSlots: _scheduledSlots, ...row }) => row));
  readonly calendarReviewCount = computed(() => this.calendarReviewItems().reduce(
    (count, item) => count + this.dates().length * this.selectedProgramIds().length - item.scheduledSlots, 0,
  ));
  readonly knownScheduleConflicts = computed<ScheduleConflict[]>(() =>
    overlappingScheduleEntries(
      this.selectedContentIds(), this.selectedProgramIds(), this.dates(), this.entries(), this.startTime(), this.endTime(),
    ).flatMap(entry => {
      const publication = this.publicationsById().get(entry.publicationId);
      if (!publication || entry.programId === null) return [];
      return [{
        publicationId: entry.publicationId,
        programId: entry.programId,
        programName: this.programsById().get(entry.programId) ?? 'Sem programação',
        title: publication.title,
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
      }];
    }),
  );
  readonly canReview = computed(() => this.selectedNewContentCount() > 0 && !this.isPast() &&
    this.endDate() >= this.date() && toMinutes(this.endTime()) > toMinutes(this.startTime()) && !this.busy());
  readonly canConfirm = computed(() => this.selectedNewContentCount() > 0 &&
    !this.knownScheduleConflicts().length && this.endDate() >= this.date() &&
    toMinutes(this.endTime()) > toMinutes(this.startTime()) && !this.busy());

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['date']) return;
    this.selectedContentIds.set([]);
    this.selectedProgramIds.set([]);
    this.search.set('');
    this.typeFilter.set('ALL');
    this.startTime.set('08:00');
    this.endTime.set('18:00');
    this.endDate.set(this.date());
    this.reviewing.set(false);
    this.validationError.set('');
  }

  isPast(): boolean {
    return this.date() < this.today();
  }

  isContentSelected(id: number): boolean {
    return this.selectedContentIds().includes(id);
  }

  toggleProgram(programId: number): void {
    this.selectedProgramIds.update(ids => {
      if (ids.includes(programId)) return ids.filter(id => id !== programId);
      return [...ids, programId];
    });
  }

  toggleContent(id: number, checked: boolean): void {
    if (this.alreadyScheduled().has(id)) return;
    this.selectedContentIds.update(ids => {
      if (!checked) return ids.filter(item => item !== id);
      if (ids.includes(id)) return ids;
      return [...ids, id];
    });
  }

  publicationDescription(publication: Publication): string {
    if (publication.type === 'MESSAGE') return 'Fixa durante o horário agendado';
    return `${this.typeName(publication.type)} · ${publication.displaySeconds ?? 10} s`;
  }

  publicationStatus(alreadyAdded: boolean, selected: boolean): string {
    if (alreadyAdded) return 'Já agendado neste período';
    if (selected) return 'Selecionado';
    return 'Disponível';
  }

  clearContentSelection(): void {
    this.selectedContentIds.set([]);
  }

  openReview(): void {
    this.validationError.set('');
    if (!this.selectedProgramIds().length) {
      this.validationError.set('Selecione uma programação antes de agendar o conteúdo.');
      return;
    }
    this.reviewing.set(true);
  }

  requestSchedule(): void {
    this.validationError.set('');
    if (!this.selectedProgramIds().length) {
      this.validationError.set('Selecione uma programação antes de agendar o conteúdo.');
      return;
    }
    if (!this.dates().length || toMinutes(this.endTime()) <= toMinutes(this.startTime()) || this.isPast()) return;

    const tasks = missingScheduleEntries(
      this.selectedContentIds(), this.selectedProgramIds(), this.dates(), this.entries(), this.startTime(), this.endTime(),
    );
    this.scheduleRequested.emit(tasks);
  }

  requestClose(): void {
    if (!this.busy()) this.closed.emit();
  }
}
