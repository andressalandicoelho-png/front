import { Routes } from '@angular/router';
import { adminGuard, authGuard } from '@presentation/core/guards';

const loadRouteComponent = <TModule, TComponent>(
  loadModule: () => Promise<TModule>,
  selectComponent: (module: TModule) => TComponent,
): (() => Promise<TComponent>) => async () => selectComponent(await loadModule());

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: loadRouteComponent(
      () => import('@presentation/pages/login.page'),
      module => module.LoginPage,
    ),
  },
  {
    path: 'player/:token/program/:programId',
    loadComponent: loadRouteComponent(
      () => import('@presentation/pages/player.page'),
      module => module.PlayerPage,
    ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: loadRouteComponent(
      () => import('@presentation/layout/shell.component'),
      module => module.ShellComponent,
    ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendario' },
      { path: 'inicio', pathMatch: 'full', redirectTo: 'calendario' },
      {
        path: 'calendario',
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/calendar.page'),
          module => module.CalendarPage,
        ),
      },
      {
        path: 'publicacoes',
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/publications.page'),
          module => module.PublicationsPage,
        ),
      },
      {
        path: 'programacao',
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/programs.page'),
          module => module.ProgramsPage,
        ),
      },
      {
        path: 'programacao/nova',
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/create-program.page'),
          module => module.CreateProgramPage,
        ),
      },
      {
        path: 'relatorios',
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/reports.page'),
          module => module.ReportsPage,
        ),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/users.page'),
          module => module.UsersPage,
        ),
      },
      {
        path: 'perfil',
        loadComponent: loadRouteComponent(
          () => import('@presentation/pages/profile.page'),
          module => module.ProfilePage,
        ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
