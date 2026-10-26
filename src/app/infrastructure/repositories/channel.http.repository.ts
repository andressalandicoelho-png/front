import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Channel, ChannelChanges, NewChannel } from '@domain/channel/channel.entity';
import { ChannelRepository } from '@domain/channel/channel.repository';
import { api } from '../http/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toChannel = (r: any): Channel => ({
  id: r.id, name: r.name, description: r.description ?? null, active: r.active ?? true,
});

@Injectable()
export class HttpChannelRepository extends ChannelRepository {
  private http = inject(HttpClient);

  list(): Observable<Channel[]> { return this.http.get<any[]>(api('/channels')).pipe(map(l => l.map(toChannel))); }
  create(input: NewChannel): Observable<Channel> { return this.http.post<any>(api('/channels'), input).pipe(map(toChannel)); }
  update(id: number, changes: ChannelChanges): Observable<Channel> {
    return this.http.patch<any>(api(`/channels/${id}`), changes).pipe(map(toChannel));
  }
}
