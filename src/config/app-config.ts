export const API_BASE_URL = 'http://localhost:8085';

export const API_ENDPOINTS = {
  sexos: `${API_BASE_URL}/sexos`,
  usuarios: `${API_BASE_URL}/usuarios`,
  login: `${API_BASE_URL}/auth/login`,
  usuariosReset: `${API_BASE_URL}/usuarios/reset`,      
  verifyCode: `${API_BASE_URL}/auth/verify-code`,        
  atualizarUsuario: `${API_BASE_URL}/usuarios/atualizar`
};