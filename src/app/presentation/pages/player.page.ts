import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LoadPlayerPlaylistUseCase } from '@application/player/player.usecases';
import { PlayerItem, PlayerPlaylist } from '@domain/player/player.entity';

const DEFAULT_REFRESH_MS = 60_000;
const IDLE_RETRY_MS = 5_000;

/**
 * Player de TV: busca uma programação e reproduz seus conteúdos em sequência contínua.
 * Sem conteúdo → tela de espera.
 * Se a conexão cair, continua com a última programação carregada.
 */
@Component({
  selector: 'app-player',
  imports: [DatePipe],
  template: `
    <div class="player">
      @if (programName()) {
        <div class="player-status">
          <strong>{{ programName() }}</strong>
          <span [class.disconnected]="!connected() || !programActive()">{{ !connected() ? 'Conexão interrompida · tentando reconectar' : programActive() ? 'Player conectado' : 'Programação pausada' }}</span>
          @if (lastUpdated()) { <small>Atualizado {{ lastUpdated() | date:'HH:mm:ss' }}</small> }
        </div>
      }
      @if (current(); as item) {
        @switch (item.type) {
          @case ('IMAGE') { <img [src]="item.mediaUrl!" [alt]="item.title"> }
          @case ('VIDEO') { <video [src]="item.mediaUrl!" autoplay muted playsinline></video> }
          @case ('LINK') { <iframe [src]="safe(item)" title="Conteúdo"></iframe> }
        }
      } @else {
        <div class="player-idle">
          <span class="brand-mark big">TV</span>
          <p>{{ !connected() ? 'Não foi possível conectar ao player' : !programActive() ? 'Esta programação está pausada' : 'Sem conteúdo programado neste horário' }}</p>
          @if (programName()) { <small>{{ programName() }}</small> }
          <button type="button" class="player-retry" (click)="refresh()">Tentar novamente</button>
        </div>
      }
    </div>`,
})
export class PlayerPage implements OnInit, OnDestroy {
  token = input.required<string>();
  programId = input.required<string>();

  private usecase = inject(LoadPlayerPlaylistUseCase);
  private sanitizer = inject(DomSanitizer);

  current = signal<PlayerItem | null>(null);
  programName = signal('');
  programActive = signal(true);
  connected = signal(false);
  lastUpdated = signal<Date | null>(null);
  private playlist: PlayerItem[] = [];
  private advanceTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private refreshMs = DEFAULT_REFRESH_MS;

  ngOnInit(): void {
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), this.refreshMs);
  }

  ngOnDestroy(): void {
    clearTimeout(this.advanceTimer);
    clearInterval(this.refreshTimer);
  }

  safe(item: PlayerItem): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(item.linkUrl ?? '');
  }

  refresh(): void {
    this.usecase.execute(this.token(), Number(this.programId())).subscribe({
      next: (result: PlayerPlaylist) => {
        this.programName.set(result.program.name);
        this.programActive.set(result.program.active);
        this.playlist = result.items;
        this.connected.set(true);
        this.lastUpdated.set(new Date());
        const nextRefreshMs = Math.max(IDLE_RETRY_MS, result.pollSeconds * 1000);
        if (nextRefreshMs !== this.refreshMs) {
          this.refreshMs = nextRefreshMs;
          if (this.refreshTimer) clearInterval(this.refreshTimer);
          this.refreshTimer = setInterval(() => this.refresh(), this.refreshMs);
        }
        if (!result.items.length) {
          this.current.set(null);
          this.advance();
        } else if (!this.current() || !result.items.some(item => item.key === this.current()?.key)) {
          this.advance();
        }
      },
      error: () => {
        this.connected.set(false);
        if (!this.playlist.length) this.current.set(null);
        this.refreshMs = IDLE_RETRY_MS;
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.refresh(), this.refreshMs);
      },
    });
  }

  private advance(): void {
    clearTimeout(this.advanceTimer);
    if (!this.playlist.length) {
      this.current.set(null);
      this.advanceTimer = setTimeout(() => this.advance(), IDLE_RETRY_MS);
      return;
    }
    const at = this.playlist.findIndex(i => i.key === this.current()?.key);
    const next = this.playlist[(at + 1) % this.playlist.length];
    this.current.set(next);
    this.advanceTimer = setTimeout(() => this.advance(), next.seconds * 1000);
  }
}
