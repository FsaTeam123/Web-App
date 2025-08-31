import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

import { API_ENDPOINTS } from '../../../config/app-config';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { AppHeaderComponentFix } from '../../shared/ui/app-header-fixo/app-header-fixo.component';

type NomeDesc = { nome?: string; descricao?: string };
type TipoJogo = { idTipoJogo: number; nome: string };
type Usuario = { nickname?: string };

export interface Jogo {
  idJogo: number;
  titulo: string;
  qtdPessoas?: number;
  isEspecificClass?: 0 | 1;
  nivelInicial?: number;
  tipoJogo?: TipoJogo;
  geracaoMundo?: NomeDesc;
  estiloCampanha?: NomeDesc;
  historia?: NomeDesc;
  tema?: NomeDesc;
  master?: Usuario;
  senha?: string | null;
  dataCriacao?: string;
  ativo?: number;
  playerAtivos?: number;
  isCheio?: boolean;
}

export interface ClasseJogo {
  idClasse: number;
  nome: string;
  descricao?: string;
  imagem?: string;
  imagemContentType?: string;
}

@Component({
  selector: 'app-entrar-secao',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    PageShellComponent,
    AppFooterComponent,
    AppHeaderComponentFix
  ],
  templateUrl: './entrar-secao.component.html',
  styleUrls: ['./entrar-secao.component.css']
})
export class EntrarSecaoComponent implements OnInit {

  private http = inject(HttpClient);
  private router = inject(Router);

  siteName = 'Reinos Perdidos RPG';
  useAltBackground = true;

  loading = true;
  erro?: string;

  all: Jogo[] = [];
  filtered: Jogo[] = [];

  // busca principal (titulo ou #id)
  searchTerm = '';
  senhaErro = '';

  // filtros do painel
  showFilters = false;
  filtroGeracao = 'todos';
  filtroEstilo = 'todos';
  filtroHistoria = 'todos';
  filtroTema = 'todos';
  filtroTipo: 'todos'|'publico'|'privado' = 'todos';

  // opções dos selects (tentamos carregar dos endpoints; se falhar, caímos no fallback por jogos)
  opGeracao: string[] = [];
  opEstilo: string[] = [];
  opHistoria: string[] = [];
  opTema: string[] = [];

  // modal
  showModal = false;
  selected?: Jogo | null;
  loadingClasses = false;
  classesEspecificas: ClasseJogo[] = [];

  ngOnInit(): void {
    this.fetchJogos();
    this.loadTaxonomias();
  }

  fetchJogos() {
    this.loading = true;
    this.http.get<Jogo[]>(API_ENDPOINTS.jogos).subscribe({
        next: (data) => {
        const arr = Array.isArray(data) ? data : [];
        this.all = arr.map(j => ({
            ...j,
            isCheio: this.calcCheio(j)
        }));
        this.applyFilters();
        this.loading = false;
        this.buildOptionsFromJogos();
        },
        error: () => {
        this.erro = 'Falha ao carregar sessões.';
        this.loading = false;
        }
    });
  }

  // carrega listas para selects
  loadTaxonomias() {
    // Cada chamada é opcional; se falhar, o fallback monta pelas sessões.
    this.http.get<any[]>(API_ENDPOINTS.geracoesMundo).subscribe({ next: arr => this.opGeracao = dedupByNome(arr) });
    this.http.get<any[]>(API_ENDPOINTS.estilosCampanha).subscribe({ next: arr => this.opEstilo = dedupByNome(arr) });
    this.http.get<any[]>(API_ENDPOINTS.historias).subscribe({ next: arr => this.opHistoria = dedupByNome(arr) });
    this.http.get<any[]>(API_ENDPOINTS.temas).subscribe({ next: arr => this.opTema = dedupByNome(arr) });

    function dedupByNome(arr: any[] = []) {
      const set = new Set<string>();
      for (const a of arr) if (a?.nome) set.add(String(a.nome));
      return Array.from(set).sort();
    }
  }

  // fallback caso endpoints de taxonomia não estejam disponíveis
  private buildOptionsFromJogos() {
    const take = (getter: (j: Jogo)=>string|undefined) => {
      const set = new Set<string>();
      for (const j of this.all) { const v = getter(j); if (v) set.add(v); }
      return Array.from(set).sort();
    };
    if (!this.opGeracao?.length)  this.opGeracao  = take(j => j.geracaoMundo?.nome);
    if (!this.opEstilo?.length)   this.opEstilo   = take(j => j.estiloCampanha?.nome);
    if (!this.opHistoria?.length) this.opHistoria = take(j => j.historia?.nome);
    if (!this.opTema?.length)     this.opTema     = take(j => j.tema?.nome);
  }

  private calcCheio(j: Jogo): boolean {
    const total  = j.qtdPessoas ?? 0;
    const ativos = j.playerAtivos ?? 0;
    // “cheio” apenas quando IGUAL (e total > 0)
    return total > 0 && ativos === total;
  }

  // ===== busca + filtros =====
  onSearchTermChange(term: string) {
    this.searchTerm = term;
    this.applyFilters();
  }
  toggleFilters() { this.showFilters = !this.showFilters; }

