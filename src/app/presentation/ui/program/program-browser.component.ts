import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Program } from '@domain/program/program.entity';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-program-browser',
  imports: [FormsModule, IconComponent],
  template: `
    <aside class="program-browser" aria-label="Lista de programações">
      <div class="program-browser-heading">
        <div><h2>Programações</h2></div>
        <button class="btn primary small" type="button" (click)="createRequested.emit()" aria-label="Criar nova programação">
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
          <button type="button" class="program-browser-item" [class.selected]="selectedId() === program.id"
            [attr.aria-current]="selectedId() === program.id" (click)="selected.emit(program)">
            <span class="program-browser-item-top">
              <strong>{{ program.name }}</strong>
              <span class="status" [class.live]="program.active">
                @if (program.active) { Ativa } @else { Pausada }
              </span>
            </span>
          </button>
        } @empty {
          <div class="program-browser-empty">
            <strong>
              @if (programs().length) { Nenhum resultado } @else { Nenhuma programação ainda }
            </strong>
            <span>
              @if (programs().length) {
                Tente outro nome ou estado.
              } @else {
                Crie uma programação para organizar o conteúdo de uma TV.
              }
            </span>
          </div>
        }
      </nav>
    </aside>
  `,
})
export class ProgramBrowserComponent {
  readonly programs = input.required<Program[]>();
  readonly selectedId = input<number | null>(null);
  readonly selected = output<Program>();
  readonly createRequested = output<void>();
  readonly search = signal('');
  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');

  readonly filteredPrograms = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.programs().filter(program =>
      program.name.toLocaleLowerCase().includes(query) &&
      (status === 'ALL' || program.active === (status === 'ACTIVE')),
    );
  });
}
