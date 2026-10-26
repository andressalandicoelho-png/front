import { Component, OnInit, inject, signal } from '@angular/core';
import { ListChannelsUseCase } from '@application/channel/channel.usecases';
import { GeneratePlayerTokenUseCase } from '@application/user/user.usecases';
import { Channel } from '@domain/channel/channel.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { AuthState } from '@presentation/core/auth.state';
import { ToastService } from '@presentation/core/toast.service';
import { IconComponent } from '@presentation/ui/icon.component';

@Component({
  selector: 'app-profile',
  imports: [IconComponent],
  template: `
    <header class="page-head"><h1>Perfil</h1></header>

    @if (auth.user(); as u) {
      <section class="card profile">
        <span class="avatar big">{{ u.name[0] }}</span>
        <div>
          <div class="title">{{ u.name }}</div>
          <div class="muted">{{ u.email }}</div>
          <div class="chips tight">@for (r of u.roles; track r) { <span class="chip">{{ r === 'ADMIN' ? 'Administrador' : 'Editor' }}</span> }</div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><strong>Token do player</strong></div>
        <p class="muted pad">As TVs usam este token para abrir o canal. Gerar um novo token desconecta as TVs que usam o anterior.</p>
        <div class="pad">
          <button class="btn primary" type="button" (click)="generate()">{{ u.playerToken ? 'Trocar token' : 'Gerar token' }}</button>
        </div>

        @if (u.playerToken; as token) {
          @for (c of channels(); track c.id) {
            <div class="row">
              <div class="grow">
                <div class="title">{{ c.name }}</div>
                <div class="muted url">{{ playerUrl(token, c.id) }}</div>
              </div>
              <button class="icon-btn" type="button" aria-label="Copiar link" (click)="copy(playerUrl(token, c.id))"><app-icon name="copy" [size]="20"/></button>
              <a class="icon-btn" [href]="playerUrl(token, c.id)" target="_blank" rel="noopener" aria-label="Abrir player"><app-icon name="play" [size]="20"/></a>
            </div>
          }
        }
      </section>
    }
  `,
})
export class ProfilePage implements OnInit {
  auth = inject(AuthState);
  private channelsUC = inject(ListChannelsUseCase);
  private tokenUC = inject(GeneratePlayerTokenUseCase);
  private toast = inject(ToastService);
  channels = signal<Channel[]>([]);

  ngOnInit(): void { this.channelsUC.execute().subscribe(l => this.channels.set(l)); }

  playerUrl = (token: string, channelId: number) => `${location.origin}/player/${token}/${channelId}`;

  generate(): void {
    this.tokenUC.execute().subscribe({
      next: token => { this.auth.setPlayerToken(token); this.toast.show('Novo token gerado'); },
      error: e => this.toast.show(errorMessage(e)),
    });
  }

  copy(text: string): void { navigator.clipboard.writeText(text).then(() => this.toast.show('Link copiado')); }
}
