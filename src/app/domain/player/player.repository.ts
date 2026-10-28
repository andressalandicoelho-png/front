import { Observable } from 'rxjs';
import { PlayerItem } from './player.entity';

export abstract class PlayerRepository {
  abstract playlist(token: string, programId: number): Observable<PlayerItem[]>;
}
