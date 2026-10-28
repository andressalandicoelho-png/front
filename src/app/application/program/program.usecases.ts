import { Injectable, inject } from '@angular/core';
import { ProgramRepository } from '@domain/program/program.repository';

@Injectable({ providedIn: 'root' })
export class ListProgramsUseCase {
  private repository = inject(ProgramRepository);
  execute() { return this.repository.list(); }
}

@Injectable({ providedIn: 'root' })
export class CreateProgramUseCase {
  private repository = inject(ProgramRepository);
  execute(name: string) { return this.repository.create(name); }
}

@Injectable({ providedIn: 'root' })
export class UpdateProgramUseCase {
  private repository = inject(ProgramRepository);
  execute(id: number, changes: { name?: string; active?: boolean }) { return this.repository.update(id, changes); }
}

@Injectable({ providedIn: 'root' })
export class AddProgramEntriesUseCase {
  private repository = inject(ProgramRepository);
  execute(id: number, publicationIds: number[]) { return this.repository.addPublications(id, publicationIds); }
}

@Injectable({ providedIn: 'root' })
export class RemoveProgramEntryUseCase {
  private repository = inject(ProgramRepository);
  execute(id: number, entryId: number) { return this.repository.removeEntry(id, entryId); }
}

@Injectable({ providedIn: 'root' })
export class DeleteProgramUseCase {
  private repository = inject(ProgramRepository);
  execute(id: number) { return this.repository.delete(id); }
}
