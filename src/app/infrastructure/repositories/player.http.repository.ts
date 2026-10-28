import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PublicationType } from '@domain/publication/publication.entity';
import { PlayerItem } from '@domain/player/player.entity';
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
  items: PlayerPlaylistItemDto[];
}

@Injectable()
export class HttpPlayerRepository extends PlayerRepository {
  private http = inject(HttpClient);

  playlist(token: string, programId: number): Observable<PlayerItem[]> {
    return this.http.get<PlayerPlaylistDto>(api(`/player/${token}/program/${programId}`)).pipe(
      map(res => res.items.map(item => ({
        key: String(item.entryId),
        title: item.title,
        type: item.type,
        mediaUrl: item.type === 'LINK' || !item.url ? null : new URL(item.url, api('/')).toString(),
        linkUrl: item.type === 'LINK' ? item.url : null,
        seconds: item.seconds,
      }))),
    );
  }
}
