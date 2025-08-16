// src/app/pages/signup/models.ts
export interface Sexo {
  idSexo: number;
  nome: string;
  ativo: number;
}

export interface CreateUserRequest {
  nome: string;
  nickname: string;
  senha: string;
  email: string;
  idSexo: number;
  idPerfil: number; // sempre 1
}

export interface ApiError {
  status: number;
  message: string;
  data: unknown;
}
