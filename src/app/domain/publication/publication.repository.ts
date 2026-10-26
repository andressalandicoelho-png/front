import { Observable } from 'rxjs';
import { NewPublication, Publication, PublicationChanges, PublicationFilter } from './publication.entity';

export abstract class PublicationRepository {
  abstract list(filter?: PublicationFilter): Observable<Publication[]>;
  abstract get(id: number): Observable<Publication>;
  abstract create(input: NewPublication): Observable<Publication>;
  abstract update(id: number, changes: PublicationChanges): Observable<Publication>;
  abstract publish(id: number): Observable<Publication>;
  abstract unpublish(id: number): Observable<Publication>;
  abstract delete(id: number): Observable<void>;
}
