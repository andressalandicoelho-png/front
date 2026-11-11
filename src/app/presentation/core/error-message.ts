import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
    if (error.status === 0) return 'Não foi possível falar com o servidor.';
    if (error.status === 401) return 'E-mail ou senha incorretos.';
    if (error.status === 403) return 'Você não tem permissão para isso.';
    if (error.status === 404) return 'Item não encontrado.';
  }
  return error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.';
}