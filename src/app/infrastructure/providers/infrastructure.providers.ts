import { Provider } from '@angular/core';
import { AuthRepository, SessionStore } from '@domain/auth/auth.repository';
import { ChannelRepository } from '@domain/channel/channel.repository';
import { MediaRepository } from '@domain/media/media.repository';
import { PlayerRepository } from '@domain/player/player.repository';
import { PublicationRepository } from '@domain/publication/publication.repository';
import { ScheduleRepository } from '@domain/schedule/schedule.repository';
import { UserRepository } from '@domain/user/user.repository';
import { LocalSessionStore } from '../http/session.store';
import { HttpAuthRepository } from '../repositories/auth.http.repository';
import { HttpChannelRepository } from '../repositories/channel.http.repository';
import { HttpMediaRepository } from '../repositories/media.http.repository';
import { HttpPlayerRepository } from '../repositories/player.http.repository';
import { HttpPublicationRepository } from '../repositories/publication.http.repository';
import { HttpScheduleRepository } from '../repositories/schedule.http.repository';
import { HttpUserRepository } from '../repositories/user.http.repository';

/** Composição: liga as portas do domínio às implementações HTTP (inversão de dependência). */
export const infrastructureProviders: Provider[] = [
  { provide: SessionStore, useClass: LocalSessionStore },
  { provide: AuthRepository, useClass: HttpAuthRepository },
  { provide: UserRepository, useClass: HttpUserRepository },
  { provide: ChannelRepository, useClass: HttpChannelRepository },
  { provide: PublicationRepository, useClass: HttpPublicationRepository },
  { provide: ScheduleRepository, useClass: HttpScheduleRepository },
  { provide: MediaRepository, useClass: HttpMediaRepository },
  { provide: PlayerRepository, useClass: HttpPlayerRepository },
];
