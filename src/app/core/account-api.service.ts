import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../config/app-config';
import { UserSessionService } from './session/user-session.service';

export interface SexoDTO { idSexo: number; nome: string; ativo: number; }
export interface PerfilDTO { idPerfil: number; nome: string; descricao: string; ativo: number; }
export interface UsuarioDTO {
  idUsuario: number;
  nome: string;
  nickname: string;
  email: string;
  sexo: SexoDTO;
  perfil: PerfilDTO;
  dtcCriacao: string;
  ativo: number | null;
}

export interface ResponseDTO<T = any> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private http = inject(HttpClient);
  private session = inject(UserSessionService);

  /** headers com Authorization se houver token */
  private authHeaders(): { headers?: HttpHeaders } {
    const token = this.session.get()?.token;
    return token ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) } : {};
  }

  getUsuarioById(id: number): Observable<UsuarioDTO> {
    return this.http.get<UsuarioDTO>(`${API_ENDPOINTS.usuarios}/${id}`, this.authHeaders());
  }

  getSexos(): Observable<SexoDTO[]> {
    return this.http.get<SexoDTO[]>(API_ENDPOINTS.sexos, this.authHeaders());
  }

  updateUsuarioByEmail(email: string, dto: Partial<{ nome: string; nickname: string; idSexo: number; senha: string; }>)
  : Observable<ResponseDTO<UsuarioDTO>> {
    return this.http.put<ResponseDTO<UsuarioDTO>>(
      `${API_ENDPOINTS.atualizarUsuario}/${encodeURIComponent(email)}`,
      dto,
      this.authHeaders()
    );
  }

  /** Upload da foto (campo 'file' no form-data). Não setar Content-Type manualmente. */
  uploadFoto(idUsuario: number, file: File): Observable<ResponseDTO<string>> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ResponseDTO<string>>(
      `${API_ENDPOINTS.usuarios}/${idUsuario}/foto`,
      fd,
      this.authHeaders()
    );
  }

  /** URL de foto do usuário (útil pra exibir mesmo sem request) */
  fotoUrlOf(idUsuario: number): string {
    return `${API_ENDPOINTS.usuarios}/${idUsuario}/foto`;
  }
}
