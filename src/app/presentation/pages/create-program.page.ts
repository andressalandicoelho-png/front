import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AddProgramEntriesUseCase, CreateProgramUseCase } from '@application/program/program.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { CreateScheduleEntryUseCase } from '@application/schedule/schedule.usecases';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { datesBetweenInclusive, toMinutes } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@infra/http/auth.interceptor';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { ProgramPreviewComponent, ProgramPreviewItem } from '@presentation/ui/program-preview.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';
import { concatMap, from } from 'rxjs';

interface PublicationScheduleInput { date: string; endDate: string; startTime: string; endTime: string; }

const businessDate = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

@Component({
  selector: 'app-create-program',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, ProgramPreviewComponent, SecureMediaComponent],
  template: `
    <header class="page-head">
      <a class="program-breadcrumb" routerLink="/programacao">Programação / Nova programação</a>
      <h1>Criar programação</h1>
      <p class="muted">Escolha um nome, organize a sequência e defina quando cada conteúdo será exibido.</p>
    </header>

    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }
    @if (createdProgram(); as created) {
      <div class="notice program-created-notice" role="status">
        <strong>“{{ created.name }}” já foi criada.</strong>
        <span>Conclua o vínculo e o agendamento dos conteúdos para finalizar.</span>
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
            <p class="muted">Defina como a programação será identificada.</p>
          </div>
          <label class="field" for="program-name">Nome da programação <span aria-hidden="true">*</span>
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
        </section>

        <section class="card program-create-card">
          <div class="program-create-card-head program-selected-head">
            <div>
              <h2>Conteúdos selecionados <span class="chip">{{ selectedPublications().length }}</span></h2>
              <p class="muted">A sequência define a ordem de reprodução. O calendário define em quais datas e horários cada conteúdo pode aparecer.</p>
              <p class="program-sequence-note">Exemplo: a posição define qual conteúdo vem primeiro; a faixa de horário define quando a TV pode iniciar a sequência. Fora dos horários agendados, o player aguarda.</p>
              <p class="program-schedule-required">As datas inicial/final e os horários são obrigatórios; o fim deve ser posterior ao início.</p>
            </div>
          </div>

          <div class="program-selected-list">
            @for (publication of selectedPublications(); track publication.id; let index = $index) {
              <article class="program-selected-item">
                <span class="program-position">{{ (index + 1).toString().padStart(2, '0') }}</span>
                <span class="program-create-thumb">
                  <app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/>
                </span>
                <span class="program-selected-copy">
                  <strong>{{ publication.title }}</strong>
                  <small>{{ typeName(publication.type) }} · {{ duration(publication) }} s</small>
                </span>
                <span class="program-schedule-fields">
                  @if (scheduleComplete(publication.id)) {
                    <span class="program-scheduled-label"><app-icon name="check" [size]="14"/> Agendado</span>
                  } @else {
                    <label>Data
                      <input class="input" type="date" [name]="'scheduleDate' + publication.id" [min]="today" required
                        [disabled]="!!createdProgram() && saving()"
                        [ngModel]="scheduleFor(publication.id).date"
                        (ngModelChange)="updateSchedule(publication.id, 'date', $event)">
                    </label>
                    <label>Até (inclusive)
                      <input class="input" type="date" [name]="'scheduleEndDate' + publication.id" [min]="scheduleFor(publication.id).date || today" required
                        [disabled]="!!createdProgram() && saving()"
                        [ngModel]="scheduleFor(publication.id).endDate"
                        (ngModelChange)="updateSchedule(publication.id, 'endDate', $event)">
                    </label>
                    <label>Início
                      <input class="input" type="time" [name]="'scheduleStart' + publication.id" required
                        [disabled]="!!createdProgram() && saving()"
                        [ngModel]="scheduleFor(publication.id).startTime"
                        (ngModelChange)="updateSchedule(publication.id, 'startTime', $event)">
                    </label>
                    <label>Fim
                      <input class="input" type="time" [name]="'scheduleEnd' + publication.id" required
                        [disabled]="!!createdProgram() && saving()"
                        [ngModel]="scheduleFor(publication.id).endTime"
                        (ngModelChange)="updateSchedule(publication.id, 'endTime', $event)">
                    </label>
                    @if (scheduledCount(publication.id)) {
                      <small class="program-scheduled-progress">{{ scheduledCount(publication.id) }} de {{ datesFor(publication.id).length }} dias já agendados</small>
                    }
                  }
                </span>
                <span class="program-order-actions">
                  <button class="icon-btn" type="button" aria-label="Mover conteúdo para cima" [disabled]="index === 0 || !!createdProgram()" (click)="movePublication(index, -1)">
                    <app-icon name="up" [size]="17"/>
                  </button>
                  <button class="icon-btn" type="button" aria-label="Mover conteúdo para baixo" [disabled]="index === selectedPublications().length - 1 || !!createdProgram()" (click)="movePublication(index, 1)">
                    <app-icon name="down" [size]="17"/>
                  </button>
                  <button class="icon-btn danger" type="button" [attr.aria-label]="'Remover ' + publication.title" [disabled]="!!createdProgram()" (click)="togglePublication(publication.id)">
                    <app-icon name="trash" [size]="17"/>
                  </button>
                </span>
              </article>
            } @empty {
              <div class="program-create-empty">
                <span class="empty-icon"><app-icon name="layers" [size]="24"/></span>
                <strong>Nenhum conteúdo selecionado</strong>
                <p class="muted">Adicione abaixo os conteúdos publicados que esta TV deve exibir.</p>
              </div>
            }
          </div>

          <p class="program-sequence-note">A TV percorre esta sequência continuamente, mas só exibe um conteúdo quando o respectivo horário do calendário está ativo. A ordem não altera as datas nem os horários.</p>
        </section>

        <section class="card program-create-card program-library">
          <div class="program-create-card-head program-library-head">
            <div>
              <h2>Adicionar conteúdos</h2>
              <p class="muted">Somente conteúdos publicados podem entrar na programação.</p>
            </div>
            <input class="input program-library-search" type="search" aria-label="Buscar conteúdo publicado" placeholder="Buscar conteúdo" [(ngModel)]="query" name="query">
          </div>

          @if (loading()) {
            <p class="program-library-message muted">Carregando conteúdos publicados…</p>
          } @else if (filteredPublications().length) {
            <div class="program-available-list">
              @for (publication of filteredPublications(); track publication.id) {
                <label class="program-available-item" [class.is-selected]="isSelected(publication.id)">
                  <input type="checkbox" [checked]="isSelected(publication.id)" [disabled]="!!createdProgram()" (change)="togglePublication(publication.id)">
                  <span class="program-create-thumb">
                    <app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/>
                  </span>
                  <span class="program-selected-copy">
                    <strong>{{ publication.title }}</strong>
                    <small>{{ typeName(publication.type) }} · {{ duration(publication) }} s</small>
                  </span>
                  @if (isSelected(publication.id)) { <span class="program-added-label">Adicionado · {{ selectedIndex(publication.id) }}</span> }
                </label>
              }
            </div>
          } @else {
            <div class="program-library-message">
              @if (!readyPublications().length) {
                <p class="muted">Ainda não há conteúdos publicados disponíveis.</p>
                <a class="link" routerLink="/publicacoes">Ir para Conteúdos</a>
              } @else {
                <p class="muted">Nenhum conteúdo corresponde à busca.</p>
              }
            </div>
          }
        </section>
      </div>

      <aside class="program-create-aside">
        <section class="card program-summary">
          <div class="program-summary-head"><h2>Resumo</h2><span class="chip">{{ createdProgram() ? 'Criada' : 'Nova programação' }}</span></div>
          <div class="program-summary-body">
            <small>{{ name.trim() || 'Nome da programação' }}</small>
            <strong>{{ selectedPublications().length }} {{ selectedPublications().length === 1 ? 'conteúdo' : 'conteúdos' }} · {{ totalDuration() }} s</strong>
            <small>{{ scheduledEntryCount() }} agendamentos concluídos</small>
            @if (selectedPublications().length) {
              <button class="btn small" type="button" (click)="previewOpen.set(true)">
                <app-icon name="play" [size]="15"/> Prévia na TV
              </button>
            }
          </div>
        </section>
        <div class="program-create-info">
          <app-icon name="info" [size]="18"/>
          <p>Todos os conteúdos precisam de data, início e fim para serem exibidos na TV.</p>
        </div>
      </aside>

      <app-program-preview
        title="Prévia da programação"
        [items]="previewItems()"
        [open]="previewOpen()"
        (closed)="previewOpen.set(false)"/>

      @if (reviewOpen()) {
        <app-modal title="Revise antes de criar" (closed)="reviewOpen.set(false)">
          <div class="program-review">
            <p class="muted">Confira a sequência e os períodos. Os agendamentos são criados dia a dia; se algum falhar, os concluídos serão mantidos e você poderá retomar.</p>
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
              <p class="program-review-empty">A programação será criada sem conteúdos. Você poderá adicioná-los depois.</p>
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
        <a class="btn" routerLink="/programacao">Cancelar</a>
        <button class="btn primary" type="submit" [disabled]="saving() || (!createdProgram() && name.trim().length < 2) || !schedulesValid()">
          {{ saving() ? 'Salvando…' : createdProgram() ? 'Concluir agendamentos' : 'Revisar programação' }}
        </button>
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
  today = businessDate();
  query = '';
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  createdProgram = signal<Program | null>(null);
  readyPublications = signal<Publication[]>([]);
  selectedPublicationIds = signal<number[]>([]);
  schedules = signal<Record<number, PublicationScheduleInput>>({});
  scheduledScheduleKeys = signal<string[]>([]);
  entriesAdded = signal(false);
  previewOpen = signal(false);
  reviewOpen = signal(false);
  scheduleProgress = signal({ completed: 0, total: 0 });

  selectedPublications = computed(() => {
    const publicationsById = new Map(this.readyPublications().map(publication => [publication.id, publication]));
    return this.selectedPublicationIds().flatMap(id => {
      const publication = publicationsById.get(id);
      return publication ? [publication] : [];
    });
  });
  filteredPublications = computed(() => {
    const query = this.query.trim().toLocaleLowerCase();
    return this.readyPublications().filter(publication => !query || publication.title.toLocaleLowerCase().includes(query));
  });
  totalDuration = computed(() => this.selectedPublications().reduce((sum, publication) => sum + this.duration(publication), 0));
  previewItems = computed<ProgramPreviewItem[]>(() => this.selectedPublications().map(publication => {
    const schedule = this.scheduleFor(publication.id);
    const dates = this.datesFor(publication.id);
    const range = dates.length ? `${this.formatDate(dates[0])}${dates.length > 1 ? ` a ${this.formatDate(dates[dates.length - 1])}` : ''}` : '';
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime}–${schedule.endTime}` : '';
    return {
      title: publication.title,
      type: publication.type,
      mediaId: publication.mediaId,
      linkUrl: publication.linkUrl,
      seconds: this.duration(publication),
      schedule: [range, time].filter(Boolean).join(' · '),
    };
  }));
  schedulesValid = computed(() => this.selectedPublications().every(publication => {
    if (this.scheduleComplete(publication.id)) return true;
    const schedule = this.scheduleFor(publication.id);
    const dates = datesBetweenInclusive(schedule.date, schedule.endDate);
    return !!dates.length && schedule.date >= this.today &&
      !!schedule.startTime && !!schedule.endTime &&
      toMinutes(schedule.endTime) > toMinutes(schedule.startTime);
  }));

  ngOnInit(): void {
    this.listPublications.execute({ status: 'READY' }).subscribe({
      next: publications => {
        this.readyPublications.set(publications.filter(publication => publication.status === 'READY'));
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  typeName(type: string): string {
    return type === 'IMAGE' ? 'Imagem' : type === 'VIDEO' ? 'Vídeo' : 'Link';
  }

  duration(publication: Publication): number {
    const naturalDuration = publication.originalDurationSeconds ?? publication.displaySeconds ?? 10;
    return publication.type === 'VIDEO'
      ? Math.min(publication.displaySeconds ?? naturalDuration, naturalDuration)
      : publication.displaySeconds ?? 10;
  }

  isSelected(publicationId: number): boolean {
    return this.selectedPublicationIds().includes(publicationId);
  }

  scheduleFor(publicationId: number): PublicationScheduleInput {
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

  updateSchedule(publicationId: number, field: keyof PublicationScheduleInput, value: string): void {
    this.schedules.update(schedules => ({
      ...schedules,
      [publicationId]: { ...this.scheduleFor(publicationId), [field]: value },
    }));
  }

  selectedIndex(publicationId: number): number {
    return this.selectedPublicationIds().indexOf(publicationId) + 1;
  }

  togglePublication(publicationId: number): void {
    this.selectedPublicationIds.update(ids => ids.includes(publicationId)
      ? ids.filter(id => id !== publicationId)
      : [...ids, publicationId]);
    if (!this.isSelected(publicationId)) {
      this.schedules.update(schedules => {
        const { [publicationId]: _removed, ...remaining } = schedules;
        return remaining;
      });
    }
  }

  movePublication(index: number, direction: -1 | 1): void {
    this.selectedPublicationIds.update(ids => {
      const target = index + direction;
      if (target < 0 || target >= ids.length) return ids;
      const reordered = [...ids];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }

  save(): void {
    if (!this.createdProgram()) {
      this.reviewOpen.set(true);
      return;
    }
    this.confirmSave();
  }

  confirmSave(): void {
    this.reviewOpen.set(false);
    const existing = this.createdProgram();
    if (existing) {
      if (this.entriesAdded()) this.scheduleEntries(existing);
      else this.addEntries(existing);
      return;
    }
    const name = this.name.trim();
    if (name.length < 2) return;

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
        const partial = scheduledNow ? ` ${scheduledNow} agendamento(s) já foram concluídos.` : '';
        this.error.set(`${errorMessage(error)} Não foi possível agendar “${activeItem.publication.title}” em ${this.formatDate(activeItem.date)}.${partial} Corrija o período ou horário e tente concluir novamente.`);
      },
      complete: () => this.finish(program),
    });
  }

  private finish(program: Program): void {
    this.saving.set(false);
    const contents = this.selectedPublications().length;
    this.toast.show(contents
      ? `Programação criada: ${contents} conteúdo(s) e ${this.scheduledEntryCount()} agendamento(s) concluídos.`
      : 'Programação criada sem conteúdos. Você pode adicionar a sequência depois.');
    this.router.navigate(['/programacao'], { queryParams: { programId: program.id } });
  }

  scheduleProgressPercent(): number {
    const { completed, total } = this.scheduleProgress();
    return total ? Math.round(completed / total * 100) : 0;
  }

  private formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }

  private scheduleKey(publicationId: number, date: string): string {
    return `${publicationId}:${date}`;
  }
}
