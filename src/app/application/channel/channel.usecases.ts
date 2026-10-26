import { Injectable, inject } from '@angular/core';
import { ChannelChanges, NewChannel } from '@domain/channel/channel.entity';
import { ChannelRepository } from '@domain/channel/channel.repository';

@Injectable({ providedIn: 'root' })
export class ListChannelsUseCase {
  private repo = inject(ChannelRepository);
  execute() { return this.repo.list(); }
}

@Injectable({ providedIn: 'root' })
export class CreateChannelUseCase {
  private repo = inject(ChannelRepository);
  execute(input: NewChannel) { return this.repo.create(input); }
}

@Injectable({ providedIn: 'root' })
export class UpdateChannelUseCase {
  private repo = inject(ChannelRepository);
  execute(id: number, changes: ChannelChanges) { return this.repo.update(id, changes); }
}