  onSelectChange() { this.applyFilters(); }   // chamado por todos os selects

  private applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();

    this.filtered = this.all.filter(j => {
        // NÃO listar sessões cheias
        if (j.isCheio) return false;

        // 1) busca por título ou #id
        let passaBusca = true;
        if (term) {
        const numeric = term.startsWith('#') ? term.slice(1) : term;
        if (/^\d+$/.test(numeric)) {
            passaBusca = String(j.idJogo) === numeric;
        } else {
            passaBusca = (j.titulo || '').toLowerCase().includes(term);
        }
        }
        if (!passaBusca) return false;

        // 2) tipo
        const tipoNome = (j.tipoJogo?.nome || '').toLowerCase();
        const passaTipo =
        this.filtroTipo === 'todos' ||
        (this.filtroTipo === 'publico' && tipoNome.includes('public')) ||
        (this.filtroTipo === 'privado' && tipoNome.includes('priv'));
        if (!passaTipo) return false;

        // 3) selects
        const by = (vSel: string, vItem?: string) =>
        vSel === 'todos' || (vItem || '').toLowerCase() === vSel.toLowerCase();

        if (!by(this.filtroGeracao,  j.geracaoMundo?.nome)) return false;
        if (!by(this.filtroEstilo,   j.estiloCampanha?.nome)) return false;
        if (!by(this.filtroHistoria, j.historia?.nome)) return false;
        if (!by(this.filtroTema,     j.tema?.nome)) return false;

        return true;
    });
  }

  // ===== modal =====
  abrirModal(j: Jogo) {
    this.selected = j;
    this.showModal = true;
    this.classesEspecificas = [];

    if (j.isEspecificClass === 1) {
      this.loadingClasses = true;
      this.http.get<ClasseJogo[]>(`${API_ENDPOINTS.classeJogo}/${j.idJogo}`).subscribe({
        next: (resp) => {
          this.classesEspecificas = Array.isArray(resp) ? resp : [];
          this.loadingClasses = false;
        },
        error: () => { this.loadingClasses = false; }
      });
    }
  }
  fecharModal() {
    this.showModal = false;
    this.selected = null;
    this.classesEspecificas = [];
    this.senhaErro = '';
  }

  entrarSessao() {
    if (!this.selected) return;
    this.router.navigate(['/criar-personagem'], { queryParams: { jogo: this.selected.idJogo } });
  }

  // helpers
  tipoBadge(j: Jogo) {
    const t = j?.tipoJogo?.nome?.toLowerCase() || '';
    return t.includes('priv') ? 'Privado' : 'Público';
  }
  infoLinha(j: Jogo) {
    const partes = [
      j?.geracaoMundo?.nome,
      j?.estiloCampanha?.nome,
      j?.tema?.nome
    ].filter(Boolean);
    return partes.join(' · ');
  }

  resetFilters() {
    this.filtroGeracao = 'todos';
    this.filtroEstilo = 'todos';
    this.filtroHistoria = 'todos';
    this.filtroTema = 'todos';
    this.filtroTipo = 'todos';
    this.applyFilters(); // método continua private
  }

  onFiltroGeracaoChange(v: string)  { this.filtroGeracao  = v; this.applyFilters(); }
  onFiltroEstiloChange(v: string)   { this.filtroEstilo   = v; this.applyFilters(); }
  onFiltroHistoriaChange(v: string) { this.filtroHistoria = v; this.applyFilters(); }
  onFiltroTemaChange(v: string)     { this.filtroTema     = v; this.applyFilters(); }

  onTipoSelectChange(v: string) {
    if (v === 'todos' || v === 'publico' || v === 'privado') {
        this.filtroTipo = v;
        this.applyFilters();
    }
  }

  isFull(j: Jogo): boolean {
    const ativos = j.playerAtivos ?? 0;
    const total  = j.qtdPessoas ?? 0;
    return total > 0 && ativos >= total;
  }

  // (se quiser usar em outros lugares)
  peopleText(j: Jogo): string {
    const ativos = j.playerAtivos ?? 0;
    const total  = j.qtdPessoas ?? 0;
    return `${ativos}/${total}`;
  }

  isPrivado(j?: Jogo | null): boolean {
  const t = j?.tipoJogo?.nome?.toLowerCase() || '';
  return t.includes('priv');
}

private goCriarPersonagem() {
  // navega já com o id do jogo
  if (!this.selected) return;
  this.router.navigate(['/criar-personagem'], { queryParams: { jogo: this.selected.idJogo } });
}

// usada quando a sessão NÃO é privada
entrarSessaoDireto() {
  if (!this.selected) return;
  this.goCriarPersonagem();
}

// valida a senha digitada contra a senha da sessão (vinda do backend)
confirmarSenha(valorDigitado: string) {
  if (!this.selected) return;
  const correta = (valorDigitado || '').trim() === (this.selected.senha || '').trim();
  if (!correta) {
    this.senhaErro = 'Senha incorreta.';
    return;
  }
  this.senhaErro = '';
  this.goCriarPersonagem();
}
}
