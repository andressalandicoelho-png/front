import { Observable } from 'rxjs';
import { PlayerPlaylist } from './player.entity';

export abstract class PlayerRepository {
  abstract playlist(token: string, programId: number): Observable<PlayerPlaylist>;
}
