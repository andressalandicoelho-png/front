import { Observable } from 'rxjs';
import { Channel, ChannelChanges, NewChannel } from './channel.entity';

export abstract class ChannelRepository {
  abstract list(): Observable<Channel[]>;
  abstract create(input: NewChannel): Observable<Channel>;
  abstract update(id: number, changes: ChannelChanges): Observable<Channel>;
}
