import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LoadPlayerPlaylistUseCase } from '@application/player/player.usecases';
import { PlayerItem } from '@domain/player/player.entity';

const REFRESH_MS = 60_000;
const IDLE_RETRY_MS = 5_000;

/**
 * Player de TV: busca uma programação e reproduz seus conteúdos em sequência contínua.
 * Sem conteúdo → tela de espera.
 * Se a conexão cair, continua com a última programação carregada.
 */
@Component({
  selector: 'app-player',
  template: `
    <div class="player">
      @if (current(); as item) {
        @switch (item.type) {
          @case ('IMAGE') { <img [src]="item.mediaUrl!" [alt]="item.title"> }
          @case ('VIDEO') { <video [src]="item.mediaUrl!" autoplay muted playsinline></video> }
          @case ('LINK') { <iframe [src]="safe(item)" title="Conteúdo"></iframe> }
        }
      } @else {
        <div class="player-idle"><span class="brand-mark big">TV</span><p>Sem conteúdo programado agora</p></div>
      }
    </div>`,
})
export class PlayerPage implements OnInit, OnDestroy {
  token = input.required<string>();
  programId = input.required<string>();

  private usecase = inject(LoadPlayerPlaylistUseCase);
  private sanitizer = inject(DomSanitizer);

  current = signal<PlayerItem | null>(null);
  private playlist: PlayerItem[] = [];
  private advanceTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.usecase.execute(this.token(), Number(this.programId())).subscribe({
      next: list => { this.playlist = list; this.advance(); },
      error: () => this.advance(),
    });
    this.refreshTimer = setInterval(() => this.refresh(), REFRESH_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.advanceTimer);
    clearInterval(this.refreshTimer);
  }

  safe(item: PlayerItem): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(item.linkUrl ?? '');
  }

  private refresh(): void {
    this.usecase.execute(this.token(), Number(this.programId())).subscribe({
      next: list => (this.playlist = list),
      error: () => { /* mantém a última programação conhecida */ },
    });
  }

  private advance(): void {
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
