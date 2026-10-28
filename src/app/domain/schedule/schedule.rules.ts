import { NewScheduleEntry } from './schedule.entity';

export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
