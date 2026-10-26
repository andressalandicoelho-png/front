import { PublicationType } from '../publication/publication.entity';
import { Windowed } from '../schedule/schedule.rules';

export interface PlayerItem extends Windowed {
  key: string;
  title: string;
  type: PublicationType;
  mediaUrl: string | null;
  linkUrl: string | null;
  seconds: number;
}
