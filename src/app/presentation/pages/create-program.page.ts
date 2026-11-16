import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AddProgramEntriesUseCase, CreateProgramUseCase } from '@application/program/program.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { CreateScheduleEntryUseCase } from '@application/schedule/schedule.usecases';
import { Program } from '@domain/program/program.entity';
import { displayDurationSeconds, Publication } from '@domain/publication/publication.entity';
import { currentBusinessDate, datesBetweenInclusive } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { formatDate } from '@presentation/core/format';
import { createDefaultPublicationSchedule, isPublicationScheduleValid, updatePublicationSchedule } from '@presentation/core/publication-schedule';
import { ToastService } from '@presentation/core/toast.service';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';
import { ContentPreviewComponent } from '@presentation/ui/content-preview.component';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { ProgramPreviewComponent, ProgramPreviewItem } from '@presentation/ui/program-preview.component';
import { PublicationPickerComponent } from '@presentation/ui/publication-picker.component';
import { PublicationScheduleFieldsComponent } from '@presentation/ui/publication-schedule-fields.component';
import { ProgramPublicationRowComponent } from '@presentation/ui/program-publication-row.component';
import { concatMap, from } from 'rxjs';

@Component({
  selector: 'app-create-program',
  imports: [FormsModule, RouterLink, ContentPreviewComponent, IconComponent, ModalComponent, ProgramPreviewComponent, PublicationPickerComponent, PublicationScheduleFieldsComponent, ProgramPublicationRowComponent],
  template: `
    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }
    @if (createdProgram(); as created) {
      <div class="notice program-created-notice" role="status">
        <strong>“{{ created.name }}” criada.</strong>
        <span>Conclua os agendamentos abaixo.</span>
      </div>
    }
    @if (saving() && scheduleProgress().total) {
      <div class="program-progress" role="status" aria-live="polite">
        <span>Agendando {{ scheduleProgress().completed }} de {{ scheduleProgress().total }} períodos diários…</span>
        <span class="program-progress-track"><i [style.width.%]="scheduleProgressPercent()"></i></span>
      </div>
    }

    <form class="program-create-form" (ngSubmit)="save()">
      <div class="program-create-main">
        <section class="card program-create-card">
          <div class="program-create-card-head">
            <h2>Dados da programação</h2>
            <p class="program-create-description">Os campos com * são obrigatórios.</p>
          </div>
          <label class="field program-name-field" for="program-name">
            <span>Nome da programação <span aria-hidden="true">*</span></span>
            <input
              id="program-name"
              class="input"
              name="programName"
              [(ngModel)]="name"
              minlength="2"
              maxlength="120"
              placeholder="Ex.: TV da recepção"
              required
              [disabled]="!!createdProgram()">
          </label>
          <small class="program-timezone-note">Horário de Brasília · GMT-3</small>
        </section>

        <section class="card program-create-card">
          <div class="program-create-card-head program-selected-head">
            <div>
              <h2>Conteúdos selecionados · {{ selectedPublications().length }} {{ selectedPublications().length === 1 ? 'post' : 'posts' }}</h2>
            </div>
            <button class="program-add-content" type="button" [disabled]="!!createdProgram()" (click)="openPublicationPicker()">Adicionar <span aria-hidden="true">+</span></button>
          </div>

          <div class="program-selected-list">
            @for (publication of selectedPublications(); track publication.id; let index = $index) {
              <app-program-publication-row
                [position]="index + 1"
                [title]="publication.title"
                [type]="publication.type"
                [mediaId]="publication.mediaId"
                [detailLabel]="scheduleSummary(publication)"
                [removeDisabled]="!!createdProgram()"
                (previewRequested)="previewPublication.set(publication)"
                (removeRequested)="togglePublication(publication.id)"/>
            } @empty {
              <div class="program-create-empty empty-state">
                <span class="empty-icon"><app-icon name="layers" [size]="24"/></span>
                <strong>Nenhum conteúdo selecionado</strong>
                <p class="muted">Adicione conteúdos publicados à programação.</p>
              </div>
            }
          </div>
          <p class="program-selected-footnote">Os períodos são definidos ao adicionar conteúdos.</p>
        </section>
      </div>

      <aside class="program-create-aside">
        <section class="card program-summary">
          <div class="program-summary-head"><h2>Resumo</h2><span class="chip">{{ createdProgram() ? 'Criada' : 'Nova programação' }}</span></div>
          <div class="program-summary-body">
          <small>{{ summaryPeriod() }}</small>
          <strong>{{ selectedPublications().length }} {{ selectedPublications().length === 1 ? 'post' : 'posts' }} · {{ totalDurationLabel() }}</strong>
            <small>{{ scheduledEntryCount() }} agendamentos concluídos</small>
            @if (selectedPublications().length) {
              <button class="btn small" type="button" (click)="previewOpen.set(true)">
                <app-icon name="play" [size]="15"/> Prévia na TV
              </button>
            }
          </div>
        </section>
        <section class="program-create-tip" role="note">
          <app-icon name="info" [size]="16"/>
          <p>Os conteúdos se repetem na ordem escolhida, dentro do período definido e dos horários de cada post. Clique no período para editar.</p>
        </section>
      </aside>

      @if (libraryOpen()) {
        <app-modal class="calendar-modal add-content-modal" title="Adicionar conteúdos"
          subtitle="Selecione as mídias da biblioteca e configure os horários de exibição."
          (closed)="closePublicationPicker()">
          <form class="add-content-dialog" (ngSubmit)="confirmPublicationSelection()">
            <div class="add-content-context">
              <div class="add-content-period-heading">
                <strong>Período e horários de exibição</strong>
                <small>Aplicados a todos os conteúdos selecionados. Você pode ajustar cada conteúdo depois.</small>
              </div>
              <app-publication-schedule-fields [schedule]="pickerSchedule()" [minDate]="today"
                namePrefix="pickerSchedule"
                (scheduleChanged)="updatePickerSchedule($event.field, $event.value)"/>
              @if (!pickerScheduleValid()) {
                <small class="error" role="alert">Informe um período válido, com o horário final após o inicial.</small>
              }
            </div>
            <app-publication-picker
              [publications]="readyPublications()"
              [selectedIds]="pickerPublicationIds()"
              [loading]="loading()"
              [loadError]="publicationLoadError()"
              [confirmDisabled]="!pickerPublicationIds().length || !pickerScheduleValid()"
              [confirmLabel]="'Adicionar ' + pickerPublicationIds().length + (pickerPublicationIds().length === 1 ? ' conteúdo' : ' conteúdos')"
              (selectionChanged)="togglePickerPublication($event.publicationId, $event.checked)"
              (clearSelectionRequested)="pickerPublicationIds.set([])"
              (retryRequested)="loadPublications()"
              (cancelled)="closePublicationPicker()"/>
          </form>
        </app-modal>
      }

      <app-program-preview
        title="Prévia da programação"
        [items]="previewItems()"
        [open]="previewOpen()"
        (closed)="previewOpen.set(false)"/>

      @if (previewPublication(); as publication) {
        <app-modal [title]="publication.title" (closed)="previewPublication.set(null)">
          <app-content-preview [type]="publication.type" [content]="publication.content"
            [mediaId]="publication.mediaId" [linkUrl]="publication.linkUrl"
            [autoplay]="publication.type === 'VIDEO'"/>
        </app-modal>
      }

      @if (reviewOpen()) {
        <app-modal title="Revise antes de criar" (closed)="reviewOpen.set(false)">
          <div class="program-review">
            <p class="muted">Confirme a sequência e os períodos. Se falhar, os períodos concluídos serão mantidos e você poderá retomar.</p>
            <div class="program-review-heading">
              <strong>{{ name.trim() }}</strong>
              <span>{{ selectedPublications().length }} conteúdos · {{ scheduledEntryCount() }} dias agendados</span>
            </div>
            @if (selectedPublications().length) {
              <ol class="program-review-list">
                @for (item of previewItems(); track $index; let index = $index) {
                  <li>
                    <span class="program-position">{{ (index + 1).toString().padStart(2, '0') }}</span>
                    <span><strong>{{ item.title }}</strong><small>{{ item.schedule || 'Período não definido' }} · {{ item.seconds }} s por exibição</small></span>
                  </li>
                }
              </ol>
            } @else {
              <p class="program-review-empty">Sem conteúdos; você poderá adicioná-los depois.</p>
            }
            <div class="actions">
              <button class="btn" type="button" (click)="reviewOpen.set(false)">Voltar e revisar</button>
              <button class="btn primary" type="button" [disabled]="saving()" (click)="confirmSave()">
                {{ saving() ? 'Criando…' : selectedPublications().length ? 'Confirmar programação' : 'Criar sem conteúdos' }}
              </button>
            </div>
          </div>
        </app-modal>
      }

      <footer class="program-create-footer">
        <span class="program-create-copyright">© {{ currentYear }} Office Total</span>
        <div class="program-create-actions">
          <a class="btn" routerLink="/programacao">Cancelar</a>
          <button class="btn primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Salvando…' : createdProgram() ? 'Concluir agendamentos' : 'Criar programação' }}
          </button>
        </div>
      </footer>
    </form>
  `,
})
export class CreateProgramPage implements OnInit {
  private readonly listPublications = inject(ListPublicationsUseCase);
  private readonly createProgram = inject(CreateProgramUseCase);
  private readonly addProgramEntries = inject(AddProgramEntriesUseCase);
  private readonly createSchedule = inject(CreateScheduleEntryUseCase);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  name = '';
  readonly currentYear = new Date().getFullYear();
  today = currentBusinessDate();
  libraryOpen = signal(false);
  pickerPublicationIds = signal<number[]>([]);
  pickerSchedule = signal<PublicationScheduleForm>(createDefaultPublicationSchedule(this.today));
  loading = signal(false);
  publicationLoadError = signal('');
  saving = signal(false);
  error = signal('');
  createdProgram = signal<Program | null>(null);
  readyPublications = signal<Publication[]>([]);
  selectedPublicationIds = signal<number[]>([]);
  schedules = signal<Record<number, PublicationScheduleForm>>({});
  scheduledScheduleKeys = signal<string[]>([]);
  entriesAdded = signal(false);
  previewOpen = signal(false);
  previewPublication = signal<Publication | null>(null);
  reviewOpen = signal(false);
  scheduleProgress = signal({ completed: 0, total: 0 });

