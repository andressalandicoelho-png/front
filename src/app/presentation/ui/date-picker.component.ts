import { Component, ElementRef, HostListener, Input, forwardRef, inject } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { IconComponent } from './icon.component';

interface DatePickerDay {
  iso: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
  label: string;
}

@Component({
  selector: 'app-date-picker',
  imports: [IconComponent],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DatePickerComponent), multi: true },
  ],
  template: `
    <div class="date-picker">
      <button
        class="input date-picker-trigger"
        type="button"
        [disabled]="disabled"
        [attr.aria-expanded]="open"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-label]="ariaLabel || null"
        (click)="toggleCalendar()">
        <span [class.date-picker-placeholder]="!value">{{ value ? displayValue(value) : 'dd/mm/aaaa' }}</span>
        <app-icon name="calendar" [size]="16"/>
      </button>
      @if (open) {
        <section
          class="date-picker-popover"
          role="dialog"
          aria-label="Selecionar data"
          [style.top.px]="position.top"
          [style.left.px]="position.left">
          <header class="date-picker-heading">
            <strong>{{ monthLabel() }}</strong>
            <span class="date-picker-navigation">
              <button type="button" aria-label="Mês anterior" (click)="moveMonth(-1)"><app-icon name="left" [size]="17"/></button>
              <button type="button" aria-label="Próximo mês" (click)="moveMonth(1)"><app-icon name="right" [size]="17"/></button>
            </span>
          </header>
          <div class="date-picker-weekdays" role="row">
            @for (weekday of weekdays; track $index) { <span role="columnheader">{{ weekday }}</span> }
          </div>
          <div class="date-picker-days" role="grid">
            @for (day of calendarDays(); track day.iso) {
              <button
                type="button"
                role="gridcell"
                class="date-picker-day"
                [class.outside-month]="!day.inMonth"
                [class.is-today]="day.today"
                [class.is-selected]="day.selected"
                [disabled]="day.disabled"
                [attr.aria-label]="day.label"
                [attr.aria-pressed]="day.selected"
                (click)="selectDate(day.iso)">
                {{ day.day }}
              </button>
            }
          </div>
          <footer class="date-picker-footer">
            <button type="button" [disabled]="!value" (click)="clearDate()">Limpar</button>
            <button type="button" [disabled]="isDisabledDate(todayIso())" (click)="selectDate(todayIso())">Hoje</button>
          </footer>
        </section>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
    .date-picker { width: 100%; min-width: 0; }
    .date-picker-trigger { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; text-align: left; }
    .date-picker-trigger app-icon { flex: none; color: #748097; }
    .date-picker-placeholder { color: #8a94a5; }
    .date-picker-popover {
      position: fixed;
      z-index: 2200;
      width: min(288px, calc(100vw - 16px));
      padding: 10px 12px 8px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 12px 28px rgba(27, 44, 83, .16);
      color: #202a3a;
    }
    .date-picker-heading { display: flex; min-height: 34px; align-items: center; justify-content: space-between; gap: 8px; }
    .date-picker-heading strong { font-size: 15px; font-weight: 600; }
    .date-picker-navigation { display: flex; align-items: center; gap: 4px; }
    .date-picker-navigation button { display: grid; width: 28px; height: 28px; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #344054; cursor: pointer; }
    .date-picker-navigation button:hover { background: #f0f3f8; }
    .date-picker-weekdays, .date-picker-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); justify-items: center; }
    .date-picker-weekdays { min-height: 29px; align-items: center; color: #687386; font-size: 12px; }
    .date-picker-day { display: grid; width: 32px; height: 32px; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 50%; background: transparent; color: #202a3a; font: inherit; font-size: 13px; cursor: pointer; }
    .date-picker-day:hover:not(:disabled) { background: #eef3fc; }
    .date-picker-day.outside-month { color: #929aaa; }
    .date-picker-day.is-today { background: #0c5bdc; color: #fff; }
    .date-picker-day.is-selected:not(.is-today) { border-color: #0c5bdc; color: #0c5bdc; }
    .date-picker-day:disabled { color: #c3c8d1; cursor: not-allowed; }
    .date-picker-footer { display: flex; min-height: 30px; align-items: flex-end; justify-content: space-between; padding-top: 5px; }
    .date-picker-footer button { padding: 2px 6px; border: 0; border-radius: 4px; background: transparent; color: #0c5bdc; font: inherit; font-size: 12px; cursor: pointer; }
    .date-picker-footer button:hover:not(:disabled) { background: #f1f5fc; }
    .date-picker-footer button:disabled { color: #aeb6c4; cursor: default; }
  `],
})
export class DatePickerComponent implements ControlValueAccessor, Validator {
  private readonly host = inject(ElementRef<HTMLElement>);
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private validatorChange: () => void = () => {};
  private inputDisabled = false;
  private formDisabled = false;
  private minimumDate = '';
  private requiredValue = false;

  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  value = '';
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  open = false;
  position = { top: 8, left: 8 };
  @Input() ariaLabel = '';

