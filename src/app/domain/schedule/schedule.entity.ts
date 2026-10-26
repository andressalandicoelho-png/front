export interface ScheduleEntry {
  id: number;
  channelId: number;
  publicationId: number;
  /** AAAA-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  turnSeconds: number | null;
  publicationTitle?: string;
}

export interface NewScheduleEntry {
  channelId: number;
  publicationId: number;
  date: string;
  startTime: string;
  endTime: string;
  turnSeconds?: number;
}

export type ScheduleChanges = Partial<Omit<NewScheduleEntry, 'channelId' | 'publicationId'>>;

export interface ScheduleFilter {
  date?: string;
  from?: string;
  to?: string;
  channelId?: number;
}
