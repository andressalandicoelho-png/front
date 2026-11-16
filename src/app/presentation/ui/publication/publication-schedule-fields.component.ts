import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PublicationScheduleForm } from '@presentation/models/publication-schedule-form';
import { DatePickerComponent } from '../shared/date-picker.component';

@Component({
  selector: 'app-publication-schedule-fields',
  imports: [FormsModule, DatePickerComponent],
  template: `
    <div class="add-content-period-fields">
      <label class="calendar-schedule-time">Data de início
        <app-date-picker [name]="namePrefix() + 'StartDate'" [min]="minDate()" required
          [disabled]="disabled()" [ngModel]="schedule().date" [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="scheduleChanged.emit({ field: 'date', value: $event })"/>
      </label>
      <label class="calendar-schedule-time">Repetir até a data
        <app-date-picker [name]="namePrefix() + 'EndDate'" [min]="schedule().date || minDate()" required
          [disabled]="disabled()" [ngModel]="schedule().endDate" [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="scheduleChanged.emit({ field: 'endDate', value: $event })"/>
      </label>
      <label class="calendar-schedule-time">De
        <input class="input" type="time" [name]="namePrefix() + 'StartTime'" required
          [disabled]="disabled()" [ngModel]="schedule().startTime" [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="scheduleChanged.emit({ field: 'startTime', value: $event })">
      </label>
      <label class="calendar-schedule-time">Até
        <input class="input" type="time" [name]="namePrefix() + 'EndTime'" required
          [disabled]="disabled()" [ngModel]="schedule().endTime" [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="scheduleChanged.emit({ field: 'endTime', value: $event })">
      </label>
    </div>
  `,
  styles: [':host { display: block; min-width: 0; }'],
})
export class PublicationScheduleFieldsComponent {
  schedule = input.required<PublicationScheduleForm>();
  minDate = input.required<string>();
  disabled = input(false);
  namePrefix = input('publicationSchedule');
  scheduleChanged = output<{ field: keyof PublicationScheduleForm; value: string }>();
}
