import { Injectable, inject } from '@angular/core';
import { ReportRepository } from '@domain/report/report.repository';
import { PublicationReportFilter } from '@domain/report/report.entity';

@Injectable({ providedIn: 'root' })
export class GetPublicationReportUseCase {
  private repository = inject(ReportRepository);
  execute(filter: PublicationReportFilter) { return this.repository.publicationParticipations(filter); }
}
