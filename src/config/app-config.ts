export const API_BASE_URL = 'https://t7tsd4gbsd.execute-api.sa-east-1.amazonaws.com'; // Base URL for the API

export const API_ENDPOINTS = {
  sexos: `${API_BASE_URL}/sexos`,
  usuarios: `${API_BASE_URL}/usuarios`,
  login: `${API_BASE_URL}/auth/login`,
  usuariosReset: `${API_BASE_URL}/usuarios/reset`,      
  verifyCode: `${API_BASE_URL}/auth/verify-code`,        
  atualizarUsuario: `${API_BASE_URL}/usuarios/atualizar`,
  usuarioFoto: (id: number) => `${API_BASE_URL}/usuarios/${id}/foto`,
};

export const DEFAULT_AVATAR_PATH = '/assets/perfil-padrao.jpg';