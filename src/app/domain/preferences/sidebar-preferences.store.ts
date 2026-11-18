export abstract class SidebarPreferencesStore {
  abstract getWidth(): number;
  abstract setWidth(width: number): void;
  abstract isCollapsed(): boolean;
  abstract setCollapsed(collapsed: boolean): void;
}