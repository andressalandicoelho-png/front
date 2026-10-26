import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthState } from '@presentation/core/auth.state';
import { IconComponent } from '@presentation/ui/icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell">
      <aside class="side">
        <a class="brand" routerLink="/inicio"><span class="brand-mark">TV</span><span class="brand-name">Campus</span></a>
        <nav class="nav">
          @for (item of items(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
              <app-icon [name]="item.icon" [size]="26"/><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <button class="nav-item logout" type="button" (click)="auth.logout()">
          <app-icon name="logout" [size]="26"/><span>Sair</span>
        </button>
      </aside>
      <main class="main"><router-outlet /></main>
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthState);

  items = () => [
    { path: '/inicio', label: 'Início', icon: 'home' },
    { path: '/calendario', label: 'Calendário', icon: 'calendar' },
    { path: '/publicacoes', label: 'Publicações', icon: 'image' },
    { path: '/post', label: 'POST', icon: 'plus' },
    { path: '/canais', label: 'Canais', icon: 'tv' },
    ...(this.auth.isAdmin() ? [{ path: '/usuarios', label: 'Usuários', icon: 'users' }] : []),
    { path: '/perfil', label: 'Perfil', icon: 'user' },
  ];
}
