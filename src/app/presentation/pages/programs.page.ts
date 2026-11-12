import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import {
  AddProgramEntriesUseCase, DeleteProgramUseCase, ListProgramsUseCase, RemoveProgramEntryUseCase, UpdateProgramUseCase,
} from '@application/program/program.usecases';
import { CreateScheduleEntryUseCase, ListScheduleUseCase } from '@application/schedule/schedule.usecases';
import { GeneratePlayerTokenUseCase } from '@application/user/user.usecases';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { ScheduleEntry } from '@domain/schedule/schedule.entity';
import { currentBusinessDate, currentBusinessTime, datesBetweenInclusive, toMinutes } from '@domain/schedule/schedule.rules';
import { errorMessage } from '@presentation/core/error-message';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { DatePickerComponent } from '@presentation/ui/date-picker.component';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { ProgramPreviewComponent, ProgramPreviewItem } from '@presentation/ui/program-preview.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';
import { concatMap, from } from 'rxjs';

interface PublicationScheduleInput { date: string; endDate: string; startTime: string; endTime: string; }

@Component({
  selector: 'app-programs',
  imports: [FormsModule, DatePickerComponent, IconComponent, ModalComponent, ProgramPreviewComponent, SecureMediaComponent],
  template: `
    <header class="page-head row-between program-page-head">
      <div><h1>Programações</h1><p class="muted">Monte sequências de conteúdo e prepare cada TV para exibi-las.</p></div>
    </header>

    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }

    <section class="program-workspace" aria-label="Gerenciar programações">
      <aside class="program-browser" aria-label="Lista de programações">
        <div class="program-browser-heading">
          <div><h2>Suas programações</h2><span>{{ activeCount() }} ativas · {{ programs().length - activeCount() }} pausadas</span></div>
          <button class="btn primary small" type="button" (click)="openCreate()" aria-label="Criar nova programação">
            <app-icon name="plus" [size]="15"/> Nova
          </button>
        </div>
        <label class="search-field program-search">
          <app-icon name="search" [size]="16"/>
          <input class="input" type="search" placeholder="Buscar por nome" aria-label="Buscar programação por nome"
            [ngModel]="search()" (ngModelChange)="search.set($event)">
        </label>
        <div class="program-status-filter" role="group" aria-label="Filtrar por estado">
          <button type="button" [class.active]="statusFilter() === 'ALL'" [attr.aria-pressed]="statusFilter() === 'ALL'" (click)="statusFilter.set('ALL')">Todas</button>
          <button type="button" [class.active]="statusFilter() === 'ACTIVE'" [attr.aria-pressed]="statusFilter() === 'ACTIVE'" (click)="statusFilter.set('ACTIVE')">Ativas</button>
          <button type="button" [class.active]="statusFilter() === 'PAUSED'" [attr.aria-pressed]="statusFilter() === 'PAUSED'" (click)="statusFilter.set('PAUSED')">Pausadas</button>
        </div>
        <nav class="program-browser-list" aria-label="Selecionar programação">
          @for (program of filteredPrograms(); track program.id) {
            <button type="button" class="program-browser-item" [class.selected]="selected()?.id === program.id"
              [attr.aria-current]="selected()?.id === program.id ? 'true' : null" (click)="select(program)">
              <span class="program-browser-item-top">
                <strong>{{ program.name }}</strong>
                <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span>
              </span>
              <span class="program-browser-item-meta">{{ program.entries.length }} {{ program.entries.length === 1 ? 'conteúdo' : 'conteúdos' }}</span>
              <small>{{ programSummary(program) }}</small>
            </button>
          } @empty {
            <div class="program-browser-empty">
              <strong>{{ programs().length ? 'Nenhum resultado' : 'Nenhuma programação ainda' }}</strong>
              <span>{{ programs().length ? 'Tente outro nome ou estado.' : 'Crie uma programação para organizar o conteúdo de uma TV.' }}</span>
            </div>
          }
        </nav>
        <div class="program-browser-footer">{{ entryCount() }} conteúdos nas sequências</div>
      </aside>

      @if (selected(); as program) {
        <section class="program-inspector" aria-labelledby="program-inspector-title">
          <header class="program-inspector-head">
            <div class="program-inspector-title">
              <span class="eyebrow">Detalhes da programação</span>
              <h2 id="program-inspector-title">{{ program.name }}</h2>
              <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span>
            </div>
            <div class="program-inspector-actions">
              <button class="btn small" type="button" [disabled]="!program.entries.length" (click)="previewOpen.set(true)">
                <app-icon name="play" [size]="15"/> Prévia
              </button>
              <button class="btn small" type="button" (click)="toggle(program)">{{ program.active ? 'Pausar' : 'Ativar' }}</button>
              <button class="btn small" type="button" (click)="openEdit(program)">Editar nome</button>
              <button class="btn small program-delete-button" type="button" (click)="requestDelete(program)"><app-icon name="trash" [size]="15"/> Excluir</button>
              <button class="btn primary small" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="15"/> Adicionar conteúdo</button>
            </div>
          </header>

          <section class="program-connection" aria-labelledby="program-connection-title">
            <div class="program-section-heading">
              <div><h3 id="program-connection-title">Conectar à TV</h3><p>O link abre esta programação no navegador da TV.</p></div>
              <span class="program-connection-state" [class.ready]="program.active && program.entries.length > 0 && upcomingSchedules().length > 0 && !!playerToken()">
                {{ !program.active ? 'Programação pausada' : !program.entries.length ? 'Adicione conteúdo' : programScheduleLoading() ? 'Verificando agenda' : programScheduleError() ? 'Agenda indisponível' : !upcomingSchedules().length ? 'Sem horário próximo' : playerToken() ? 'Pronta para testar' : 'Gere o link da TV' }}
              </span>
            </div>
            @if (programScheduleLoading()) {
              <p class="program-connection-note" role="status">Consultando os horários dos próximos 30 dias…</p>
            } @else if (programScheduleError()) {
              <p class="program-connection-note" role="alert">{{ programScheduleError() }} <button class="link-button" type="button" (click)="loadProgramSchedule(program.id)">Tentar novamente</button></p>
            } @else if (upcomingSchedules().length) {
              <p class="program-connection-note">{{ upcomingSchedules().length }} período(s) nos próximos 30 dias. Próximo: {{ formatDate(upcomingSchedules()[0].date) }}, {{ upcomingSchedules()[0].startTime }}–{{ upcomingSchedules()[0].endTime }}.</p>
            } @else {
              <p class="program-connection-note">Nenhum horário nos próximos 30 dias. A sequência define a ordem; o calendário define quando o conteúdo aparece.</p>
            }
            @if (playerToken(); as token) {
              <div class="program-tv-actions">
                <input class="input" aria-label="Link da programação para TV" readonly [value]="playerUrl(token, program.id)">
                <button class="btn small" type="button" (click)="copyPlayerUrl(program.id)"><app-icon name="copy" [size]="15"/> Copiar</button>
                <a class="btn small" [href]="playerUrl(token, program.id)" target="_blank" rel="noopener">Testar</a>
              </div>
            } @else {
              <button class="btn small" type="button" [disabled]="generatingToken()" (click)="generatePlayerToken()">
                {{ generatingToken() ? 'Gerando link…' : auth.user()?.hasPlayerToken ? 'Renovar link da TV' : 'Gerar link da TV' }}
              </button>
              @if (auth.user()?.hasPlayerToken) {
                <p class="program-token-warning">Renovar o link invalida os endereços de TV já compartilhados.</p>
              }
            }
          </section>

          <section class="program-sequence" aria-labelledby="program-sequence-title">
            <div class="program-section-heading">
              <div><h3 id="program-sequence-title">Sequência de conteúdo</h3><p>Os itens são reproduzidos nesta ordem dentro dos horários ativos do calendário.</p></div>
              <span class="program-sequence-count">{{ program.entries.length }} itens</span>
            </div>
            @for (entry of program.entries; track entry.id; let index = $index) {
              <article class="program-sequence-item">
                <span class="program-sequence-position">{{ (index + 1).toString().padStart(2, '0') }}</span>
                <span class="program-sequence-thumb"><app-secure-media [mediaId]="entry.mediaFileId" [type]="entry.publicationType === 'MESSAGE' ? 'MESSAGE' : entry.publicationType === 'VIDEO' ? 'VIDEO' : entry.publicationType === 'LINK' ? 'LINK' : 'IMAGE'"/></span>
                <span class="program-sequence-copy">
                  <strong>{{ entry.publicationTitle }}</strong>
                  @if (entry.publicationType === 'MESSAGE') {
                    <small>Mensagem · Fixa durante o horário agendado</small>
                  } @else {
                    <small>{{ typeName(entry.publicationType) }} · {{ duration(entry) }} s</small>
                  }
                </span>
                <button type="button" class="icon-btn danger" [attr.aria-label]="'Remover ' + entry.publicationTitle + ' da sequência'" title="Remover da sequência" (click)="removeEntry(program, entry.id)">
                  <app-icon name="trash" [size]="17"/>
                </button>
              </article>
            } @empty {
              <div class="program-sequence-empty">
                <span class="empty-icon"><app-icon name="layers" [size]="22"/></span>
                <div><strong>Sequência vazia</strong><p>Adicione conteúdos publicados para definir o que esta TV deve reproduzir.</p></div>
                <button class="btn primary small" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="15"/> Adicionar conteúdo</button>
              </div>
            }
          </section>
        </section>
      } @else {
        <section class="program-inspector program-inspector-empty" aria-live="polite">
          @if (programs().length) {
            <span class="empty-icon"><app-icon name="layers" [size]="24"/></span>
            <h2>Selecione uma programação</h2>
            <p>Os detalhes, a sequência e a conexão da TV aparecem aqui.</p>
          } @else {
            <span class="empty-icon"><app-icon name="tv" [size]="24"/></span>
            <h2>Comece por uma programação</h2>
            <p>Crie uma sequência para organizar o conteúdo que será exibido nas TVs.</p>
          }
        </section>
      }
    </section>

    @if (selected(); as program) {
      <app-program-preview
        [title]="'Prévia · ' + program.name"
      [items]="previewItems()"
        [open]="previewOpen()"
        (closed)="previewOpen.set(false)"/>
    }

    @if (modal()) {
      <app-modal [title]="modalMode() === 'edit' ? 'Editar programação' : 'Adicionar conteúdos'" (closed)="closeModal()">
        @if (modalMode() === 'edit') {
          <form class="stack" (ngSubmit)="saveProgram()">
            <label class="field">Nome da programação<input class="input" name="name" [(ngModel)]="name" maxlength="120" required></label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || name.trim().length < 2">Salvar alterações</button>
          </form>
        } @else {
          <form class="stack" (ngSubmit)="saveEntries()">
            @if (reviewingEntries()) {
              <div class="program-review">
                <p class="muted">A sequência define a ordem; as datas e os horários definem quando cada item pode aparecer. A API validará conflitos ao salvar. Se houver falha parcial, os períodos concluídos serão mantidos.</p>
                <div class="program-review-heading">
                  <strong>{{ selected()?.name }}</strong>
                  <span>{{ selectedPublicationIds().length }} conteúdos selecionados · {{ reviewScheduleCount() }} períodos diários</span>
                </div>
                <ol class="program-review-list">
                  @for (id of selectedPublicationIds(); track id; let index = $index) {
                    <li>
                      <span class="program-position">{{ (index + 1).toString().padStart(2, '0') }}</span>
                      <span><strong>{{ publicationTitle(id) }}</strong><small>{{ scheduleSummary(id) }}</small></span>
                    </li>
                  }
                </ol>
                @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
                <div class="actions">
                  <button class="btn" type="button" [disabled]="saving()" (click)="reviewingEntries.set(false)">Voltar e revisar</button>
                  <button class="btn primary" type="button" [disabled]="saving()" (click)="confirmSaveEntries()">
                    {{ saving() ? 'Salvando…' : entriesAdded() ? 'Retomar agendamentos' : 'Confirmar e adicionar' }}
                  </button>
                </div>
              </div>
            } @else {
            <section class="program-publication-picker" aria-label="Selecionar conteúdos publicados">
              <header class="program-picker-context">
                <div><strong>{{ selected()?.name }}</strong><span>Escolha os conteúdos e defina quando serão exibidos.</span></div>
                <span class="program-picker-selected-count" aria-live="polite">{{ selectedPublicationIds().length }} selecionados</span>
              </header>
              <div class="program-picker-tools">
                <label class="search-field program-picker-search">
                  <app-icon name="search" [size]="16"/>
                  <input class="input" type="search" placeholder="Buscar conteúdo por nome" aria-label="Buscar conteúdo por nome"
                    name="publicationSearch" [ngModel]="publicationSearch()" (ngModelChange)="publicationSearch.set($event)">
                </label>
                <select class="input program-picker-type" aria-label="Filtrar conteúdo por formato"
                  name="publicationTypeFilter" [ngModel]="publicationTypeFilter()" (ngModelChange)="publicationTypeFilter.set($event)">
                  <option value="ALL">Todos os formatos</option>
                  <option value="IMAGE">Imagens</option>
                  <option value="VIDEO">Vídeos</option>
                  <option value="LINK">Links</option>
                  <option value="MESSAGE">Mensagens</option>
                </select>
                <div class="program-picker-view" role="group" aria-label="Conteúdos exibidos">
                  <button type="button" [class.active]="selectedOnly() === false" [attr.aria-pressed]="!selectedOnly()" (click)="selectedOnly.set(false)">Todos <span>{{ availablePublications().length }}</span></button>
                  <button type="button" [class.active]="selectedOnly()" [attr.aria-pressed]="selectedOnly()" (click)="selectedOnly.set(true)">Selecionados <span>{{ selectedPublicationIds().length }}</span></button>
                </div>
                @if (hasPublicationFilters()) {
                  <button class="program-picker-clear" type="button" (click)="clearPublicationFilters()">Limpar filtros</button>
                }
              </div>
              @if (publicationsLoading()) {
                <div class="program-picker-state" role="status">Carregando conteúdos publicados…</div>
              } @else if (publicationsLoadError()) {
                <div class="program-picker-state" role="alert">
                  <strong>Não foi possível carregar os conteúdos.</strong>
                  <span>{{ publicationsLoadError() }}</span>
                  <button class="link-button" type="button" (click)="loadPublications()">Tentar novamente</button>
                </div>
              } @else {
                <div class="program-picker-results" aria-live="polite">
                  <span>{{ filteredAvailablePublications().length }} {{ filteredAvailablePublications().length === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados' }}</span>
                  @if (selectedPublicationIds().length) { <span>{{ selectedPublicationIds().length }} na sequência</span> }
                </div>
                <div class="entry-picker">
                @for (publication of filteredAvailablePublications(); track publication.id) {
                  <div class="entry-option" [class.is-selected]="selectedPublicationIds().includes(publication.id)">
                    <label class="entry-option-content">
                      <input type="checkbox" [checked]="selectedPublicationIds().includes(publication.id)" [disabled]="entriesAdded()" (change)="togglePublication(publication.id, $event)">
                      <span class="add-content-thumb"><app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/></span>
                      <span class="program-entry-copy"><strong>{{ publication.title }}</strong>
                        <small>{{ publication.type === 'MESSAGE' ? 'Fixa durante o horário agendado' : typeName(publication.type) + ' · ' + (publication.displaySeconds ?? publication.originalDurationSeconds ?? 10) + ' s' }}</small>
                      </span>
                    </label>
                    @if (selectedPublicationIds().includes(publication.id)) {
                      <div class="program-schedule-fields">
                        @if (scheduleComplete(publication.id)) {
                          <span class="program-scheduled-label"><app-icon name="check" [size]="14"/> Agendado · {{ datesFor(publication.id).length }} {{ datesFor(publication.id).length === 1 ? 'dia' : 'dias' }}</span>
                        } @else {
                          <label>Data inicial
                            <app-date-picker [name]="'programDate' + publication.id" [min]="today" required
                              [disabled]="saving()" [ngModel]="scheduleFor(publication.id).date"
                              (ngModelChange)="updateSchedule(publication.id, 'date', $event)"/>
                          </label>
                          <label>Data final
                            <app-date-picker [name]="'programEndDate' + publication.id" [min]="scheduleFor(publication.id).date || today" required
                              [disabled]="saving()" [ngModel]="scheduleFor(publication.id).endDate"
                              (ngModelChange)="updateSchedule(publication.id, 'endDate', $event)"/>
                          </label>
                          <label>Início
                            <input class="input" type="time" [name]="'programStart' + publication.id" required
                              [disabled]="saving()" [ngModel]="scheduleFor(publication.id).startTime"
                              (ngModelChange)="updateSchedule(publication.id, 'startTime', $event)">
                          </label>
                          <label>Fim
                            <input class="input" type="time" [name]="'programEnd' + publication.id" required
                              [disabled]="saving()" [ngModel]="scheduleFor(publication.id).endTime"
                              (ngModelChange)="updateSchedule(publication.id, 'endTime', $event)">
                          </label>
                          @if (scheduledCount(publication.id)) {
                            <small class="program-scheduled-progress">{{ scheduledCount(publication.id) }} de {{ datesFor(publication.id).length }} dias concluídos</small>
                          }
                        }
                      </div>
                    }
                  </div>
                } @empty {
                  <div class="program-picker-empty">
                    <strong>{{ availablePublications().length ? 'Nenhum conteúdo corresponde aos filtros' : 'Nenhum conteúdo publicado disponível' }}</strong>
                    <span>{{ availablePublications().length ? 'Altere a busca ou o formato para ver outros resultados.' : 'Publique conteúdos na biblioteca antes de adicioná-los à programação.' }}</span>
                    @if (hasPublicationFilters()) { <button class="link-button" type="button" (click)="clearPublicationFilters()">Limpar filtros</button> }
                  </div>
                }
                </div>
              }
            </section>
            @if (saving() && scheduleProgress().total) {
              <div class="program-progress" role="status" aria-live="polite">
                <span>Agendando {{ scheduleProgress().completed }} de {{ scheduleProgress().total }} períodos diários…</span>
                <span class="program-progress-track"><i [style.width.%]="scheduleProgressPercent()"></i></span>
              </div>
            }
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || !selectedPublicationIds().length || !schedulesValid()">
              {{ saving() ? 'Salvando…' : entriesAdded() ? 'Revisar e retomar agendamentos' : 'Revisar conteúdos e horários' }}
            </button>
            }
          </form>
        }
      </app-modal>
    }

    @if (pendingDeletion(); as program) {
      <app-modal title="Excluir programação?" (closed)="closeDeleteConfirmation()">
        <div class="confirm-content program-delete-confirm">
          <span class="confirm-icon danger"><app-icon name="trash" [size]="22"/></span>
          <h2>Excluir “{{ program.name }}”?</h2>
          <p class="muted">A programação e sua sequência de conteúdos serão excluídas. Os agendamentos vinculados sairão do calendário, mas serão preservados no histórico de relatórios. As publicações continuarão na biblioteca.</p>
          @if (deleteError()) { <p class="error" role="alert">{{ deleteError() }}</p> }
          <div class="actions">
            <button class="btn" type="button" [disabled]="deleting()" (click)="closeDeleteConfirmation()">Cancelar</button>
            <button class="btn danger-button" type="button" [disabled]="deleting()" (click)="confirmDelete(program)">
              {{ deleting() ? 'Excluindo…' : 'Excluir programação' }}
            </button>
          </div>
        </div>
      </app-modal>
    }

    @if (pendingTokenRenewal()) {
      <app-modal title="Renovar link da TV?" (closed)="pendingTokenRenewal.set(false)">
        <div class="confirm-content">
          <span class="confirm-icon danger"><app-icon name="info" [size]="22"/></span>
          <h2>Os links já compartilhados deixarão de funcionar.</h2>
          <p class="muted">A renovação substitui o token da conta e afeta todas as programações ligadas a ele. Será necessário atualizar o endereço em cada TV.</p>
          <div class="actions">
            <button class="btn" type="button" [disabled]="generatingToken()" (click)="pendingTokenRenewal.set(false)">Manter links atuais</button>
            <button class="btn danger-button" type="button" [disabled]="generatingToken()" (click)="confirmTokenRenewal()">{{ generatingToken() ? 'Renovando…' : 'Renovar todos os links' }}</button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ProgramsPage implements OnInit {
  auth = inject(AuthState);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private listUC = inject(ListProgramsUseCase);
  private updateUC = inject(UpdateProgramUseCase);
  private deleteUC = inject(DeleteProgramUseCase);
  private addEntriesUC = inject(AddProgramEntriesUseCase);
  private createScheduleUC = inject(CreateScheduleEntryUseCase);
  private listScheduleUC = inject(ListScheduleUseCase);
  private removeEntryUC = inject(RemoveProgramEntryUseCase);
  private publicationsUC = inject(ListPublicationsUseCase);
  private tokenUC = inject(GeneratePlayerTokenUseCase);
  private toast = inject(ToastService);

  programs = signal<Program[]>([]);
  publications = signal<Publication[]>([]);
  publicationsLoading = signal(false);
  publicationsLoadError = signal('');
  selected = signal<Program | null>(null);
  search = signal('');
  statusFilter = signal<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  modal = signal(false);
  modalMode = signal<'edit' | 'add'>('edit');
  selectedPublicationIds = signal<number[]>([]);
  publicationSearch = signal('');
  publicationTypeFilter = signal<'ALL' | Publication['type']>('ALL');
  selectedOnly = signal(false);
  schedules = signal<Record<number, PublicationScheduleInput>>({});
  scheduledScheduleKeys = signal<string[]>([]);
  entriesAdded = signal(false);
  reviewingEntries = signal(false);
  previewOpen = signal(false);
  scheduleProgress = signal({ completed: 0, total: 0 });
  today = currentBusinessDate();
  currentBusinessTime = signal(currentBusinessTime());
  name = '';
  saving = signal(false);
  generatingToken = signal(false);
  error = signal('');
  pendingDeletion = signal<Program | null>(null);
  pendingTokenRenewal = signal(false);
  deleteError = signal('');
  deleting = signal(false);
  programSchedules = signal<ScheduleEntry[]>([]);
  programScheduleLoading = signal(false);
  programScheduleError = signal('');
  private publicationsLoaded = false;
  activeCount = computed(() => this.programs().filter(program => program.active).length);
  entryCount = computed(() => this.programs().reduce((count, program) => count + program.entries.length, 0));
  previewItems = computed<ProgramPreviewItem[]>(() => (this.selected()?.entries ?? []).map(entry => this.previewItem(entry)));
  upcomingSchedules = computed(() => this.programSchedules()
    .filter(entry => entry.date > this.today || (entry.date === this.today && entry.endTime > this.currentBusinessTime()))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
  reviewScheduleCount = computed(() => this.selectedPublicationIds().reduce((count, id) =>
    count + this.datesFor(id).filter(date => !this.scheduledScheduleKeys().includes(this.scheduleKey(id, date))).length, 0));
  filteredPrograms = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.programs().filter(program =>
      program.name.toLocaleLowerCase().includes(query) &&
      (status === 'ALL' || program.active === (status === 'ACTIVE')),
    );
  });
  availablePublications = computed(() => {
    const assigned = new Set(this.selected()?.entries.map(entry => entry.publicationId) ?? []);
    const retryingSelection = new Set(this.entriesAdded() ? this.selectedPublicationIds() : []);
    return this.publications().filter(publication =>
      publication.status === 'READY' && (!assigned.has(publication.id) || retryingSelection.has(publication.id)),
    );
  });
  filteredAvailablePublications = computed(() => {
    const query = this.publicationSearch().trim().toLocaleLowerCase();
    const type = this.publicationTypeFilter();
    const selectedOnly = this.selectedOnly();
    return this.availablePublications().filter(publication =>
      (!query || publication.title.toLocaleLowerCase().includes(query)) &&
      (type === 'ALL' || publication.type === type) &&
      (!selectedOnly || this.selectedPublicationIds().includes(publication.id)),
    );
  });
  playerToken = computed(() => this.auth.user()?.playerToken ?? null);
  schedulesValid = computed(() => this.selectedPublicationIds().every(id => {
    if (this.scheduleComplete(id)) return true;
    const schedule = this.scheduleFor(id);
    return datesBetweenInclusive(schedule.date, schedule.endDate).length > 0 && schedule.date >= this.today &&
      !!schedule.startTime && !!schedule.endTime &&
      toMinutes(schedule.endTime) > toMinutes(schedule.startTime);
  }));

  ngOnInit(): void {
    this.loadPublications();
    this.load();
  }

  loadPublications(): void {
    if (this.publicationsLoading() || this.publicationsLoaded) return;
    this.publicationsLoading.set(true);
    this.publicationsLoadError.set('');
    this.publicationsUC.execute().subscribe({
      next: publications => {
        this.publications.set(publications);
        this.publicationsLoaded = true;
        this.publicationsLoading.set(false);
      },
      error: error => {
        this.publicationsLoadError.set(errorMessage(error));
        this.publicationsLoading.set(false);
      },
    });
  }

  load(): void {
    this.listUC.execute().subscribe({
      next: programs => {
        const ownerId = this.auth.user()?.id;
        const ownedPrograms = programs.filter(program => program.createdById === ownerId);
        this.programs.set(ownedPrograms);
        const requestedProgramId = Number(this.route.snapshot.queryParamMap.get('programId'));
        const selected = this.selected();
        const target = ownedPrograms.find(program => program.id === requestedProgramId)
          ?? (selected ? ownedPrograms.find(program => program.id === selected.id) : undefined);
        this.selected.set(target ?? null);
        if (target) this.loadProgramSchedule(target.id);
        else this.programSchedules.set([]);
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  select(program: Program): void {
    this.selected.set(program);
    this.loadProgramSchedule(program.id);
    if (this.route.snapshot.queryParamMap.has('programId')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { programId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }
  typeName(type: string): string { return type === 'IMAGE' ? 'Imagem' : type === 'VIDEO' ? 'Vídeo' : type === 'MESSAGE' ? 'Mensagem' : 'Link'; }
  programSummary(program: Program): string {
    const titles = program.entries.slice(0, 2).map(entry => entry.publicationTitle);
    if (!titles.length) return 'Nenhum conteúdo na sequência';
    return titles.length < program.entries.length ? `${titles.join(' · ')} · +${program.entries.length - titles.length}` : titles.join(' · ');
  }
  duration(entry: Program['entries'][number]): number {
    if (entry.publicationType === 'VIDEO') return Math.min(entry.displaySeconds ?? entry.originalDurationSeconds ?? 10, entry.originalDurationSeconds ?? 10);
    return entry.displaySeconds ?? 10;
  }
  private previewItem(entry: Program['entries'][number]): ProgramPreviewItem {
    const schedule = this.upcomingSchedules().find(item => item.publicationId === entry.publicationId);
    return {
      title: entry.publicationTitle,
      type: entry.publicationType,
      content: entry.publicationContent,
      mediaId: entry.mediaFileId,
      linkUrl: entry.linkUrl,
      seconds: schedule ? Math.min(this.duration(entry), schedule.turnSeconds ?? this.duration(entry)) : this.duration(entry),
      schedule: schedule ? `${this.formatDate(schedule.date)} · ${schedule.startTime}–${schedule.endTime}` : undefined,
    };
  }
  playerUrl(token: string, programId: number): string { return `${location.origin}/player/${token}/program/${programId}`; }

  openCreate(): void {
    this.router.navigate(['/programacao/nova']);
  }

  openEdit(program: Program): void {
    this.modalMode.set('edit');
    this.name = program.name;
    this.error.set('');
    this.modal.set(true);
  }

  openAddEntries(): void {
    this.loadPublications();
    this.modalMode.set('add');
    this.selectedPublicationIds.set([]);
    this.publicationSearch.set('');
    this.publicationTypeFilter.set('ALL');
    this.selectedOnly.set(false);
    this.schedules.set({});
    this.scheduledScheduleKeys.set([]);
    this.entriesAdded.set(false);
    this.reviewingEntries.set(false);
    this.error.set('');
    this.modal.set(true);
  }

  hasPublicationFilters(): boolean {
    return !!this.publicationSearch().trim() || this.publicationTypeFilter() !== 'ALL' || this.selectedOnly();
  }

  clearPublicationFilters(): void {
    this.publicationSearch.set('');
    this.publicationTypeFilter.set('ALL');
    this.selectedOnly.set(false);
  }

  closeModal(): void {
    if (this.saving() || (this.modalMode() === 'add' && this.entriesAdded() &&
      !this.selectedPublicationIds().every(id => this.scheduleComplete(id)))) return;
    this.modal.set(false);
  }

  saveProgram(): void {
    const current = this.selected();
    this.saving.set(true);
    const request = current ? this.updateUC.execute(current.id, { name: this.name.trim() }) : null;
    if (!request) { this.saving.set(false); return; }
    request.subscribe({
      next: program => {
        this.saving.set(false);
        this.modal.set(false);
        this.selected.set(program);
        this.toast.show('Programação atualizada');
        this.load();
      },
      error: error => { this.saving.set(false); this.error.set(errorMessage(error)); },
    });
  }

  toggle(program: Program): void {
    this.updateUC.execute(program.id, { active: !program.active }).subscribe({
      next: updated => { this.selected.set(updated); this.toast.show(updated.active ? 'Programação ativada' : 'Programação pausada'); this.load(); },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  togglePublication(id: number, event: Event): void {
    if (this.entriesAdded()) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPublicationIds.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
    this.schedules.update(schedules => {
      if (checked) {
        return { ...schedules, [id]: schedules[id] ?? this.defaultPublicationSchedule() };
      }
      const { [id]: _removed, ...remaining } = schedules;
      return remaining;
    });
  }

  scheduleFor(id: number): PublicationScheduleInput {
    return this.schedules()[id] ?? { date: '', endDate: '', startTime: '', endTime: '' };
  }

  private defaultPublicationSchedule(): PublicationScheduleInput {
    let startMinute = toMinutes(currentBusinessTime());
    let endMinute = startMinute + 60;
    if (endMinute > 1440) {
      startMinute = 1380;
      endMinute = 1440;
    }
    const formatTime = (minute: number) => minute === 1440
      ? '24:00'
      : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    return {
      date: this.today,
      endDate: this.today,
      startTime: formatTime(startMinute),
      endTime: formatTime(endMinute),
    };
  }

  datesFor(id: number): string[] {
    const schedule = this.scheduleFor(id);
    return datesBetweenInclusive(schedule.date, schedule.endDate);
  }

  scheduledCount(id: number): number {
    return this.datesFor(id).filter(date => this.scheduledScheduleKeys().includes(this.scheduleKey(id, date))).length;
  }

  scheduleComplete(id: number): boolean {
    const dates = this.datesFor(id);
    return dates.length > 0 && this.scheduledCount(id) === dates.length;
  }

  updateSchedule(id: number, field: keyof PublicationScheduleInput, value: string): void {
    this.schedules.update(schedules => ({
      ...schedules,
      [id]: { ...this.scheduleFor(id), [field]: value },
    }));
  }

  saveEntries(): void {
    const program = this.selected();
    if (!program) return;
    this.error.set('');
    this.reviewingEntries.set(true);
  }

  confirmSaveEntries(): void {
    const program = this.selected();
    if (!program) return;
    this.reviewingEntries.set(false);
    this.saving.set(true);
    if (this.entriesAdded()) {
      this.scheduleEntries(program);
      return;
    }
    this.addEntriesUC.execute(program.id, this.selectedPublicationIds()).subscribe({
      next: updated => {
        this.entriesAdded.set(true);
        this.selected.set(updated);
        this.programs.update(programs => programs.map(item => item.id === updated.id ? updated : item));
        this.scheduleEntries(updated);
      },
      error: error => { this.saving.set(false); this.error.set(errorMessage(error)); },
    });
  }

  private scheduleEntries(program: Program): void {
    const pending = this.selectedPublicationIds().flatMap(publicationId =>
      this.datesFor(publicationId)
        .filter(date => !this.scheduledScheduleKeys().includes(this.scheduleKey(publicationId, date)))
        .map(date => ({ publicationId, date })),
    );
    if (!pending.length) {
      this.finishAddingEntries();
      return;
    }

    this.scheduleProgress.set({ completed: 0, total: pending.length });
    let scheduledNow = 0;
    let activeItem = pending[0];
    from(pending).pipe(
      concatMap(({ publicationId, date }) => {
        activeItem = { publicationId, date };
        const schedule = this.scheduleFor(publicationId);
        return this.createScheduleUC.execute({
          publicationId,
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
        const title = this.publications().find(publication => publication.id === activeItem.publicationId)?.title ?? `Conteúdo ${activeItem.publicationId}`;
        const partial = scheduledNow ? ` ${scheduledNow} agendamento(s) já foram concluídos.` : '';
        this.error.set(`${errorMessage(error)} Não foi possível agendar “${title}” em ${this.formatDate(activeItem.date)}.${partial} Ajuste o período ou horário e tente concluir novamente.`);
      },
      complete: () => this.finishAddingEntries(),
    });
  }

  private finishAddingEntries(): void {
    const contents = this.selectedPublicationIds().length;
    const schedules = this.scheduledScheduleKeys().length;
    this.saving.set(false);
    this.modal.set(false);
    this.load();
    this.toast.show(`${contents} conteúdo(s) adicionados em ${schedules} agendamento(s) diário(s).`);
  }

  scheduleProgressPercent(): number {
    const { completed, total } = this.scheduleProgress();
    return total ? Math.round(completed / total * 100) : 0;
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }

  private scheduleKey(publicationId: number, date: string): string {
    return `${publicationId}:${date}`;
  }

  publicationTitle(id: number): string {
    return this.publications().find(publication => publication.id === id)?.title ?? `Conteúdo ${id}`;
  }

  scheduleSummary(id: number): string {
    const schedule = this.scheduleFor(id);
    const dates = this.datesFor(id);
    const range = dates.length
      ? `${this.formatDate(dates[0])}${dates.length > 1 ? ` a ${this.formatDate(dates[dates.length - 1])}` : ''}`
      : 'Período não definido';
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime}–${schedule.endTime}` : 'Horário não definido';
    const completed = this.scheduledCount(id);
    return `${range} · ${time}${completed ? ` · ${completed} de ${dates.length} dias concluídos` : ''}`;
  }

  removeEntry(program: Program, entryId: number): void {
    this.removeEntryUC.execute(program.id, entryId).subscribe({
      next: updated => { this.selected.set(updated); this.load(); this.toast.show('Conteúdo removido da programação'); },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  requestDelete(program: Program): void {
    this.deleteError.set('');
    this.pendingDeletion.set(program);
  }

  closeDeleteConfirmation(): void {
    if (this.deleting()) return;
    this.pendingDeletion.set(null);
    this.deleteError.set('');
  }

  confirmDelete(program: Program): void {
    this.deleting.set(true);
    this.deleteError.set('');
    this.deleteUC.execute(program.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDeletion.set(null);
        this.selected.set(null);
        this.load();
        this.toast.show('Programação excluída');
      },
      error: error => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(error));
      },
    });
  }

  generatePlayerToken(): void {
    if (this.auth.user()?.hasPlayerToken) {
      this.pendingTokenRenewal.set(true);
      return;
    }
    this.issuePlayerToken();
  }

  confirmTokenRenewal(): void {
    this.pendingTokenRenewal.set(false);
    this.issuePlayerToken();
  }

  private issuePlayerToken(): void {
    this.generatingToken.set(true);
    this.tokenUC.execute().subscribe({
      next: token => {
        this.generatingToken.set(false);
        this.auth.setPlayerToken(token);
        this.toast.show('Link renovado. Atualize o endereço em todas as TVs que usam suas programações.');
      },
      error: error => { this.generatingToken.set(false); this.error.set(errorMessage(error)); },
    });
  }

  loadProgramSchedule(programId: number): void {
    this.currentBusinessTime.set(currentBusinessTime());
    const start = this.today;
    const endDate = new Date(`${start}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 29);
    const end = endDate.toISOString().slice(0, 10);
    this.programScheduleLoading.set(true);
    this.programScheduleError.set('');
    this.listScheduleUC.execute({ from: start, to: end }).subscribe({
      next: entries => {
        this.programSchedules.set(entries.filter(entry => entry.programId === programId));
        this.programScheduleLoading.set(false);
      },
      error: error => {
        this.programSchedules.set([]);
        this.programScheduleError.set(errorMessage(error));
        this.programScheduleLoading.set(false);
      },
    });
  }

  copyPlayerUrl(programId: number): void {
    const token = this.playerToken();
    if (!token) return;
    navigator.clipboard.writeText(this.playerUrl(token, programId)).then(
      () => this.toast.show('Link copiado'),
      () => this.error.set('Não foi possível copiar o link. Selecione e copie o endereço manualmente.'),
    );
  }
}
