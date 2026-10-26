import { Routes } from '@angular/router';
import { adminGuard, authGuard } from '@presentation/core/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('@presentation/pages/login.page').then(m => m.LoginPage) },
  // Rota pública usada pelas TVs: /player/:token/:channelId
  { path: 'player/:token/:channelId', loadComponent: () => import('@presentation/pages/player.page').then(m => m.PlayerPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@presentation/layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', loadComponent: () => import('@presentation/pages/dashboard.page').then(m => m.DashboardPage) },
      { path: 'calendario', loadComponent: () => import('@presentation/pages/calendar.page').then(m => m.CalendarPage) },
      { path: 'publicacoes', loadComponent: () => import('@presentation/pages/publications.page').then(m => m.PublicationsPage) },
      { path: 'post', loadComponent: () => import('@presentation/pages/publications.page').then(m => m.PublicationsPage) },
      { path: 'canais', loadComponent: () => import('@presentation/pages/channels.page').then(m => m.ChannelsPage) },
      { path: 'usuarios', canActivate: [adminGuard], loadComponent: () => import('@presentation/pages/users.page').then(m => m.UsersPage) },
      { path: 'perfil', loadComponent: () => import('@presentation/pages/profile.page').then(m => m.ProfilePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