  @Input()
  get disabled(): boolean { return this.inputDisabled || this.formDisabled; }
  set disabled(value: boolean | string) { this.inputDisabled = value === true || value === '' || value === 'true'; }

  @Input()
  get min(): string { return this.minimumDate; }
  set min(value: string | null | undefined) {
    this.minimumDate = value ?? '';
    this.validatorChange();
  }

  @Input()
  get required(): boolean { return this.requiredValue; }
  set required(value: boolean | string) {
    this.requiredValue = value === true || value === '' || value === 'true';
    this.validatorChange();
  }

  writeValue(value: string | null): void { this.value = value ?? ''; }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.formDisabled = disabled; }
  registerOnValidatorChange(fn: () => void): void { this.validatorChange = fn; }

  validate(control: AbstractControl): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value : '';
    if (this.required && !value) return { required: true };
    if (!value) return null;
    if (!this.parseDate(value)) return { dateFormat: true };
    return this.min && value < this.min ? { minDate: { min: this.min, actual: value } } : null;
  }

  toggleCalendar(): void {
    if (this.disabled) return;
    if (this.open) {
      this.closeCalendar();
      return;
    }
    this.month = this.parseDate(this.value) ?? new Date();
    this.month = new Date(this.month.getFullYear(), this.month.getMonth(), 1);
    this.setPosition();
    this.open = true;
  }

  monthLabel(): string {
    const month = this.month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return month.charAt(0).toLocaleUpperCase('pt-BR') + month.slice(1);
  }

  calendarDays(): DatePickerDay[] {
    const first = new Date(this.month.getFullYear(), this.month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const today = this.todayIso();
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = this.toIso(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === this.month.getMonth(),
        today: iso === today,
        selected: iso === this.value,
        disabled: this.isDisabledDate(iso),
        label: date.toLocaleDateString('pt-BR', { dateStyle: 'full' }),
      };
    });
  }

  displayValue(value: string): string {
    const date = this.parseDate(value);
    return date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}` : value;
  }

  todayIso(): string { return this.toIso(new Date()); }

  isDisabledDate(date: string): boolean { return !!this.min && date < this.min; }

  moveMonth(offset: number): void {
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + offset, 1);
  }

  selectDate(value: string): void {
    if (this.disabled || this.isDisabledDate(value)) return;
    this.value = value;
    this.onChange(value);
    this.onTouched();
    this.month = this.parseDate(value) ?? this.month;
    this.closeCalendar();
  }

  clearDate(): void {
    if (this.disabled) return;
    this.value = '';
    this.onChange('');
    this.onTouched();
    this.closeCalendar();
  }

  closeCalendar(): void {
    this.open = false;
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (this.open && event.target instanceof Node && !this.host.nativeElement.contains(event.target)) this.closeCalendar();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.open) this.closeCalendar();
  }

  @HostListener('window:resize')
  repositionOnResize(): void {
    if (this.open) this.setPosition();
  }

  private setPosition(): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const popupWidth = Math.min(288, window.innerWidth - 16);
    const popupHeight = 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 8));
    let top = rect.bottom + 6;
    if (top + popupHeight > window.innerHeight - 8 && rect.top > popupHeight) top = rect.top - popupHeight - 6;
    this.position = { top: Math.max(8, top), left };
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
      ? date
      : null;
  }

  private toIso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
