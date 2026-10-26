import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import {
  NewPublication, Publication, PublicationChanges, PublicationFilter, validateNewPublication,
} from '@domain/publication/publication.entity';
import { PublicationRepository } from '@domain/publication/publication.repository';

@Injectable({ providedIn: 'root' })
export class ListPublicationsUseCase {
  private repo = inject(PublicationRepository);
  execute(filter?: PublicationFilter) { return this.repo.list(filter); }
}

@Injectable({ providedIn: 'root' })
export class CreatePublicationUseCase {
  private repo = inject(PublicationRepository);
  execute(input: NewPublication): Observable<Publication> {
    const error = validateNewPublication(input);
    return error ? throwError(() => new Error(error)) : this.repo.create(input);
  }
}

@Injectable({ providedIn: 'root' })
export class UpdatePublicationUseCase {
  private repo = inject(PublicationRepository);
  execute(id: number, changes: PublicationChanges) { return this.repo.update(id, changes); }
}

@Injectable({ providedIn: 'root' })
export class PublishPublicationUseCase {
  private repo = inject(PublicationRepository);
  execute(id: number) { return this.repo.publish(id); }
}

@Injectable({ providedIn: 'root' })
export class UnpublishPublicationUseCase {
  private repo = inject(PublicationRepository);
  execute(id: number) { return this.repo.unpublish(id); }
}

@Injectable({ providedIn: 'root' })
export class DeletePublicationUseCase {
  private repo = inject(PublicationRepository);
  execute(id: number) { return this.repo.delete(id); }
}
