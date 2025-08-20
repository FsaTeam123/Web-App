// src/app/shared/models/nav-link.model.ts
export type NavVariant = 'primary' | 'ghost';

export interface NavChildLink {
  label: string;
  route: string;
  newTab?: boolean;   // default: true nas opções do submenu
}

export interface NavLink {
  label: string;
  route?: string;     // pode não ter rota quando tiver children
  variant?: NavVariant;
  children?: NavChildLink[]; // submenu
}