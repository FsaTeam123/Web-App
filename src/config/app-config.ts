export const API_BASE_URL = 'http://localhost:8085'; // Base URL for the API

export const API_ENDPOINTS = {
  sexos: `${API_BASE_URL}/sexos`,
  usuarios: `${API_BASE_URL}/usuarios`,
  login: `${API_BASE_URL}/auth/login`,
  usuariosReset: `${API_BASE_URL}/usuarios/reset`,      
  verifyCode: `${API_BASE_URL}/auth/verify-code`,        
  atualizarUsuario: `${API_BASE_URL}/usuarios/atualizar`,
  usuarioFoto: (id: number) => `${API_BASE_URL}/usuarios/${id}/foto`,
  classes: `${API_BASE_URL}/classes`,
  jogos: `${API_BASE_URL}/jogos`,
  classeJogo: `${API_BASE_URL}/classe-jogo`,
  geracoesMundo: `${API_BASE_URL}/geracoe-mundo`,        
  estilosCampanha: `${API_BASE_URL}/estilos-campanha`,
  historias: `${API_BASE_URL}/historia`,
  temas: `${API_BASE_URL}/temas`,
  jogosPorMestre: (id: number) => `${API_BASE_URL}/jogos/user/mestrado/${id}`,
  jogosPorJogador: (id: number) => `${API_BASE_URL}/jogos/user/jogador/${id}`
};

export const DEFAULT_AVATAR_PATH = '/assets/perfil-padrao.jpg';