  selectedPublications = computed(() => {
    const publicationsById = new Map(this.readyPublications().map(publication => [publication.id, publication]));
    return this.selectedPublicationIds().flatMap(id => {
      const publication = publicationsById.get(id);
      return publication ? [publication] : [];
    });
  });
  totalDuration = computed(() => this.selectedPublications().reduce(
    (sum, publication) => sum + (publication.type === 'MESSAGE' ? 0 : this.duration(publication)), 0,
  ));
  previewItems = computed<ProgramPreviewItem[]>(() => this.selectedPublications().map(publication => {
    const schedule = this.scheduleFor(publication.id);
    const dates = this.datesFor(publication.id);
    const range = dates.length ? `${this.formatDate(dates[0])}${dates.length > 1 ? ` a ${this.formatDate(dates[dates.length - 1])}` : ''}` : '';
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime}–${schedule.endTime}` : '';
    return {
      title: publication.title,
      type: publication.type,
      content: publication.content,
      mediaId: publication.mediaId,
      linkUrl: publication.linkUrl,
      seconds: this.duration(publication),
      schedule: [range, time].filter(Boolean).join(' · '),
    };
  }));
  schedulesValid = computed(() => this.selectedPublications().every(publication => {
    if (this.scheduleComplete(publication.id)) return true;
    return isPublicationScheduleValid(this.scheduleFor(publication.id), this.today);
  }));

  ngOnInit(): void {
    this.loadPublications();
  }

  loadPublications(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.publicationLoadError.set('');
    this.listPublications.execute({ status: 'READY' }).subscribe({
      next: publications => {
        this.readyPublications.set(publications.filter(publication => publication.status === 'READY'));
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.publicationLoadError.set(errorMessage(error));
      },
    });
  }

  readonly formatDate = formatDate;
  scheduleSummary(publication: Publication): string {
    const schedule = this.scheduleFor(publication.id);
    const period = schedule.date && schedule.endDate
      ? this.formatScheduleRange(schedule.date, schedule.endDate)
      : 'Período a definir';
    const time = schedule.startTime && schedule.endTime
      ? `${schedule.startTime}–${schedule.endTime}`
      : 'Horário a definir';
    return `${period} · ${time}`;
  }

  summaryPeriod(): string {
    const schedules = this.selectedPublications()
      .map(publication => this.scheduleFor(publication.id))
      .filter(schedule => schedule.date && schedule.endDate);
    if (!schedules.length) return 'Período não definido';
    const start = schedules.map(schedule => schedule.date).sort()[0];
    const end = schedules.map(schedule => schedule.endDate).sort().at(-1);
    if (!start || !end) return 'Período não definido';
    return this.formatScheduleRange(start, end);
  }

  totalDurationLabel(): string {
    const seconds = this.totalDuration();
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes} min ${remainder} s` : `${minutes} min`;
  }

  private formatScheduleRange(start: string, end: string): string {
    const startDate = this.localDate(start);
    const endDate = this.localDate(end);
    if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
      const month = startDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      return `${startDate.getDate()} a ${endDate.getDate()} ${month} ${startDate.getFullYear()}`;
    }
    return `${this.formatDate(start)} a ${this.formatDate(end)}`;
  }

