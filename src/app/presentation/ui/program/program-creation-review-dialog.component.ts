import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../shared/modal.component';
import { ProgramPreviewItem } from '@presentation/models/program-preview-item';

@Component({
  selector: 'app-program-creation-review-dialog',
  imports: [ModalComponent],
  template: `
    @if (open()) {
      <app-modal title="Revise antes de criar" (closed)="closed.emit()">
        <div class="program-review">
          <p class="muted">Confirme a sequência e os períodos. Se falhar, os períodos concluídos serão mantidos e você poderá retomar.</p>
          <div class="program-review-heading">
            <strong>{{ name() }}</strong>
            <span>{{ contentCount() }} conteúdos · {{ scheduledCount() }} dias agendados</span>
          </div>
          @if (items().length) {
            <ol class="program-review-list">
              @for (item of items(); track $index; let index = $index) {
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
            <button class="btn" type="button" (click)="closed.emit()">Voltar e revisar</button>
            <button class="btn primary" type="button" [disabled]="saving()" (click)="confirmed.emit()">
              @if (saving()) {
                Criando…
              } @else if (contentCount()) {
                Confirmar programação
              } @else {
                Criar sem conteúdos
              }
            </button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ProgramCreationReviewDialogComponent {
  readonly open = input(false);
  readonly name = input.required<string>();
  readonly items = input.required<ProgramPreviewItem[]>();
  readonly contentCount = input.required<number>();
  readonly scheduledCount = input.required<number>();
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly confirmed = output<void>();
}
