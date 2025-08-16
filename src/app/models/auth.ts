// src/app/models/auth.ts
export interface Sexo { idSexo: number; nome: string; ativo: number; }
export interface Perfil { idPerfil: number; nome: string; descricao: string; ativo: number; }

export interface UsuarioDTO {
  idUsuario: number;
  nome: string;
  nickname: string;
  email: string;
  sexo: Sexo;
  perfil: Perfil;
  dtcCriacao: string;
  ativo: number | null;
}

export interface ResponseDTO<T = any> {
  status: number;
  message: string;
  data: T;
}
