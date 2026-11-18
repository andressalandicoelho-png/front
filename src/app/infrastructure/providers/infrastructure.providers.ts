import { Provider } from '@angular/core';
import { AuthRepository, ProgramPlayerTokenStore, SessionStore } from '@domain/auth/auth.repository';
import { MediaRepository } from '@domain/media/media.repository';
import { PlayerRepository } from '@domain/player/player.repository';
import { PublicationRepository } from '@domain/publication/publication.repository';
import { ScheduleRepository } from '@domain/schedule/schedule.repository';
import { UserRepository } from '@domain/user/user.repository';
import { ProgramRepository } from '@domain/program/program.repository';
import { ReportRepository } from '@domain/report/report.repository';
import { SidebarPreferencesStore } from '@domain/preferences/sidebar-preferences.store';
import { LocalSessionStore } from '../http/session.store';
import { LocalProgramPlayerTokenStore } from '../http/program-player-token.store';
import { LocalSidebarPreferencesStore } from '../storage/sidebar-preferences.store';
import { HttpAuthRepository } from '../repositories/auth.http.repository';
import { HttpMediaRepository } from '../repositories/media.http.repository';
import { HttpPlayerRepository } from '../repositories/player.http.repository';
import { HttpPublicationRepository } from '../repositories/publication.http.repository';
import { HttpScheduleRepository } from '../repositories/schedule.http.repository';
import { HttpUserRepository } from '../repositories/user.http.repository';
import { HttpProgramRepository } from '../repositories/program.http.repository';
import { HttpReportRepository } from '../repositories/report.http.repository';

/** Composição: liga as portas do domínio às implementações HTTP (inversão de dependência). */
export const infrastructureProviders: Provider[] = [
  { provide: SessionStore, useClass: LocalSessionStore },
  { provide: ProgramPlayerTokenStore, useClass: LocalProgramPlayerTokenStore },
  { provide: SidebarPreferencesStore, useClass: LocalSidebarPreferencesStore },
  { provide: AuthRepository, useClass: HttpAuthRepository },
  { provide: UserRepository, useClass: HttpUserRepository },
  { provide: PublicationRepository, useClass: HttpPublicationRepository },
  { provide: ScheduleRepository, useClass: HttpScheduleRepository },
  { provide: MediaRepository, useClass: HttpMediaRepository },
  { provide: PlayerRepository, useClass: HttpPlayerRepository },
  { provide: ProgramRepository, useClass: HttpProgramRepository },
  { provide: ReportRepository, useClass: HttpReportRepository },
];
