import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AddProgramEntriesUseCase, CreateProgramUseCase } from '@application/program/program.usecases';
import { ListPublicationsUseCase } from '@application/publication/publication.usecases';
import { Program } from '@domain/program/program.entity';
import { Publication } from '@domain/publication/publication.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';
import { SecureMediaComponent } from '@presentation/ui/secure-media.component';

@Component({
  selector: 'app-create-program',
  imports: [FormsModule, RouterLink, IconComponent, SecureMediaComponent],
  template: `
    <header class="page-head">
      <a class="program-breadcrumb" routerLink="/programacao">Programação / Nova programação</a>
      <h1>Criar programação</h1>
      <p class="muted">Escolha um nome e organize os conteúdos que a TV vai reproduzir continuamente.</p>
    </header>

    @if (error()) { <div class="notice error-notice" role="alert">{{ error() }}</div> }
    @if (createdProgram(); as created) {
      <div class="notice program-created-notice" role="status">
        <strong>“{{ created.name }}” já foi criada.</strong>
        <span>Não foi possível vincular os conteúdos. Tente novamente para concluir.</span>
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
              <p class="muted">A ordem abaixo será a sequência de reprodução. Use as setas para reorganizar.</p>
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

          <p class="program-sequence-note">A TV repetirá esta sequência do início ao fim. Os horários do calendário não alteram a programação da TV.</p>
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
          </div>
        </section>
        <div class="program-create-info">
          <app-icon name="info" [size]="18"/>
          <p>Depois de criar, você poderá gerar o link exclusivo desta programação para abrir na TV.</p>
        </div>
      </aside>

      <footer class="program-create-footer">
        <a class="btn" routerLink="/programacao">Cancelar</a>
        <button class="btn primary" type="submit" [disabled]="saving() || (!createdProgram() && (name.trim().length < 2 || !selectedPublications().length))">
          {{ saving() ? 'Salvando…' : createdProgram() ? 'Tentar novamente' : 'Criar programação' }}
        </button>
      </footer>
    </form>
  `,
})
export class CreateProgramPage implements OnInit {
  private readonly listPublications = inject(ListPublicationsUseCase);
  private readonly createProgram = inject(CreateProgramUseCase);
  private readonly addProgramEntries = inject(AddProgramEntriesUseCase);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  name = '';
  query = '';
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  createdProgram = signal<Program | null>(null);
  readyPublications = signal<Publication[]>([]);
  selectedPublicationIds = signal<number[]>([]);

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

  selectedIndex(publicationId: number): number {
    return this.selectedPublicationIds().indexOf(publicationId) + 1;
  }

  togglePublication(publicationId: number): void {
    this.selectedPublicationIds.update(ids => ids.includes(publicationId)
      ? ids.filter(id => id !== publicationId)
      : [...ids, publicationId]);
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
    const existing = this.createdProgram();
    if (existing) {
      this.addEntries(existing);
      return;
    }
    const name = this.name.trim();
    const publicationIds = this.selectedPublicationIds();
    if (name.length < 2 || !publicationIds.length) return;

    this.saving.set(true);
    this.error.set('');
    this.createProgram.execute(name).subscribe({
      next: program => {
        this.createdProgram.set(program);
        this.addEntries(program);
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
        this.saving.set(false);
        this.toast.show('Programação criada com os conteúdos selecionados');
        this.router.navigate(['/programacao'], { queryParams: { programId: updatedProgram.id } });
      },
      error: error => {
        this.saving.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
