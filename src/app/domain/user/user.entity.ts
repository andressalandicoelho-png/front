export type Role = 'ADMIN' | 'EDITOR';

export interface User {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  active: boolean;
  playerToken?: string | null;
  hasPlayerToken?: boolean;
}

export interface NewUser {
  name: string;
  email: string;
  password: string;
  roles: Role[];
}

export const hasRole = (user: User | null, role: Role): boolean => !!user?.roles?.includes(role);
export const isAdmin = (user: User | null): boolean => hasRole(user, 'ADMIN');
