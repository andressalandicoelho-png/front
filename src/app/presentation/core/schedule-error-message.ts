export function completedScheduleMessage(count: number): string {
  if (count <= 0) return '';
  const label = count === 1 ? 'agendamento concluído' : 'agendamentos concluídos';
  return ` ${count} ${label}.`;
}