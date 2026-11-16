import type { WritableSignal } from '@angular/core';

export interface Page<T> {
  readonly items: T[];
  readonly count: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  return {
    items: items.slice(page * pageSize, (page + 1) * pageSize),
    count: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

export function movePage(
  page: WritableSignal<number>,
  pageCount: () => number,
  direction: -1 | 1,
): void {
  page.update(current => Math.max(0, Math.min(pageCount() - 1, current + direction)));
}
