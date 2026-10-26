import { environment } from '@env/environment';

export const api = (path: string): string => `${environment.apiUrl}${path}`;

/** Remove campos nulos/indefinidos de um objeto de query. */
export function cleanParams(obj: Record<string, string | number | undefined | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]),
  );
}
