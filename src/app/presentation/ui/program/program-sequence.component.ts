import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Program } from '@domain/program/program.entity';
import { IconComponent } from '../shared/icon.component';
import { ProgramPublicationRowComponent } from './program-publication-row.component';

type ProgramEntry = Program['entries'][number];

@Component({
  selector: 'app-program-sequence',
  imports: [FormsModule, IconComponent, ProgramPublicationRowComponent],
  template: `
    <section class="program-sequence" aria-label="Sequência de conteúdo">
      <label class="search-field program-sequence-search">
        <app-icon name="search" [size]="16"/>
        <input class="input" type="search" placeholder="Buscar conteúdo nesta programação" aria-label="Buscar conteúdo agendado"
          [ngModel]="search()" (ngModelChange)="search.set($event)">
      </label>
      <div class="program-sequence-table-head" aria-hidden="true">
        <span>Ordem</span><span>Conteúdo</span><span>Tipo</span><span>Visualizar</span><span>Excluir</span>
      </div>
      <div class="program-sequence-list">
        @for (item of filteredEntries(); track item.entry.id) {
          <app-program-publication-row
            [position]="item.position"
            [title]="item.entry.publicationTitle"
            [type]="item.entry.publicationType"
            [mediaId]="item.entry.mediaFileId"
            [detailLabel]="nextScheduleLabelFor()(item.entry.publicationId)"
            (previewRequested)="previewRequested.emit(item.entry)"
            (removeRequested)="removeRequested.emit(item.entry)"/>
        } @empty {
          @if (search().trim()) {
            <div class="program-sequence-empty">
              <span class="empty-icon"><app-icon name="search" [size]="22"/></span>
              <div><strong>Nenhum conteúdo encontrado</strong><p>Tente outro termo de busca.</p></div>
              <button class="link-button" type="button" (click)="search.set('')">Limpar busca</button>
            </div>
          } @else if (allEntriesExpired()) {
            <div class="program-sequence-empty">
              <span class="empty-icon"><app-icon name="layers" [size]="22"/></span>
              <div><strong>Conteúdos já exibidos</strong><p>Não há novas exibições agendadas.</p></div>
            </div>
          } @else {
            <div class="program-sequence-empty">
              <span class="empty-icon"><app-icon name="layers" [size]="22"/></span>
              <div><strong>Sequência vazia</strong><p>Adicione conteúdos publicados para definir o que esta TV deve reproduzir.</p></div>
              <button class="btn primary small" type="button" (click)="addRequested.emit()"><app-icon name="plus" [size]="15"/> Adicionar conteúdo</button>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class ProgramSequenceComponent implements OnChanges {
  readonly programId = input.required<number>();
  readonly entries = input.required<ProgramEntry[]>();
  readonly expiredPublicationIds = input<number[] | null>(null);
  readonly nextScheduleLabelFor = input.required<(publicationId: number) => string>();
  readonly allEntriesExpired = input(false);
  readonly addRequested = output<void>();
  readonly previewRequested = output<ProgramEntry>();
  readonly removeRequested = output<ProgramEntry>();
  readonly search = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['programId'] && !changes['programId'].firstChange) this.search.set('');
  }

  readonly filteredEntries = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const expiredIds = new Set(this.expiredPublicationIds() ?? []);
    return this.entries()
      .filter(entry => !expiredIds.has(entry.publicationId))
      .filter(entry => !query ||
        `${entry.publicationTitle} ${entry.publicationType} ${entry.publicationContent ?? ''}`
          .toLocaleLowerCase()
          .includes(query))
      .map((entry, index) => ({ entry, position: index + 1 }));
  });
}
