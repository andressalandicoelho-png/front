import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarPreferencesStore } from '@domain/preferences/sidebar-preferences.store';
import { AuthState } from '@presentation/core/auth.state';
import { IconComponent } from '@presentation/ui/shared/icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()" [style.--sidebar-width.px]="layoutSidebarWidth()">
      <aside class="side">
        <div class="sidebar-header">
          <a class="brand" routerLink="/calendario" aria-label="Office Total, calendário">
            <img class="brand-logo" src="assets/OfficeLogo.png" alt="Logo Office Total">
          </a>
          <button class="sidebar-toggle" type="button" [attr.aria-expanded]="!sidebarCollapsed()" aria-label="Recolher ou expandir barra lateral" (click)="toggleSidebar()">
            <app-icon [name]="sidebarToggleIcon()" [size]="16"/>
          </button>
        </div>
        <nav class="nav">
          @for (item of items(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" [attr.aria-label]="item.label" [attr.title]="sidebarItemTitle(item.label)">
              <app-icon [name]="item.icon" [size]="20"/><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <a class="account-link" routerLink="/perfil" routerLinkActive="active" [attr.title]="accountTitle()">
          <span class="avatar">{{ auth.user()?.name?.[0] ?? 'U' }}</span>
          <span class="account-copy">
            <strong>{{ auth.user()?.name }}</strong>
            <small>{{ auth.user()?.email }}</small>
          </span>
        </a>
      </aside>
      <div
        class="sidebar-resize-handle"
        role="separator"
        aria-label="Redimensionar barra lateral"
        aria-orientation="vertical"
        aria-valuemin="180"
        aria-valuemax="360"
        [attr.aria-valuenow]="layoutSidebarWidth()"
        [style.left.px]="layoutSidebarWidth()"
        tabindex="0"
        (pointerdown)="startSidebarResize($event)"
        (pointermove)="moveSidebarResize($event)"
        (pointerup)="stopSidebarResize($event)"
        (pointercancel)="stopSidebarResize($event)"
        (keydown)="resizeSidebarWithKeyboard($event)">
      </div>
      <main class="main"><router-outlet /></main>
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthState);
  private readonly sidebarPreferences = inject(SidebarPreferencesStore);
  private resizingSidebar = false;
  sidebarWidth = signal(this.sidebarPreferences.getWidth());
  sidebarCollapsed = signal(this.sidebarPreferences.isCollapsed());
  layoutSidebarWidth = computed(() => {
    if (this.sidebarCollapsed()) return 68;
    return this.sidebarWidth();
  });

  items = () => {
    const items = [
      { path: '/calendario', label: 'Calendário', icon: 'calendar' },
      { path: '/publicacoes', label: 'Conteúdos', icon: 'document' },
      { path: '/programacao', label: 'Programação', icon: 'layers' },
      { path: '/relatorios', label: 'Relatórios', icon: 'chart' },
    ];
    if (this.auth.isAdmin()) items.push({ path: '/usuarios', label: 'Usuários', icon: 'users' });
    return items;
  };

  sidebarToggleIcon(): string {
    if (this.sidebarCollapsed()) return 'right';
    return 'left';
  }

  sidebarItemTitle(label: string): string | null {
    if (this.sidebarCollapsed()) return label;
    return null;
  }

  accountTitle(): string | null {
    if (this.sidebarCollapsed()) return this.auth.user()?.name ?? null;
    return null;
  }

  toggleSidebar(): void {
    const collapsed = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(collapsed);
    this.sidebarPreferences.setCollapsed(collapsed);
  }

  startSidebarResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
      this.sidebarWidth.set(240);
      this.sidebarPreferences.setCollapsed(false);
    }
    this.resizingSidebar = true;
    const handle = event.currentTarget;
    if (handle instanceof HTMLElement) handle.setPointerCapture(event.pointerId);
  }

  moveSidebarResize(event: PointerEvent): void {
    if (this.resizingSidebar) this.setSidebarWidth(event.clientX);
  }

  stopSidebarResize(event: PointerEvent): void {
    if (!this.resizingSidebar) return;
    this.resizingSidebar = false;
    const handle = event.currentTarget;
    if (handle instanceof HTMLElement && handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    this.saveSidebarWidth();
  }

  resizeSidebarWithKeyboard(event: KeyboardEvent): void {
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
      this.sidebarWidth.set(240);
      this.sidebarPreferences.setCollapsed(false);
    }
    let step = 8;
    if (event.shiftKey) step = 24;
    let width: number;
    switch (event.key) {
      case 'ArrowLeft':
        width = this.sidebarWidth() - step;
        break;
      case 'ArrowRight':
        width = this.sidebarWidth() + step;
        break;
      case 'Home':
        width = 180;
        break;
      case 'End':
        width = 360;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.setSidebarWidth(width);
    this.saveSidebarWidth();
  }

  private setSidebarWidth(width: number): void {
    this.sidebarWidth.set(Math.max(180, Math.min(360, Math.round(width))));
  }

  private saveSidebarWidth(): void {
    this.sidebarPreferences.setWidth(this.sidebarWidth());
  }
}
