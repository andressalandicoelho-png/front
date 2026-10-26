import { Observable } from 'rxjs';
import { PlayerItem } from './player.entity';

export abstract class PlayerRepository {
  abstract playlist(token: string, channelId: number): Observable<PlayerItem[]>;
}
