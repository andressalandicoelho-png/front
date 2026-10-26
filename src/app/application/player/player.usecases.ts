import { Injectable, inject } from '@angular/core';
import { PlayerRepository } from '@domain/player/player.repository';

@Injectable({ providedIn: 'root' })
export class LoadPlayerPlaylistUseCase {
  private repo = inject(PlayerRepository);
  execute(token: string, channelId: number) { return this.repo.playlist(token, channelId); }
}
