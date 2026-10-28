import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChangeOwnPasswordUseCase } from '@application/auth/auth.usecases';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';
import { IconComponent } from '@presentation/ui/icon.component';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, IconComponent, FormsModule],
  template: `
    <header class="page-head"><span class="eyebrow">Minha conta / Segurança</span><h1>Minha conta</h1><p class="muted">Gerencie seus dados e a segurança do seu acesso.</p></header>

    <nav class="tabs" aria-label="Seções da conta"><a class="tab" routerLink="/perfil">Dados pessoais</a><a class="tab active" routerLink="/perfil">Segurança</a></nav>

    @if (auth.user(); as u) {
      <div class="account-grid">
      <section class="card account-password">
        <h2>Alterar minha senha</h2>
        <p class="muted">Altere a senha da sua própria conta, sem depender de um administrador.</p>
        <div class="account-user"><span class="avatar">{{ u.name[0] }}</span><div class="grow"><strong>{{ u.name }}</strong><div class="muted">{{ u.email }} · Conta Office Total</div></div></div>
        <form class="stack" (ngSubmit)="changePassword()">
          <label class="field">Senha atual<input class="input" type="password" name="current" autocomplete="current-password" [(ngModel)]="passwordForm.current" required></label>
          <a class="link" href="mailto:suporte@officetotal.com.br?subject=Redefinir%20senha">Esqueci minha senha</a>
          <label class="field">Nova senha<input class="input" type="password" name="next" autocomplete="new-password" [(ngModel)]="passwordForm.next" minlength="8" maxlength="72" required></label>
          <small class="muted">Use no mínimo 8 caracteres, com letras e números.</small>
          <label class="field">Confirmar nova senha<input class="input" type="password" name="confirm" autocomplete="new-password" [(ngModel)]="passwordForm.confirm" required></label>
          @if (passwordError()) { <p class="error">{{ passwordError() }}</p> }
          @if (passwordSuccess()) { <p class="success">{{ passwordSuccess() }}</p> }
          <div class="actions"><button class="btn" type="button" (click)="resetPasswordForm()">Cancelar</button><button class="btn primary" type="submit" [disabled]="passwordSaving()">Salvar nova senha</button></div>
        </form>
      </section>
      <aside class="account-side">
        <section class="card pad"><h2>Proteja sua conta</h2><p class="muted">Uma senha longa é mais fácil de lembrar e mais difícil de adivinhar.</p><p class="muted">Evite nomes, datas pessoais e sequências comuns. Use uma combinação que só você conheça.</p></section>
        <section class="card pad"><h3>Acessa com a Microsoft?</h3><p class="muted">A senha da conta Microsoft é gerenciada na própria Microsoft.</p><a class="link" href="https://account.microsoft.com/security" target="_blank" rel="noopener">Gerenciar senha na Microsoft ↗</a></section>
      </aside>
      </div>

      <button class="btn account-logout" type="button" (click)="auth.logout()"><app-icon name="logout" [size]="18"/> Sair da conta</button>
    }
  `,
})
export class ProfilePage {
  auth = inject(AuthState);
  private changePasswordUC = inject(ChangeOwnPasswordUseCase);
  passwordForm = { current: '', next: '', confirm: '' };
  passwordError = signal('');
  passwordSuccess = signal('');
  passwordSaving = signal(false);

  resetPasswordForm(): void {
    this.passwordForm = { current: '', next: '', confirm: '' };
    this.passwordError.set('');
    this.passwordSuccess.set('');
  }

  changePassword(): void {
    this.passwordError.set('');
    this.passwordSuccess.set('');
    if (this.passwordForm.next !== this.passwordForm.confirm) {
      this.passwordError.set('As senhas não coincidem. Digite novamente a mesma senha informada em “Nova senha”.');
      return;
    }
    if (!/[A-Za-z]/.test(this.passwordForm.next) || !/\d/.test(this.passwordForm.next)) {
      this.passwordError.set('A senha deve conter letras e números.');
      return;
    }
    this.passwordSaving.set(true);
    this.changePasswordUC.execute(this.passwordForm.current, this.passwordForm.next).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.resetPasswordForm();
        this.passwordSuccess.set('Senha alterada com sucesso. A nova senha foi salva para sua conta.');
      },
      error: error => {
        this.passwordSaving.set(false);
        this.passwordError.set(errorMessage(error));
      },
    });
  }

}
