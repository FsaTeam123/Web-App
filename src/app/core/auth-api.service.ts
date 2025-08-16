// src/app/core/auth-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_ENDPOINTS } from '../../config/app-config';
import { Observable } from 'rxjs';

export interface Sexo { idSexo: number; nome: string; ativo: number; }
export interface Perfil { idPerfil: number; nome: string; descricao: string; ativo: number; }
export interface UsuarioDTO {
  idUsuario: number; nome: string; nickname: string; email: string;
  sexo: Sexo; perfil: Perfil; dtcCriacao: string; ativo: number | null;
}
export interface ResponseDTO<T = any> { status: number; message: string; data: T; }

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly TOKEN_KEY = 'resetToken'; // onde vamos guardar o token do verify

  constructor(private http: HttpClient) {}

  requestReset(email: string): Observable<UsuarioDTO> {
    return this.http.get<UsuarioDTO>(`${API_ENDPOINTS.usuariosReset}/${encodeURIComponent(email)}`);
  }

  verifyCode(email: string, codigo: string): Observable<ResponseDTO<{ token: string }>> {
    return this.http.post<ResponseDTO<{ token: string }>>(API_ENDPOINTS.verifyCode, { email, codigo });
  }

  saveToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  updatePassword(email: string, senha: string) {
    const token = this.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.put<ResponseDTO<UsuarioDTO>>(
      `${API_ENDPOINTS.atualizarUsuario}/${encodeURIComponent(email)}`,
      { senha },
      { headers }
    );
  }
}
