import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DEFAULT_DISPLAY_SECONDS } from '@domain/publication/publication.entity';
import { PlayerItem } from '@domain/player/player.entity';
import { PlayerRepository } from '@domain/player/player.repository';
import { api } from '../http/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Injectable()
export class HttpPlayerRepository extends PlayerRepository {
  private http = inject(HttpClient);

  /**
   * GET /player/:token/:channelId é público. O formato exato da resposta não estava no contrato,
   * então o mapeamento aceita uma lista pura ou um objeto com items/schedule/publications.
   * Ajuste `toItem` se o backend usar outros nomes.
   */
  playlist(token: string, channelId: number): Observable<PlayerItem[]> {
    return this.http.get<any>(api(`/player/${token}/${channelId}`)).pipe(
      map(res => {
        const list: any[] = Array.isArray(res) ? res : res.items ?? res.schedule ?? res.publications ?? [];
        return list.map((r, i) => this.toItem(token, r, i));
      }),
    );
  }

  private toItem(token: string, r: any, index: number): PlayerItem {
    const pub = r.publication ?? r;
    const mediaId = pub.mediaId ?? r.mediaId ?? pub.media?.id ?? pub.id;
    const type = pub.type ?? r.type;
    const mediaPath = r.mediaUrl ?? r.url;
    return {
      key: `${r.id ?? pub.id}-${index}`,
      title: pub.title ?? '',
      type,
      mediaUrl: type === 'LINK' ? null : mediaPath
        ? new URL(mediaPath, api('/')).toString()
        : api(`/player/${token}/media/${mediaId}`),
      linkUrl: pub.linkUrl ?? r.linkUrl ?? (type === 'LINK' ? r.url : null),
      seconds: r.turnSeconds ?? pub.displaySeconds ?? r.displaySeconds ?? DEFAULT_DISPLAY_SECONDS,
      date: r.date ? String(r.date).slice(0, 10) : undefined,
      startTime: r.startTime ? String(r.startTime).slice(0, 5) : undefined,
      endTime: r.endTime ? String(r.endTime).slice(0, 5) : undefined,
    };
  }
}
