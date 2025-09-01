export const API_BASE_URL = 'http://localhost:8085'; // REST base

// REST endpoints
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
  racas: `${API_BASE_URL}/racas`,
  jogosPorMestre: (id: number) => `${API_BASE_URL}/jogos/user/mestrado/${id}`,
  jogosPorJogador: (id: number) => `${API_BASE_URL}/jogos/user/jogador/${id}`,
  playersPorJogo: (idJogo: number) => `${API_BASE_URL}/players/jogo/${idJogo}`,
};

// assets
export const DEFAULT_AVATAR_PATH = '/assets/perfil-padrao.jpg';

// <<< NOVO: endpoints WebSocket/STOMP centralizados >>>
export const WS_ENDPOINTS = {
  // SockJS endpoint registrado no seu backend: registry.addEndpoint("/ws")
  sockJs: `${API_BASE_URL}/ws`,

  // destinos do broker para ASSINAR (conforme seu WebSocketConfig.enableSimpleBroker("/topic"))
  topics: {
    mesa: (idJogo: number) => `/topic/mesa/${idJogo}`,
    mesaStatus: (idJogo: number) => `/topic/mesa/${idJogo}/status`,
  },

  // destinos de aplicação para ENVIAR (se/quando precisar)
  app: {
    presence: (idJogo: number) => `/app/mesa/${idJogo}/presence`,
  },
};
