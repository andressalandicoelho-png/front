import { Component, computed, input } from '@angular/core';

interface ScheduleProgress {
  completed: number;
  total: number;
}

@Component({
  selector: 'app-schedule-progress',
  template: `
    <div class="program-progress" role="status" aria-live="polite">
      <span>Agendando {{ progress().completed }} de {{ progress().total }} períodos diários…</span>
      <span class="program-progress-track"><i [style.width.%]="percent()"></i></span>
    </div>
  `,
})
export class ScheduleProgressComponent {
  readonly progress = input.required<ScheduleProgress>();
  readonly percent = computed(() => {
    const { completed, total } = this.progress();
    if (!total) return 0;
    return Math.round(completed / total * 100);
  });
}
