import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';
import { IconComponent } from '@presentation/ui/icon.component';

@Component({
  selector: 'app-login',
  imports: [FormsModule, IconComponent],
  template: `
    <div class="login">
      <div class="login-panel">
        <div class="login-brand"><span class="brand-mark"><app-icon name="briefcase" [size]="22"/></span><div><small>GRUPO</small><strong>OFFICE<br>TOTAL<span>30</span></strong></div></div>
        <p>Comunicação que conecta.</p>
      </div>
      <div class="login-form-panel">
        <form class="login-card" (ngSubmit)="submit()">
          <div class="login-heading"><h1>Bem vindo de volta!</h1><p class="muted">Por favor acesse com sua conta corporativa.</p></div>
          <label class="field">E-mail<input class="input" type="email" name="email" placeholder="seuNome@officetotal.com" autocomplete="username" [(ngModel)]="email" required></label>
          <label class="field">Senha<input class="input" type="password" name="password" placeholder="Digite sua senha" autocomplete="current-password" [(ngModel)]="password" required></label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn primary block" type="submit" [disabled]="loading() || !email || !password">{{ loading() ? 'Entrando…' : 'Entrar' }}</button>
          <a class="link login-forgot" href="mailto:suporte@officetotal.com.br?subject=Esqueci%20minha%20senha">Esqueci a senha</a>
        </form>
      </div>
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
      next: () => this.router.navigate(['/calendario']),
      error: e => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
