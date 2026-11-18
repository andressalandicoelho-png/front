import { Injectable } from '@angular/core';
import { SidebarPreferencesStore } from '@domain/preferences/sidebar-preferences.store';

const WIDTH_KEY = 'office-total.sidebar-width';
const COLLAPSED_KEY = 'office-total.sidebar-collapsed';

@Injectable()
export class LocalSidebarPreferencesStore extends SidebarPreferencesStore {
  getWidth(): number {
    const savedWidth = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth >= 180 && savedWidth <= 360) return savedWidth;
    return 240;
  }

  setWidth(width: number): void {
    localStorage.setItem(WIDTH_KEY, String(width));
  }

  isCollapsed(): boolean {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  }

  setCollapsed(collapsed: boolean): void {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }
}