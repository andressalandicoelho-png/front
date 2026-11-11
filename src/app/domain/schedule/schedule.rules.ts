import { NewScheduleEntry } from './schedule.entity';

const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

export function currentBusinessDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function currentBusinessTime(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function datesBetweenInclusive(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return [];
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function validateScheduleEntry(e: Partial<NewScheduleEntry>): string | null {
  if (!e.publicationId) return 'Escolha uma publicação.';
  if (!e.programId) return 'Escolha uma programação para exibir este conteúdo.';
  if (!e.date) return 'Escolha uma data.';
  if (!e.startTime || !e.endTime) return 'Informe o horário de início e de fim.';
  if (toMinutes(e.endTime) <= toMinutes(e.startTime)) return 'O fim precisa ser depois do início.';
  if (e.turnSeconds !== undefined && (e.turnSeconds < 1 || e.turnSeconds > 3600)) {
    return 'A duração planejada deve ficar entre 1 e 3600 segundos.';
  }
  return null;
}
