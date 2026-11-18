import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GetPublicationReportUseCase } from '@application/report/report.usecases';
import { PublicationParticipation } from '@domain/report/report.entity';
import { errorMessage } from '@presentation/core/error-message';
import { formatDate } from '@presentation/core/format';
import { movePage, paginate } from '@presentation/core/pagination';
import { ReportExporter } from '@presentation/core/report-exporter';
import { DatePickerComponent } from '@presentation/ui/shared/date-picker.component';
import { IconComponent } from '@presentation/ui/shared/icon.component';
import { PaginationComponent } from '@presentation/ui/shared/pagination.component';

const dateInput = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

@Component({
  selector: 'app-reports',
  imports: [DatePipe, FormsModule, DatePickerComponent, IconComponent, PaginationComponent],
  template: `
    @if (pdfError()) { <div class="notice error-notice" role="alert">{{ pdfError() }}</div> }

    <section class="card report-filters">
      <div class="report-search-actions">
        <label class="search-field search-field--icon report-search report-search-field"><app-icon name="search" [size]="17"/><input class="input" type="search" placeholder="Buscar por conteúdo, autor ou e-mail" aria-label="Buscar por conteúdo, autor ou e-mail" [(ngModel)]="query" (ngModelChange)="page.set(0)"></label>
        <div class="actions report-export-actions">
          <button class="btn" type="button" (click)="exportCsv()" [disabled]="!filtered().length || loading()">CSV</button>
          <button class="btn primary" type="button" (click)="exportPdf()" [disabled]="!filtered().length || loading() || pdfExporting()">
            <app-icon name="document" [size]="16"/>
            @if (pdfExporting()) { Gerando PDF… } @else { Exportar PDF }
          </button>
        </div>
      </div>
      <div class="filter-grid">
        <label class="field">De<app-date-picker [(ngModel)]="from" (ngModelChange)="load()"></app-date-picker></label>
        <label class="field">Até<app-date-picker [(ngModel)]="to" (ngModelChange)="load()"></app-date-picker></label>
        <label class="field">Status<select class="input" [(ngModel)]="status"><option value="">Todos os status</option><option value="READY">Publicado</option><option value="DRAFT">Rascunho</option></select></label>
      </div>
      <div class="row-between report-helper"><small class="muted">Datas passadas aparecem como encerradas.</small><button class="link-button" type="button" (click)="clearFilters()">Limpar filtros</button></div>
    </section>

    <section class="card report-table-card">
      <div class="card-head report-table-card-head">
        <div class="report-table-title">
          <strong>Participações agendadas</strong>
          <span class="chip">
            {{ filtered().length }}
            @if (filtered().length === 1) { registro } @else { registros }
          </span>
        </div>
      </div>
      <div class="report-table">
        <div class="report-table-head"><span>Conteúdo</span><span>Autor</span><span>Data agendada</span><span>Status</span><span>Horário</span></div>
        @for (item of pageItems(); track item.id) {
          <article class="report-row">
            <div class="report-title"><strong>{{ item.title }}</strong><small>{{ item.type }} · #{{ item.publicationId }}</small></div>
            <span>{{ item.authorName }}<small>{{ item.authorEmail }}</small></span>
            <span>{{ item.scheduledDate | date:'dd/MM/yyyy' }}</span>
            <span class="status" [class.live]="item.status === 'READY'">{{ contentStatusLabel(item.status) }}</span>
            <span>{{ item.startTime }}–{{ item.endTime }}<small>{{ item.participationStatus }}</small></span>
          </article>
        } @empty {
          <div class="report-empty empty-state">
            <span class="empty-icon"><app-icon name="calendar" [size]="24"/></span>
            <h2>
              @if (loading()) {
                Carregando relatório…
              } @else if (error()) {
                Não foi possível carregar os relatórios
              } @else {
                Nenhuma participação neste período
              }
            </h2>
            <p class="muted">{{ error() || 'Ajuste os filtros.' }}</p>
            @if (error()) { <button class="btn primary" type="button" (click)="load()">Tentar novamente</button> }
          </div>
        }
      </div>
      @if (filtered().length) {
        <footer app-pagination class="pagination report-pagination" ariaLabel="Paginação do relatório"
          [previousDisabled]="page() === 0" [nextDisabled]="page() + 1 >= pageCount()"
          (previousPage)="previousPage()" (nextPage)="nextPage()">
          <small class="muted" paginationSummary>Mostrando {{ pageItems().length }} de {{ filtered().length }} registros</small>
          <span paginationStatus aria-live="polite">{{ page() + 1 }} / {{ pageCount() }}</span>
        </footer>
      }
    </section>
    <p class="muted report-note"><app-icon name="info" [size]="15"/> Mostra agendamentos, não visualizações.</p>
  `,
})
export class ReportsPage implements OnInit {
  readonly formatDate = formatDate;
  private reportUC = inject(GetPublicationReportUseCase);
  private reportExporter = inject(ReportExporter);
  rows = signal<PublicationParticipation[]>([]);
  from = dateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  to = dateInput(new Date());
  query = '';
  status = '';
  page = signal(0);
  pageSize = signal(8);
  loading = signal(false);
  error = signal('');
  pdfExporting = signal(false);
  pdfError = signal('');

  filtered = computed(() => {
    const term = this.query.trim().toLocaleLowerCase();
    return this.rows().filter(row =>
      (!term || `${row.title} ${row.authorName} ${row.authorEmail}`.toLocaleLowerCase().includes(term)) &&
      (!this.status || row.status === this.status),
    );
  });
  private readonly pagination = computed(() => paginate(this.filtered(), this.page(), this.pageSize()));
  pageItems = computed(() => this.pagination().items);
  pageCount = computed(() => this.pagination().count);

  ngOnInit(): void {
    this.updatePageSize();
    this.load();
  }
  @HostListener('window:resize')
  updatePageSize(): void {
    let nextSize = 8;
    if (window.innerWidth <= 800) nextSize = 5;
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

  previousPage(): void { movePage(this.page, this.pageCount, -1); }
  nextPage(): void { movePage(this.page, this.pageCount, 1); }

  contentStatusLabel(status: string): string {
    if (status === 'READY') return 'Publicado';
    return 'Rascunho';
  }

  exportCsv(): void {
    this.reportExporter.exportCsv(this.filtered());
  }

  async exportPdf(): Promise<void> {
    if (this.pdfExporting()) return;
    this.pdfExporting.set(true);
    this.pdfError.set('');
    try {
      await this.reportExporter.exportPdf({
        items: this.filtered(),
        from: this.from,
        to: this.to,
        status: this.status,
        query: this.query,
        formatDate: this.formatDate,
        contentStatusLabel: status => this.contentStatusLabel(status),
      });
    } catch (error) {
      if (error instanceof Error) this.pdfError.set(error.message);
      else this.pdfError.set('Não foi possível gerar o PDF.');
    } finally {
      this.pdfExporting.set(false);
    }
  }

}
