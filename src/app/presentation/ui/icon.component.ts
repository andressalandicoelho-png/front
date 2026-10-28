import { Component, computed, input } from '@angular/core';

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  tv: 'M3 7h18v13H3zM8 3l4 4 4-4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  play: 'M6 4l14 8-14 8z',
  pause: 'M8 5h3v14H8zM15 5h3v14h-3z',
  more: 'M5 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M17 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  x: 'M18 6 6 18M6 6l12 12',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01',
  check: 'm5 12 4 4L19 6',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  briefcase: 'M3 7h18v14H3zM8 7V4h8v3M3 12h18M10 12v2h4v-2',
  document: 'M6 3h9l5 5v13H6zM15 3v5h5M9 13h8M9 17h8',
  layers: 'm12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z',
};

@Component({
  selector: 'app-icon',
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" [style.width.px]="size()" [style.height.px]="size()"
      aria-hidden="true"><path [attr.d]="path()"/></svg>`,
  styles: [`:host { display: inline-flex; } svg { display: block; }`],
})
export class IconComponent {
  name = input.required<string>();
  size = input(24);
  path = computed(() => PATHS[this.name()] ?? '');
}
