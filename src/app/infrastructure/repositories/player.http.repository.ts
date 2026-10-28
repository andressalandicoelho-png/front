import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PublicationType } from '@domain/publication/publication.entity';
import { PlayerItem, PlayerPlaylist } from '@domain/player/player.entity';
import { PlayerRepository } from '@domain/player/player.repository';
import { api } from '../http/api';

interface PlayerPlaylistItemDto {
  entryId: number;
  title: string;
  type: PublicationType;
  seconds: number;
  url: string | null;
}

interface PlayerPlaylistDto {
  program: { id: number; name: string; active: boolean };
  timezone: string;
  pollSeconds: number;
  items: PlayerPlaylistItemDto[];
}

@Injectable()
export class HttpPlayerRepository extends PlayerRepository {
  private http = inject(HttpClient);

  playlist(token: string, programId: number): Observable<PlayerPlaylist> {
    return this.http.get<PlayerPlaylistDto>(api(`/player/${token}/program/${programId}`)).pipe(
      map(res => ({
        program: res.program,
        timezone: res.timezone,
        pollSeconds: res.pollSeconds,
        items: res.items.map(item => ({
          key: String(item.entryId),
          title: item.title,
          type: item.type,
          mediaUrl: item.type === 'LINK' || !item.url ? null : new URL(item.url, api('/')).toString(),
          linkUrl: item.type === 'LINK' ? item.url : null,
          seconds: item.seconds,
        })),
      })),
    );
  }
}
