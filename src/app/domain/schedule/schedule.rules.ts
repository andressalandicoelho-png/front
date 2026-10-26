import { NewScheduleEntry } from './schedule.entity';

/** Qualquer item com janela de exibição (agendamento ou item do player). */
export interface Windowed {
  date?: string;
  startTime?: string;
  endTime?: string;
}

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const toTime = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Limite exato: o início é inclusivo e o fim é exclusivo (08:00–12:00 deixa de valer às 12:00). */
export function isActiveAt(item: Windowed, now: Date): boolean {
  if (item.date && item.date !== toIsoDate(now)) return false;
  if (!item.startTime || !item.endTime) return true;
  const current = toMinutes(toTime(now));
  return current >= toMinutes(item.startTime) && current < toMinutes(item.endTime);
}

/**
 * Fila de reprodução do momento: itens com janelas coincidentes participam da MESMA fila,
 * ordenados por horário de início (estável, mantém a ordem original em empates).
 */
export function buildQueue<T extends Windowed>(items: T[], now: Date): T[] {
  return items
    .filter(i => isActiveAt(i, now))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.startTime ?? '').localeCompare(b.item.startTime ?? '') || a.index - b.index)
    .map(x => x.item);
}

export function validateScheduleEntry(e: Partial<NewScheduleEntry>): string | null {
  if (!e.channelId) return 'Escolha um canal.';
  if (!e.publicationId) return 'Escolha uma publicação.';
  if (!e.date) return 'Escolha uma data.';
  if (!e.startTime || !e.endTime) return 'Informe o horário de início e de fim.';
  if (toMinutes(e.endTime) <= toMinutes(e.startTime)) return 'O fim precisa ser depois do início.';
  if (e.turnSeconds !== undefined && (e.turnSeconds < 1 || e.turnSeconds > 3600)) {
    return 'A duração do turno deve ficar entre 1 e 3600 segundos.';
  }
  return null;
}

/** Soma da duração nominal de um ciclo da fila. */
export const loopSeconds = (durations: number[]): number => durations.reduce((s, n) => s + n, 0);
