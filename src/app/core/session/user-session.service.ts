import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CurrentUser {
  idUsuario: number;
  nome: string;
  email: string;
  token: string;
  status?: string;
  fotoUrl?: string | null;
  nickname?: string | null;
}

const STORAGE_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private subject = new BehaviorSubject<CurrentUser | null>(this.readUser());
  user$ = this.subject.asObservable();

  private readUser(): CurrentUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as CurrentUser : null;
    } catch { return null; }
  }

  set(user: CurrentUser | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, user.token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
    this.subject.next(user);
  }

  get(): CurrentUser | null { return this.subject.value; }

  logout() { this.set(null); }

  /** Ex.: "Aninha_gamer#123" ou "Luis#1" (se não houver nickname) */
  userTag(u: CurrentUser): string {
    const nick = (u.nickname && u.nickname.trim())
      ? u.nickname.trim()
      : (u.nome?.split(' ')[0] ?? 'Jogador');
    return `${nick}#${u.idUsuario}`;
  }
}
