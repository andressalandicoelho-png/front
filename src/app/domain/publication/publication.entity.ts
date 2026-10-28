export type PublicationType = 'IMAGE' | 'VIDEO' | 'LINK';
export type PublicationStatus = string; // ex.: READY, PUBLISHED, ...

export interface Publication {
  id: number;
  title: string;
  type: PublicationType;
  status: PublicationStatus;
  displaySeconds: number | null;
  originalDurationSeconds: number | null;
  linkUrl: string | null;
  /** Identificador usado em GET /media/:id */
  mediaId: number | null;
  createdByName?: string;
  programNames?: string[];
  createdAt?: string;
}

export interface NewPublication {
  title: string;
  type: PublicationType;
  displaySeconds?: number;
  originalDurationSeconds?: number;
  linkUrl?: string;
  file?: File;
}

export type PublicationChanges = Partial<{ title: string; displaySeconds: number }>;
export interface PublicationFilter { status?: string; type?: PublicationType; }

export const DEFAULT_DISPLAY_SECONDS = 10;
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

/** Regras de negócio para criar uma publicação. Retorna a mensagem de erro, ou null se válida. */
export function validateNewPublication(p: NewPublication): string | null {
  if (!p.title.trim()) return 'Informe um título.';
  if (p.type === 'LINK') {
    try { new URL(p.linkUrl ?? ''); } catch { return 'Informe um link válido, começando com https://'; }
    return null;
  }
  if (!p.file) return 'Selecione um arquivo.';
  if (p.file.size > MAX_UPLOAD_BYTES) return 'O arquivo passa do limite de 300 MB.';
  return null;
}
