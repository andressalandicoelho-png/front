export interface ProgramEntry {
  id: number;
  position: number;
  publicationId: number;
  publicationTitle: string;
  publicationContent: string | null;
  publicationType: string;
  publicationStatus: string;
  displaySeconds: number | null;
  originalDurationSeconds: number | null;
  mediaFileId: number | null;
  linkUrl: string | null;
}

export interface Program {
  id: number;
  name: string;
  active: boolean;
  createdById: number;
  entries: ProgramEntry[];
}
