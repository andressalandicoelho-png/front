import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login">
      <form class="login-card" (ngSubmit)="submit()">
        <div class="login-logo"><span class="brand-mark big">TV</span><h1>TV Campus</h1></div>
        <p class="muted center">Organize o que aparece nas TVs da faculdade.</p>
        <input class="input" type="email" name="email" placeholder="E-mail" autocomplete="username" [(ngModel)]="email" required>
        <input class="input" type="password" name="password" placeholder="Senha" autocomplete="current-password" [(ngModel)]="password" required>
        <button class="btn primary block" type="submit" [disabled]="loading() || !email || !password">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>
        @if (error()) { <p class="error center">{{ error() }}</p> }
      </form>
    </div>`,
})
export class LoginPage {
  private auth = inject(AuthState);
  private router = inject(Router);
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/inicio']),
      error: e => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
