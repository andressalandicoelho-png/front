import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Publication } from '@domain/publication/publication.entity';
import { IconComponent } from '../shared/icon.component';
import { ProgramPublicationRowComponent } from './program-publication-row.component';

@Component({
  selector: 'app-program-create-content-panel',
  imports: [FormsModule, IconComponent, ProgramPublicationRowComponent],
  styles: [':host { display: contents; }'],
  template: `
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
            [ngModel]="name()"
            (ngModelChange)="nameChanged.emit($event)"
            minlength="2"
            maxlength="120"
            placeholder="Ex.: TV da recepção"
            required
            [disabled]="created()">
        </label>
        <small class="program-timezone-note">Horário de Brasília · GMT-3</small>
      </section>
      <section class="card program-create-card">
        <div class="program-create-card-head program-selected-head">
          <div>
            <h2>
              Conteúdos selecionados · {{ publications().length }}
              @if (publications().length === 1) { post } @else { posts }
            </h2>
          </div>
          <button class="program-add-content" type="button" [disabled]="created()" (click)="addRequested.emit()">Adicionar <span aria-hidden="true">+</span></button>
        </div>

        <div class="program-selected-list">
          @for (publication of publications(); track publication.id; let index = $index) {
            <app-program-publication-row
              [position]="index + 1"
              [title]="publication.title"
              [type]="publication.type"
              [mediaId]="publication.mediaId"
              [detailLabel]="scheduleSummaryFor()(publication)"
              [removeDisabled]="created()"
              (previewRequested)="previewRequested.emit(publication)"
              (removeRequested)="removeRequested.emit(publication)"/>
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
        <div class="program-summary-head">
          <h2>Resumo</h2>
          <span class="chip">@if (created()) { Criada } @else { Nova programação }</span>
        </div>
        <div class="program-summary-body">
          <small>{{ summaryPeriod() }}</small>
          <strong>
            {{ publications().length }} @if (publications().length === 1) { post } @else { posts } · {{ durationLabel() }}
          </strong>
          <small>{{ scheduledEntryCount() }} agendamentos concluídos</small>
          @if (publications().length) {
            <button class="btn small" type="button" (click)="previewProgramRequested.emit()">
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
  `,
})
export class ProgramCreateContentPanelComponent {
  readonly name = input.required<string>();
  readonly publications = input.required<Publication[]>();
  readonly created = input(false);
  readonly summaryPeriod = input.required<string>();
  readonly durationLabel = input.required<string>();
  readonly scheduledEntryCount = input.required<number>();
  readonly scheduleSummaryFor = input.required<(publication: Publication) => string>();
  readonly nameChanged = output<string>();
  readonly addRequested = output<void>();
  readonly previewProgramRequested = output<void>();
  readonly previewRequested = output<Publication>();
  readonly removeRequested = output<Publication>();
}
