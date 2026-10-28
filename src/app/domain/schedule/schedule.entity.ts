export interface ScheduleEntry {
  id: number;
  publicationId: number;
  programId: number | null;
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
  publicationId: number;
  programId: number;
  date: string;
  startTime: string;
  endTime: string;
  turnSeconds?: number;
}

export type ScheduleChanges = Partial<Omit<NewScheduleEntry, 'publicationId'>>;

export interface ScheduleFilter {
  date?: string;
  from?: string;
  to?: string;
}
