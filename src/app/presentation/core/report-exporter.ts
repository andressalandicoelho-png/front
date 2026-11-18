import { Injectable } from '@angular/core';
import { PublicationParticipation } from '@domain/report/report.entity';

export interface ReportExportInput {
  items: PublicationParticipation[];
  from: string;
  to: string;
  status: string;
  query: string;
  formatDate(date: string): string;
  contentStatusLabel(status: string): string;
}

@Injectable({ providedIn: 'root' })
export class ReportExporter {
  exportCsv(items: PublicationParticipation[]): void {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ['Conteúdo', 'Autor', 'E-mail', 'Data', 'Início', 'Fim', 'Status do conteúdo', 'Status da participação'],
      ...items.map(item => [item.title, item.authorName, item.authorEmail, item.scheduledDate, item.startTime, item.endTime, item.status, item.participationStatus]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(quote).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio-de-participacoes.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async exportPdf(input: ReportExportInput): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const report = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = report.internal.pageSize.getWidth();
    const pageHeight = report.internal.pageSize.getHeight();
    let statusLabel = 'Todos';
    if (input.status === 'READY') statusLabel = 'Publicado';
    else if (input.status === 'DRAFT') statusLabel = 'Rascunho';
    const queryLabel = input.query.trim() || 'Sem busca';

    report.setFillColor(36, 73, 166);
    report.rect(0, 0, pageWidth, 31, 'F');
    report.setTextColor(255, 255, 255);
    report.setFont('helvetica', 'bold');
    report.setFontSize(18);
    report.text('Relatório de agendamentos', 14, 15);
    report.setFont('helvetica', 'normal');
    report.setFontSize(9);
    report.text(`Office Total  ·  Período ${input.formatDate(input.from)} a ${input.formatDate(input.to)}`, 14, 24);

    report.setTextColor(40, 48, 62);
    report.setFont('helvetica', 'bold');
    report.setFontSize(9);
    report.text(`${input.items.length} registros`, 14, 40);
    report.setFont('helvetica', 'normal');
    report.setFontSize(8);
    report.text(`Conteúdo: ${statusLabel}  ·  Busca: ${queryLabel}`, 14, 46);

    autoTable(report, {
      startY: 52,
      margin: { left: 14, right: 14, bottom: 14 },
      head: [['Conteúdo', 'Tipo', 'Autor', 'E-mail', 'Data', 'Início', 'Fim', 'Status do conteúdo', 'Agendamento']],
      body: input.items.map(item => [
        item.title,
        item.type,
        item.authorName,
        item.authorEmail,
        input.formatDate(item.scheduledDate),
        item.startTime,
        item.endTime,
        input.contentStatusLabel(item.status),
        item.participationStatus,
      ]),
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: [42, 50, 64],
        lineColor: [220, 226, 234],
        lineWidth: 0.15,
        overflow: 'linebreak',
      },
      headStyles: { fillColor: [36, 73, 166], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 18 },
        2: { cellWidth: 33 },
        3: { cellWidth: 48 },
        4: { cellWidth: 22 },
        5: { cellWidth: 16 },
        6: { cellWidth: 16 },
        7: { cellWidth: 28 },
        8: { cellWidth: 25 },
      },
      didDrawPage: () => {
        report.setFont('helvetica', 'normal');
        report.setFontSize(8);
        report.setTextColor(105, 115, 134);
        report.text('Relatório baseado nos agendamentos cadastrados; não confirma reprodução na TV.', 14, pageHeight - 7);
        report.text(`Página ${report.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
      },
    });

    report.save(`relatorio-agendamentos-${input.from}-${input.to}.pdf`);
  }
}