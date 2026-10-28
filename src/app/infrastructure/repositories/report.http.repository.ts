import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PublicationParticipation, PublicationReportFilter } from '@domain/report/report.entity';
import { ReportRepository } from '@domain/report/report.repository';
import { api, cleanParams } from '../http/api';

@Injectable()
export class HttpReportRepository extends ReportRepository {
  private http = inject(HttpClient);

  publicationParticipations(filter: PublicationReportFilter): Observable<PublicationParticipation[]> {
    return this.http.get<PublicationParticipation[]>(api('/reports/publications'), {
      params: cleanParams({ ...filter }),
    });
  }
}
