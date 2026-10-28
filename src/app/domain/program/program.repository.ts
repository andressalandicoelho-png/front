import { Observable } from 'rxjs';
import { Program } from './program.entity';

export abstract class ProgramRepository {
  abstract list(): Observable<Program[]>;
  abstract create(name: string): Observable<Program>;
  abstract update(id: number, changes: { name?: string; active?: boolean }): Observable<Program>;
  abstract addPublications(id: number, publicationIds: number[]): Observable<Program>;
  abstract removeEntry(id: number, entryId: number): Observable<Program>;
}
