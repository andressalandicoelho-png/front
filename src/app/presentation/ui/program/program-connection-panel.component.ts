import { Component, input, output } from '@angular/core';
import { Program } from '@domain/program/program.entity';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-program-connection-panel',
  imports: [IconComponent],
  template: `
    <aside class="program-connection-panel" aria-labelledby="program-connection-title">
      <header class="program-connection-heading">
        <span class="program-connection-icon"><app-icon name="tv" [size]="17"/></span>
        <h3 id="program-connection-title">Conectar à TV</h3>
      </header>
      @if (!program().active) {
        <span class="program-connection-state">Programação pausada</span>
      } @else if (!program().entries.length) {
        <span class="program-connection-state">Adicione conteúdo</span>
      } @else if (scheduleLoading()) {
        <span class="program-connection-state" role="status">Verificando agenda</span>
      } @else if (scheduleError()) {
        <span class="program-connection-state" role="alert">Agenda indisponível</span>
      }
      @if (scheduleLoading()) {
        <p class="program-connection-note" role="status">Consultando os horários dos próximos 30 dias…</p>
      } @else if (scheduleError()) {
        <p class="program-connection-note" role="alert">{{ scheduleError() }} <button class="link-button" type="button" (click)="retryRequested.emit(program().id)">Tentar novamente</button></p>
      }
      @if (playerToken(); as token) {
        <label class="program-connection-label" for="program-player-link">Link desta programação</label>
        <input id="program-player-link" class="input program-player-link" [class.copied]="copied()" aria-label="Link da programação para TV" readonly [value]="playerUrl()(token, program().id)">
        <button class="btn primary block" type="button" [disabled]="generatingToken()" (click)="copyRequested.emit(program().id)"><app-icon name="copy" [size]="15"/> Copiar link</button>
        <button class="btn block" type="button" [disabled]="generatingToken()" (click)="generateRequested.emit(program().id)">
          <app-icon name="link" [size]="15"/>
          @if (generatingToken()) { Gerando novo link… } @else { Gerar novamente }
        </button>
        <small class="program-connection-link-note">Este link abre somente {{ program().name }}. Gerar novamente substitui o link anterior desta programação.</small>
      } @else {
        <button class="btn primary block" type="button" [disabled]="generatingToken()" (click)="generateRequested.emit(program().id)">
          @if (generatingToken()) {
            Gerando link…
          } @else if (hasPlayerToken()) {
            Renovar link desta programação
          } @else {
            Gerar link desta programação
          }
        </button>
      }
      <button class="btn block" type="button" [disabled]="!program().entries.length" (click)="previewRequested.emit()"><app-icon name="tv" [size]="15"/> Ver prévia</button>
      @if (hasPlayerToken() && !playerToken()) {
        <p class="program-token-warning">Gerar outro link invalida somente o link anterior desta programação.</p>
      }
      <button class="btn block program-connection-toggle" type="button" (click)="toggleRequested.emit(program())">
        @if (program().active) { Pausar } @else { Ativar }
      </button>
    </aside>
  `,
})
export class ProgramConnectionPanelComponent {
  readonly program = input.required<Program>();
  readonly playerToken = input<string | null>(null);
  readonly hasPlayerToken = input(false);
  readonly copied = input(false);
  readonly generatingToken = input(false);
  readonly scheduleLoading = input(false);
  readonly scheduleError = input('');
  readonly playerUrl = input.required<(token: string, programId: number) => string>();
  readonly copyRequested = output<number>();
  readonly generateRequested = output<number>();
  readonly previewRequested = output<void>();
  readonly toggleRequested = output<Program>();
  readonly retryRequested = output<number>();
}
