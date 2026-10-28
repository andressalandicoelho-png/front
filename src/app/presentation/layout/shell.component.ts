import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthState } from '@presentation/core/auth.state';
import { IconComponent } from '@presentation/ui/icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()" [style.--sidebar-width.px]="layoutSidebarWidth()">
      <aside class="side">
        <div class="sidebar-header">
          <a class="brand" routerLink="/calendario" aria-label="Office Total, calendário">
            <span class="brand-mark"><app-icon name="briefcase" [size]="20"/></span>
            <span class="brand-name">Office Total</span>
          </a>
          <button class="sidebar-toggle" type="button" [attr.aria-expanded]="!sidebarCollapsed()" aria-label="Recolher ou expandir barra lateral" (click)="toggleSidebar()">
            <app-icon [name]="sidebarCollapsed() ? 'right' : 'left'" [size]="16"/>
          </button>
        </div>
        <nav class="nav">
          @for (item of items(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item" [attr.aria-label]="item.label" [attr.title]="sidebarCollapsed() ? item.label : null">
              <app-icon [name]="item.icon" [size]="20"/><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <a class="account-link" routerLink="/perfil" routerLinkActive="active" [attr.title]="sidebarCollapsed() ? auth.user()?.name : null">
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
  private readonly sidebarWidthStorageKey = 'office-total.sidebar-width';
  private readonly sidebarCollapsedStorageKey = 'office-total.sidebar-collapsed';
  private resizingSidebar = false;
  sidebarWidth = signal(this.loadSidebarWidth());
  sidebarCollapsed = signal(localStorage.getItem(this.sidebarCollapsedStorageKey) === 'true');
  layoutSidebarWidth = computed(() => this.sidebarCollapsed() ? 68 : this.sidebarWidth());

  items = () => [
    { path: '/calendario', label: 'Calendário', icon: 'calendar' },
    { path: '/publicacoes', label: 'Conteúdos', icon: 'document' },
    { path: '/programacao', label: 'Programação', icon: 'layers' },
    { path: '/relatorios', label: 'Relatórios', icon: 'chart' },
    ...(this.auth.isAdmin() ? [{ path: '/usuarios', label: 'Usuários', icon: 'users' }] : []),
  ];

  toggleSidebar(): void {
    const collapsed = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(collapsed);
    localStorage.setItem(this.sidebarCollapsedStorageKey, String(collapsed));
  }

  startSidebarResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
      this.sidebarWidth.set(240);
      localStorage.setItem(this.sidebarCollapsedStorageKey, 'false');
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
      localStorage.setItem(this.sidebarCollapsedStorageKey, 'false');
    }
    const step = event.shiftKey ? 24 : 8;
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

  private loadSidebarWidth(): number {
    const savedWidth = Number(localStorage.getItem(this.sidebarWidthStorageKey));
    return Number.isFinite(savedWidth) && savedWidth >= 180 && savedWidth <= 360 ? savedWidth : 240;
  }

  private saveSidebarWidth(): void {
    localStorage.setItem(this.sidebarWidthStorageKey, String(this.sidebarWidth()));
  }
}