  private localDate(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  duration(publication: Publication): number {
    return displayDurationSeconds(publication.type, publication.displaySeconds, publication.originalDurationSeconds);
  }

  isSelected(publicationId: number): boolean {
    return this.selectedPublicationIds().includes(publicationId);
  }

  scheduleFor(publicationId: number): PublicationScheduleForm {
    return this.schedules()[publicationId] ?? { date: '', endDate: '', startTime: '', endTime: '' };
  }

  scheduledCount(publicationId: number): number {
    const schedule = this.scheduleFor(publicationId);
    return this.datesFor(publicationId)
      .filter(date => this.scheduledScheduleKeys().includes(this.scheduleKey(publicationId, date))).length;
  }

  datesFor(publicationId: number): string[] {
    const schedule = this.scheduleFor(publicationId);
    return datesBetweenInclusive(schedule.date, schedule.endDate);
  }

  scheduleComplete(publicationId: number): boolean {
    const dates = this.datesFor(publicationId);
    return dates.length > 0 && this.scheduledCount(publicationId) === dates.length;
  }

  scheduledEntryCount(): number {
    return this.selectedPublications().reduce((count, publication) => count + this.scheduledCount(publication.id), 0);
  }

  openPublicationPicker(): void {
    this.pickerPublicationIds.set([...this.selectedPublicationIds()]);
    const firstSelectedId = this.selectedPublicationIds()[0];
    const currentSchedule = firstSelectedId === undefined ? null : this.scheduleFor(firstSelectedId);
    this.pickerSchedule.set(currentSchedule?.date
      ? { ...currentSchedule }
      : createDefaultPublicationSchedule(this.today));
    this.libraryOpen.set(true);
  }

  closePublicationPicker(): void {
    this.libraryOpen.set(false);
  }

  confirmPublicationSelection(): void {
    if (!this.pickerScheduleValid()) return;
    const selectedIds = this.pickerPublicationIds();
    const removedIds = this.selectedPublicationIds().filter(id => !selectedIds.includes(id));
    this.selectedPublicationIds.set([...selectedIds]);
    this.schedules.update(schedules => {
      const updated = { ...schedules };
      for (const id of removedIds) delete updated[id];
      for (const id of selectedIds) updated[id] = { ...this.pickerSchedule() };
      return updated;
    });
    this.libraryOpen.set(false);
  }

  togglePickerPublication(publicationId: number, checked: boolean): void {
    this.pickerPublicationIds.update(ids => checked
      ? ids.includes(publicationId) ? ids : [...ids, publicationId]
      : ids.filter(id => id !== publicationId));
  }

  updatePickerSchedule(field: keyof PublicationScheduleForm, value: string): void {
    this.pickerSchedule.update(schedule => updatePublicationSchedule(schedule, field, value));
  }

  pickerScheduleValid(): boolean {
    return isPublicationScheduleValid(this.pickerSchedule(), this.today);
  }

  togglePublication(publicationId: number): void {
    const wasSelected = this.isSelected(publicationId);
    this.selectedPublicationIds.update(ids => wasSelected
      ? ids.filter(id => id !== publicationId)
      : [...ids, publicationId]);
    if (wasSelected) {
      this.schedules.update(schedules => {
        const { [publicationId]: _removed, ...remaining } = schedules;
        return remaining;
      });
    }
  }

  save(): void {
    this.error.set('');
    if (!this.createdProgram() && this.name.trim().length < 2) {
      this.error.set('Informe um nome com 2 caracteres ou mais.');
      return;
    }
    if (!this.schedulesValid()) {
      this.error.set('Preencha datas e horários; o fim deve ser posterior ao início.');
      return;
    }
    if (!this.createdProgram()) {
      this.reviewOpen.set(true);
      return;
    }
    this.confirmSave();
  }

  confirmSave(): void {
    if (!this.createdProgram() && this.name.trim().length < 2) {
      this.error.set('Informe um nome com 2 caracteres ou mais.');
      return;
    }
    if (!this.schedulesValid()) {
      this.error.set('Preencha datas e horários; o fim deve ser posterior ao início.');
      return;
    }
    this.reviewOpen.set(false);
    const existing = this.createdProgram();
    if (existing) {
      if (this.entriesAdded()) this.scheduleEntries(existing);
      else this.addEntries(existing);
      return;
    }
    const name = this.name.trim();

    this.saving.set(true);
    this.error.set('');
    this.createProgram.execute(name).subscribe({
      next: program => {
        this.createdProgram.set(program);
        if (this.selectedPublicationIds().length) this.addEntries(program);
        else this.finish(program);
      },
      error: error => {
        this.saving.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  private addEntries(program: Program): void {
    this.addProgramEntries.execute(program.id, this.selectedPublicationIds()).subscribe({
      next: updatedProgram => {
        this.entriesAdded.set(true);
        this.scheduleEntries(updatedProgram);
      },
      error: error => {
        this.saving.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  private scheduleEntries(program: Program): void {
    const pending = this.selectedPublications().flatMap(publication => {
      const schedule = this.scheduleFor(publication.id);
      return datesBetweenInclusive(schedule.date, schedule.endDate)
        .filter(date => !this.scheduledScheduleKeys().includes(this.scheduleKey(publication.id, date)))
        .map(date => ({ publication, date }));
    });
    if (!pending.length) {
      this.finish(program);
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.scheduleProgress.set({ completed: 0, total: pending.length });
    let scheduledNow = 0;
    let activeItem = pending[0];
    from(pending).pipe(
      concatMap(({ publication, date }) => {
        activeItem = { publication, date };
        const schedule = this.scheduleFor(publication.id);
        return this.createSchedule.execute({
          publicationId: publication.id,
          programId: program.id,
          date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        });
      }),
    ).subscribe({
      next: entry => {
        scheduledNow++;
        this.scheduleProgress.update(progress => ({ ...progress, completed: scheduledNow }));
        this.scheduledScheduleKeys.update(keys => [...keys, this.scheduleKey(entry.publicationId, entry.date)]);
      },
      error: error => {
        this.saving.set(false);
        const partial = scheduledNow
          ? ` ${scheduledNow} ${scheduledNow === 1 ? 'agendamento concluído' : 'agendamentos concluídos'}.`
          : '';
        this.error.set(`${errorMessage(error)} Falha ao agendar “${activeItem.publication.title}” em ${this.formatDate(activeItem.date)}.${partial} Ajuste o período e tente novamente.`);
      },
      complete: () => this.finish(program),
    });
  }

  private finish(program: Program): void {
    this.saving.set(false);
    const contents = this.selectedPublications().length;
    const schedules = this.scheduledEntryCount();
    this.toast.show(contents
      ? `Programação criada: ${contents} ${contents === 1 ? 'conteúdo' : 'conteúdos'}, ${schedules} ${schedules === 1 ? 'agendamento' : 'agendamentos'}.`
      : 'Programação criada. Adicione conteúdos depois.');
    this.router.navigate(['/programacao'], { queryParams: { programId: program.id } });
  }

  scheduleProgressPercent(): number {
    const { completed, total } = this.scheduleProgress();
    return total ? Math.round(completed / total * 100) : 0;
  }

  private scheduleKey(publicationId: number, date: string): string {
    return `${publicationId}:${date}`;
  }
}
