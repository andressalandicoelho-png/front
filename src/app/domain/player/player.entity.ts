import { PublicationType } from '../publication/publication.entity';

export interface PlayerItem {
  key: string;
  title: string;
  type: PublicationType;
  mediaUrl: string | null;
  linkUrl: string | null;
  seconds: number;
}

export interface PlayerPlaylist {
  program: { id: number; name: string; active: boolean };
  timezone: string;
  pollSeconds: number;
  items: PlayerItem[];
}
