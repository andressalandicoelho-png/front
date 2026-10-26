import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from '@presentation/core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    @if (toast.message(); as msg) { <div class="toast" role="status">{{ msg }}</div> }
  `,
})
export class AppComponent {
  toast = inject(ToastService);
}
