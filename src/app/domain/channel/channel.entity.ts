export interface Channel {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
}

export interface NewChannel {
  name: string;
  description?: string | null;
}

export type ChannelChanges = Partial<{ name: string; description: string | null; active: boolean }>;
