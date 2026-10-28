import { Routes } from '@angular/router';
import { adminGuard, authGuard } from '@presentation/core/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('@presentation/pages/login.page').then(m => m.LoginPage) },
  { path: 'player/:token/program/:programId', loadComponent: () => import('@presentation/pages/player.page').then(m => m.PlayerPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@presentation/layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendario' },
      { path: 'inicio', pathMatch: 'full', redirectTo: 'calendario' },
      { path: 'calendario', loadComponent: () => import('@presentation/pages/calendar.page').then(m => m.CalendarPage) },
      { path: 'publicacoes', loadComponent: () => import('@presentation/pages/publications.page').then(m => m.PublicationsPage) },
      { path: 'programacao', loadComponent: () => import('@presentation/pages/programs.page').then(m => m.ProgramsPage) },
      { path: 'programacao/nova', loadComponent: () => import('@presentation/pages/create-program.page').then(m => m.CreateProgramPage) },
      { path: 'relatorios', loadComponent: () => import('@presentation/pages/reports.page').then(m => m.ReportsPage) },
      { path: 'usuarios', canActivate: [adminGuard], loadComponent: () => import('@presentation/pages/users.page').then(m => m.UsersPage) },
      { path: 'perfil', loadComponent: () => import('@presentation/pages/profile.page').then(m => m.ProfilePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
