export const API_BASE_URL = 'http://localhost:8085'; // REST base

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

  // <<< NOVOS ENDPOINTS >>>
  origens: `${API_BASE_URL}/origens`,
  divindades: `${API_BASE_URL}/divindades`,
  armas: `${API_BASE_URL}/armas`,
  magias: `${API_BASE_URL}/magias`,
  poderes: `${API_BASE_URL}/poderes`,
  pericias: `${API_BASE_URL}/pericias`,
  players: `${API_BASE_URL}/players`,
  poder_player: `${API_BASE_URL}/poder-player`,
  pericia_player: `${API_BASE_URL}/pericia-player`,
  magia_player: `${API_BASE_URL}/magia-player`,
};

// assets
export const DEFAULT_AVATAR_PATH = '/assets/perfil-padrao.jpg';

// WebSocket/STOMP centralizados (se usar)
export const WS_ENDPOINTS = {
  sockJs: '/ws',
  topics: {
    mesa: (idJogo: number) => `/topic/mesa/${idJogo}`,
    mesaStatus: (idJogo: number) => `/topic/mesa/${idJogo}/status`,
    chat: (id:number)=> `/topic/chat.${id}`,
  },
  app: {
    presence: (idJogo: number) => `/app/mesa/${idJogo}/presence`,
    chatSend: (id:number)=> `/app/chat.${id}.message`,
  },
};
