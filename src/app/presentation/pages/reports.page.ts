import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GetPublicationReportUseCase } from '@application/report/report.usecases';
import { PublicationParticipation } from '@domain/report/report.entity';
import { errorMessage } from '@infra/http/auth.interceptor';
import { IconComponent } from '@presentation/ui/icon.component';

const dateInput = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

@Component({
  selector: 'app-reports',
  imports: [DatePipe, FormsModule, IconComponent],
  template: `
    <header class="page-head row-between">
      <div><h1>Relatórios</h1><p class="muted">Consulte as participações dos conteúdos nos agendamentos.</p></div>
      <button class="btn primary" type="button" (click)="exportCsv()" [disabled]="!filtered().length"><app-icon name="document" [size]="16"/> Exportar CSV</button>
    </header>

    <section class="card report-filters">
      <label class="search-field report-search"><app-icon name="search" [size]="17"/><input class="input" type="search" placeholder="Buscar por conteúdo, autor ou e-mail" aria-label="Buscar por conteúdo, autor ou e-mail" [(ngModel)]="query" (ngModelChange)="page.set(0)"></label>
      <div class="filter-grid">
        <label class="field">De<input class="input" type="date" [(ngModel)]="from" (ngModelChange)="load()"></label>
        <label class="field">Até<input class="input" type="date" [(ngModel)]="to" (ngModelChange)="load()"></label>
        <label class="field">Status<select class="input" [(ngModel)]="status"><option value="">Todos os status</option><option value="READY">Publicado</option><option value="DRAFT">Rascunho</option></select></label>
      </div>
      <div class="row-between report-helper"><small class="muted">Cada linha representa um agendamento real; datas passadas são marcadas como encerradas.</small><button class="link-button" type="button" (click)="clearFilters()">Limpar filtros</button></div>
    </section>

    <section class="card report-table-card">
      <div class="card-head report-table-card-head">
        <div class="report-table-title"><strong>Participações agendadas</strong><span class="chip">{{ filtered().length }} {{ filtered().length === 1 ? 'registro' : 'registros' }}</span></div>
      </div>
      <div class="report-table">
        <div class="report-table-head"><span>Conteúdo</span><span>Autor</span><span>Data agendada</span><span>Status</span><span>Horário</span></div>
        @for (item of pageItems(); track item.id) {
          <article class="report-row">
            <div class="report-title"><strong>{{ item.title }}</strong><small>{{ item.type }} · #{{ item.publicationId }}</small></div>
            <span>{{ item.authorName }}<small>{{ item.authorEmail }}</small></span>
            <span>{{ item.scheduledDate | date:'dd/MM/yyyy' }}</span>
            <span class="status" [class.live]="item.status === 'READY'">{{ item.status === 'READY' ? 'Publicado' : 'Rascunho' }}</span>
            <span>{{ item.startTime }}–{{ item.endTime }}<small>{{ item.participationStatus }}</small></span>
          </article>
        } @empty {
          <div class="report-empty">
            <span class="empty-icon"><app-icon name="calendar" [size]="24"/></span>
            <h2>{{ loading() ? 'Carregando relatório…' : error() ? 'Não foi possível carregar os relatórios' : 'Nenhuma participação neste período' }}</h2>
            <p class="muted">{{ error() || 'Não há agendamentos correspondentes aos filtros selecionados. Ajuste o período ou limpe os filtros.' }}</p>
            @if (error()) { <button class="btn primary" type="button" (click)="load()">Tentar novamente</button> }
          </div>
        }
      </div>
      @if (filtered().length) {
        <footer class="pagination report-pagination">
          <small class="muted">Mostrando {{ pageItems().length }} de {{ filtered().length }} registros</small>
          <div class="actions">
            <button class="btn small" type="button" [disabled]="page() === 0" (click)="previousPage()">Anterior</button>
            <span aria-live="polite">{{ page() + 1 }} / {{ pageCount() }}</span>
            <button class="btn small" type="button" [disabled]="page() + 1 >= pageCount()" (click)="nextPage()">Próxima</button>
          </div>
        </footer>
      }
    </section>
    <p class="muted report-note"><app-icon name="info" [size]="15"/> O relatório reflete os agendamentos cadastrados na agenda; não indica audiência nem confirma que um conteúdo foi visualizado na TV.</p>
  `,
})
export class ReportsPage implements OnInit {
  private reportUC = inject(GetPublicationReportUseCase);
  rows = signal<PublicationParticipation[]>([]);
  from = dateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  to = dateInput(new Date());
  query = '';
  status = '';
  page = signal(0);
  pageSize = signal(8);
  loading = signal(false);
  error = signal('');

  filtered = computed(() => {
    const term = this.query.trim().toLocaleLowerCase();
    return this.rows().filter(row =>
      (!term || `${row.title} ${row.authorName} ${row.authorEmail}`.toLocaleLowerCase().includes(term)) &&
      (!this.status || row.status === this.status),
    );
  });
  pageItems = computed(() => this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));

  ngOnInit(): void {
    this.updatePageSize();
    this.load();
  }
  @HostListener('window:resize')
  updatePageSize(): void {
    const nextSize = window.innerWidth <= 800 ? 5 : 8;
    if (this.pageSize() !== nextSize) {
      this.pageSize.set(nextSize);
      this.page.set(0);
    }
  }

  load(): void {
    if (!this.from || !this.to) return;
    if (this.from > this.to) {
      this.error.set('A data inicial deve ser anterior ou igual à data final.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.reportUC.execute({ from: this.from, to: this.to }).subscribe({
      next: rows => { this.rows.set(rows); this.loading.set(false); this.page.set(0); },
      error: error => { this.loading.set(false); this.error.set(errorMessage(error)); },
    });
  }

  clearFilters(): void {
    this.query = '';
    this.status = '';
    this.page.set(0);
    this.load();
  }

  previousPage(): void { this.page.update(value => Math.max(0, value - 1)); }
  nextPage(): void { this.page.update(value => Math.min(this.pageCount() - 1, value + 1)); }

  exportCsv(): void {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ['Conteúdo', 'Autor', 'E-mail', 'Data', 'Início', 'Fim', 'Status do conteúdo', 'Status da participação'],
      ...this.filtered().map(item => [item.title, item.authorName, item.authorEmail, item.scheduledDate, item.startTime, item.endTime, item.status, item.participationStatus]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(quote).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio-de-participacoes.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
