import { Routes } from '@angular/router';
import { adminGuard, authGuard } from '@presentation/core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@presentation/pages/login.page').then(module => module.LoginPage),
  },
  {
    path: 'player/:token/program/:programId',
    loadComponent: () => import('@presentation/pages/player.page').then(module => module.PlayerPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@presentation/layout/shell.component').then(module => module.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendario' },
      { path: 'inicio', pathMatch: 'full', redirectTo: 'calendario' },
      {
        path: 'calendario',
        loadComponent: () => import('@presentation/pages/calendar.page').then(module => module.CalendarPage),
      },
      {
        path: 'publicacoes',
        loadComponent: () => import('@presentation/pages/publications.page').then(module => module.PublicationsPage),
      },
      {
        path: 'programacao',
        loadComponent: () => import('@presentation/pages/programs.page').then(module => module.ProgramsPage),
      },
      {
        path: 'programacao/nova',
        loadComponent: () => import('@presentation/pages/create-program.page').then(module => module.CreateProgramPage),
      },
      {
        path: 'relatorios',
        loadComponent: () => import('@presentation/pages/reports.page').then(module => module.ReportsPage),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('@presentation/pages/users.page').then(module => module.UsersPage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('@presentation/pages/profile.page').then(module => module.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
