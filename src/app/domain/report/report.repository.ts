import { Observable } from 'rxjs';
import { PublicationParticipation, PublicationReportFilter } from './report.entity';

export abstract class ReportRepository {
  abstract publicationParticipations(filter: PublicationReportFilter): Observable<PublicationParticipation[]>;
}
