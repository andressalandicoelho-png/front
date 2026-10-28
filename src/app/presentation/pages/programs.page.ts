import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import {
  AddProgramEntriesUseCase, ListProgramsUseCase, RemoveProgramEntryUseCase, UpdateProgramUseCase,
} from '@application/program/program.usecases';
import { GeneratePlayerTokenUseCase } from '@application/user/user.usecases';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';
import { ModalComponent } from '@presentation/ui/modal.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';

@Component({
  selector: 'app-programs',
  imports: [FormsModule, IconComponent, ModalComponent, SecureMediaComponent],
  template: `
    <header class="page-head row-between">
      <div><span class="eyebrow">Conteúdos / Exibição</span><h1>Programação</h1><p class="muted">Organize conteúdos em sequência e conecte cada programação a uma TV.</p></div>
      <button class="btn primary" type="button" (click)="openCreate()"><app-icon name="plus" [size]="18"/> Criar programação</button>
    </header>

    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }
    <section class="summary-grid">
      <article class="card summary-card"><strong>{{ activeCount() }}</strong><div><span>Programações ativas</span><small>{{ programs().length - activeCount() }} pausadas</small></div></article>
      <article class="card summary-card"><strong>{{ entryCount() }}</strong><div><span>Conteúdos em sequência</span><small>Reprodução contínua na TV</small></div></article>
    </section>

    <section class="card table-card">
      <div class="card-head"><strong>Programações</strong><span class="chip">{{ programs().length }} registros</span></div>
      <div class="program-table">
        <div class="program-table-head"><span>Nome</span><span>Conteúdos</span><span>Estado</span><span>Ação</span></div>
        @for (program of programs(); track program.id) {
          <button type="button" class="program-row" [class.selected]="selected()?.id === program.id" (click)="select(program)">
            <strong>{{ program.name }}</strong>
            <span class="program-meta">{{ program.entries.length }} {{ program.entries.length === 1 ? 'conteúdo' : 'conteúdos' }}</span>
            <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span>
            <span class="program-open">Ver detalhes ›</span>
          </button>
        } @empty {
          <div class="empty"><p>Nenhuma programação criada.</p><p class="muted">Crie uma sequência para começar a exibir conteúdos na TV.</p></div>
        }
      </div>
      <div class="table-foot">{{ programs().length }} programações cadastradas</div>
    </section>

    @if (selected(); as program) {
      <section class="card program-detail">
        <div class="row-between">
          <div><small class="muted">Programação selecionada</small><h2>{{ program.name }} <span class="status" [class.live]="program.active">{{ program.active ? 'Ativa' : 'Pausada' }}</span></h2></div>
          <div class="actions">
            <button class="btn" type="button" (click)="toggle(program)">{{ program.active ? 'Pausar' : 'Ativar' }}</button>
            <button class="btn" type="button" (click)="openEdit(program)">Editar nome</button>
            <button class="btn primary" type="button" (click)="openAddEntries()"><app-icon name="plus" [size]="16"/> Adicionar conteúdo</button>
          </div>
        </div>

        <div class="program-tv-link">
          <div><strong>Link para assistir na TV</strong><small>Reproduz os conteúdos desta programação em sequência contínua.</small></div>
          @if (playerToken(); as token) {
            <div class="program-tv-actions">
              <input class="input" aria-label="Link da programação para TV" readonly [value]="playerUrl(token, program.id)">
              <button class="btn small" type="button" (click)="copyPlayerUrl(program.id)">Copiar link</button>
              <a class="btn small" [href]="playerUrl(token, program.id)" target="_blank" rel="noopener">Abrir player</a>
            </div>
          } @else {
            <button class="btn small" type="button" [disabled]="generatingToken()" (click)="generatePlayerToken()">
              {{ generatingToken() ? 'Gerando…' : auth.user()?.hasPlayerToken ? 'Gerar novo token e link' : 'Gerar link para TV' }}
            </button>
          }
        </div>
        @if (!playerToken() && auth.user()?.hasPlayerToken) {
          <p class="muted">O token anterior não pode ser recuperado. Gerar outro invalida os links de TV já emitidos.</p>
        }

        @for (entry of program.entries; track entry.id; let index = $index) {
          <div class="program-entry">
            <div class="entry-date">{{ (index + 1).toString().padStart(2, '0') }}</div>
            <div class="grow"><strong>{{ entry.publicationTitle }}</strong><div class="muted">{{ typeName(entry.publicationType) }} · {{ duration(entry) }} s</div></div>
            <button type="button" class="icon-btn danger" aria-label="Remover conteúdo da programação" (click)="removeEntry(program, entry.id)"><app-icon name="trash" [size]="18"/></button>
          </div>
        } @empty {
          <div class="empty"><p>Esta programação ainda não possui conteúdos.</p></div>
        }
      </section>
    }

    @if (modal()) {
      <app-modal [title]="modalMode() === 'edit' ? 'Editar programação' : 'Adicionar conteúdos'" (closed)="modal.set(false)">
        @if (modalMode() === 'edit') {
          <form class="stack" (ngSubmit)="saveProgram()">
            <label class="field">Nome da programação<input class="input" name="name" [(ngModel)]="name" maxlength="120" required></label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || name.trim().length < 2">Salvar alterações</button>
          </form>
        } @else {
          <form class="stack" (ngSubmit)="saveEntries()">
            <p class="muted">Selecione conteúdos publicados. A ordem selecionada define a sequência de reprodução.</p>
            <div class="entry-picker">
              @for (publication of availablePublications(); track publication.id) {
                <label class="entry-option">
                  <input type="checkbox" [checked]="selectedPublicationIds().includes(publication.id)" (change)="togglePublication(publication.id, $event)">
                  <span class="add-content-thumb"><app-secure-media [mediaId]="publication.mediaId" [type]="publication.type"/></span>
                  <span><strong>{{ publication.title }}</strong><small>{{ typeName(publication.type) }} · {{ publication.displaySeconds ?? publication.originalDurationSeconds ?? 10 }} s</small></span>
                </label>
              } @empty { <p class="muted">Não há conteúdos publicados disponíveis. Publique conteúdos na biblioteca primeiro.</p> }
            </div>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn primary block" type="submit" [disabled]="saving() || selectedPublicationIds().length === 0">Adicionar {{ selectedPublicationIds().length }} conteúdos</button>
          </form>
        }
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
  private addEntriesUC = inject(AddProgramEntriesUseCase);
  private removeEntryUC = inject(RemoveProgramEntryUseCase);
  private publicationsUC = inject(ListPublicationsUseCase);
  private tokenUC = inject(GeneratePlayerTokenUseCase);
  private toast = inject(ToastService);

  programs = signal<Program[]>([]);
  publications = signal<Publication[]>([]);
  selected = signal<Program | null>(null);
  modal = signal(false);
  modalMode = signal<'edit' | 'add'>('edit');
  selectedPublicationIds = signal<number[]>([]);
  name = '';
  saving = signal(false);
  generatingToken = signal(false);
  error = signal('');
  activeCount = computed(() => this.programs().filter(program => program.active).length);
  entryCount = computed(() => this.programs().reduce((count, program) => count + program.entries.length, 0));
  availablePublications = computed(() => {
    const assigned = new Set(this.selected()?.entries.map(entry => entry.publicationId) ?? []);
    return this.publications().filter(publication => publication.status === 'READY' && !assigned.has(publication.id));
  });
  playerToken = computed(() => this.auth.user()?.playerToken ?? null);

  ngOnInit(): void {
    this.publicationsUC.execute().subscribe({
      next: publications => this.publications.set(publications),
      error: error => this.error.set(errorMessage(error)),
    });
    this.load();
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
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  select(program: Program): void {
    this.selected.set(program);
    if (this.route.snapshot.queryParamMap.has('programId')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { programId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }
  typeName(type: string): string { return type === 'IMAGE' ? 'Imagem' : type === 'VIDEO' ? 'Vídeo' : 'Link'; }
  duration(entry: Program['entries'][number]): number {
    if (entry.publicationType === 'VIDEO') return Math.min(entry.displaySeconds ?? entry.originalDurationSeconds ?? 10, entry.originalDurationSeconds ?? 10);
    return entry.displaySeconds ?? 10;
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
    this.modalMode.set('add');
    this.selectedPublicationIds.set([]);
    this.error.set('');
    this.modal.set(true);
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
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPublicationIds.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
  }

  saveEntries(): void {
    const program = this.selected();
    if (!program) return;
    this.saving.set(true);
    this.addEntriesUC.execute(program.id, this.selectedPublicationIds()).subscribe({
      next: updated => {
        this.saving.set(false);
        this.modal.set(false);
        this.selected.set(updated);
        this.load();
        this.toast.show('Conteúdos adicionados à sequência');
      },
      error: error => { this.saving.set(false); this.error.set(errorMessage(error)); },
    });
  }

  removeEntry(program: Program, entryId: number): void {
    this.removeEntryUC.execute(program.id, entryId).subscribe({
      next: updated => { this.selected.set(updated); this.load(); this.toast.show('Conteúdo removido da programação'); },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  generatePlayerToken(): void {
    this.generatingToken.set(true);
    this.tokenUC.execute().subscribe({
      next: token => {
        this.generatingToken.set(false);
        this.auth.setPlayerToken(token);
        this.toast.show('Token gerado. Os links desta programação já podem ser usados na TV.');
      },
      error: error => { this.generatingToken.set(false); this.error.set(errorMessage(error)); },
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
