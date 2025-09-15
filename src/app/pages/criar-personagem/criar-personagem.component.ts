// src/app/pages/criar-personagem/criar-personagem.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { API_ENDPOINTS } from '../../../config/app-config';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { AppHeaderComponentFix } from '../../shared/ui/app-header-fixo/app-header-fixo.component';
import { UserSessionService } from '../../core/session/user-session.service';

import { forkJoin, of } from 'rxjs';
import { switchMap, map, catchError, finalize } from 'rxjs/operators';

type Habilidade = { id: number; nome: string; descricao?: string; ativo?: number };

type Raca = {
  idRaca: number;
  nome: string;
  descricao?: string;
  ativo?: number;
  habilidades?: Habilidade[];
  fotoBase64?: string;
  fotoMime?: string;
  imagem?: string;
  imagemContentType?: string;
};

type Proeficiencia = { idProeficiencia: number; nome: string; descricao?: string; ativo?: number };
type Atributo = { idAtributo: number; nome: string; descricao?: string; ativo?: number };

// Amplie o tipo já existente para também aceitar atributo vindo do /pericias
type Pericia = {
  idPericia: number;
  nome: string;
  descricao?: string;
  ativo?: number;
  atributo?: Atributo | null;          // <-- novo
  imagem?: string | null;
  imagemContentType?: string | null;
  imagemFilename?: string | null;
};

type Classe = {
  idClasse: number;
  nome: string;
  descricao?: string;
  ativo?: number;
  imagemBase64?: string;
  imagemContentType?: string;
  proeficiencias?: Proeficiencia[];
  pericias?: Pericia[];
};

type Origem = {
  idOrigem: number;
  nome: string;
  descricao?: string;
  ativo?: number;
  imagem?: string | null;
  imagemContentType?: string | null;
  imagemFilename?: string | null;
};

type Divindade = {
  idDivindade: number;
  nome: string;
  descricao?: string;
  ativo?: number;
  imagem?: string | null;
  imagemContentType?: string | null;
  imagemFilename?: string | null;
};

type Arma = {
  idArma: number;
  nome: string;
  descricao?: string;
  dano?: string;
  critico?: string;
  alcance?: string;
  preco?: string;
  ativo?: number;
  imagem?: string | null;
  imagemContentType?: string | null;
  tipoDano?: { idTipoDano: number; nome: string; descricao?: string; ativo?: number } | null;
  tipoArma?: { idTipoArma: number; nome: string; descricao?: string; ativo?: number } | null;
};

type Magia = {
  idMagia: number;
  nome: string;
  descricao?: string;
  duracao?: string;
  alvoArea?: string;
  custo?: number;
  circulo?: number;
  dano?: string;
  ativo?: number;
  imagem?: string | null;
  imagemContentType?: string | null;
  escolaMagia?: { idEscolaMagia: number; nome: string; descricao?: string; ativo?: number } | null;
  execucaoMagia?: { idExecucaoMagia: number; nome: string; descricao?: string; ativo?: number } | null;
  tipoMagia?: { idTipoMagia: number; nome: string; descricao?: string; ativo?: number } | null;
  resistencia?: { idResistencia: number; nome: string; descricao?: string; ativo?: number } | null;
};

type Poder = {
  idPoder: number;
  nome: string;
  descricao?: string;
  tipoPoder?: { idTipoPoder: number; nome: string; descricao?: string } | null;
  imagem?: string | null;
  imagemContentType?: string | null;
  imagemFilename?: string | null;
};

@Component({
  selector: 'app-criar-personagem',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    PageShellComponent,
    AppFooterComponent,
    AppHeaderComponentFix
  ],
  templateUrl: './criar-personagem.component.html',
  styleUrls: ['./criar-personagem.component.css']
})
export class CriarPersonagemComponent implements OnInit {

  Math = Math;
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private session = inject(UserSessionService);

  showHelp = false;

  isSaving = false;
  idUsuario?: number;

  openHelp()  { this.showHelp = true;  }
  closeHelp() { this.showHelp = false; }

  siteName = 'Reinos Perdidos RPG';
  useAltBackground = true;

  idJogo?: number;

  // form
  nome = '';
  fotoB64?: string;
  fotoMime?: string;
  erro?: string;

  selectedArmas: Arma[] = [];
  selectedMagias: Magia[] = [];
  selectedPoderes: Poder[] = [];

  // ===== R A Ç A =====
  loadingRacas = true;
  deckOpenRaca = false;
  racas: Raca[] = [];
  currentRaca = 0;
  selectedRaca?: Raca;

  // ===== C L A S S E =====
  loadingClassesList = true;
  deckOpenClasse = false;
  classes: Classe[] = [];
  currentClasse = 0;
  selectedClasse?: Classe;

  // ===== O R I G E M =====
  loadingOrigens = true;
  deckOpenOrigem = false;
  origens: Origem[] = [];
  currentOrigem = 0;
  selectedOrigem?: Origem;

  // ===== D I V I N D A D E =====
  loadingDivindades = true;
  deckOpenDivindade = false;
  divindades: Divindade[] = [];
  currentDiv = 0;
  selectedDivindade?: Divindade;

  // ===== A R M A =====
  loadingArmas = true;
  deckOpenArma = false;
  armas: Arma[] = [];
  currentArma = 0;
  selectedArma?: Arma;

  // ===== M A G I A =====
  loadingMagias = true;
  deckOpenMagia = false;
  magias: Magia[] = [];
  currentMagia = 0;
  selectedMagia?: Magia;
  
  // ===== P O D E R =====
  loadingPoderes = true;
  deckOpenPoder = false;
  poderes: Poder[] = [];
  currentPoder = 0;
  selectedPoder?: Poder;

  // ===== P E R Í C I A S =====
  loadingPericias = true;
  pericias: Pericia[] = [];
  periciasByAttr: Record<number, Pericia[]> = {};
  selectedPericiasByAttr: Record<number, number[]> = {};

  // expand/collapse dos resumos
  expandRaca = false;
  expandClasse = false;
  expandOrigem = false;
  expandDivindade = false;
  expandArma = false;
  expandMagia = false;
  expandPoder = false;

  attrs: { 
    forca: string; 
    destreza: string; 
    constituicao: string; 
    sabedoria: string; 
    inteligencia: string; 
    carisma: string;
  } = { forca: '', destreza: '', constituicao: '', sabedoria: '', inteligencia: '', carisma: '' };

  vitals: { pv: string; pm: string } = { pv: '', pm: '' };

  tibares: { ouro: string; prata: string; cobre: string } = { ouro: '', prata: '', cobre: '' };

  showCardModal = false;
  cardKind: 'arma' | 'magia' | 'poder' | null = null;
  cardData: any = null;

  isFlipped = false;                // controla frente/verso
  cardImgSrc: string | null = null;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('jogo');
    this.idJogo = q ? Number(q) : undefined;

    const idU =
      localStorage.getItem('idUsuario') ||
      sessionStorage.getItem('idUsuario') ||
      localStorage.getItem('userId');
    this.idUsuario = idU ? Number(idU) : undefined;

    console.log('RPG: criar personagem, idUsuario:', this.idUsuario, 'idJogo:', this.idJogo);

    this.fetchRacas();
    this.fetchClasses();
    this.fetchOrigens();
    this.fetchDivindades();
    this.fetchArmas();
    this.fetchMagias();
    this.fetchPoderes();
    this.fetchPericias();
  }

  onTibarInput(key: keyof typeof this.tibares, e: Event) {
    const el = e.target as HTMLInputElement;
    // mantém apenas dígitos e limita a 4
    let v = (el.value || '').replace(/\D/g, '').slice(0, 4);
    this.tibares[key] = v;
  }

  onTibarBlur(key: keyof typeof this.tibares) {
    const v = (this.tibares[key] || '').replace(/\D/g, '');
    // se houver valor, pad para 4 dígitos; se vazio, deixa vazio
    this.tibares[key] = v ? v.padStart(4, '0') : '';
  }

  onVitalInput(key: keyof typeof this.vitals, e: Event) {
    const el = e.target as HTMLInputElement;
    // Mantém só dígitos e limita a 3
    let v = (el.value || '').replace(/\D/g, '').slice(0, 3);
    this.vitals[key] = v;
  }

  onVitalBlur(key: keyof typeof this.vitals) {
    const v = (this.vitals[key] || '').replace(/\D/g, '');
    // Se tiver valor, completa com zeros à esquerda até 3 dígitos
    this.vitals[key] = v ? v.padStart(3, '0') : '';
  }

  onAttrInput(key: keyof typeof this.attrs, e: Event) {
    const el = e.target as HTMLInputElement;
    let v = (el.value || '').replace(',', '.');

    // Mantém apenas dígitos e no máximo um ponto decimal
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      // remove pontos extras
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    // Limita a 2 decimais se houver ponto
    if (firstDot !== -1) {
      const [int, dec] = v.split('.');
      v = int.slice(0, 2) + '.' + (dec ?? '').slice(0, 2);
    } else {
      // só inteiros até 2 dígitos
      v = v.slice(0, 2);
    }

    // Não deixa passar de 99 (ou 99.99 se quiser permitir)
    const num = parseFloat(v || '0');
    if (!isNaN(num)) {
      if (num > 99.99) v = '99.99';
      if (num === 0) v = ''; // sem zero
    }

    this.attrs[key] = v;
  }
  
  private toInt(v?: string): number {
    if (!v) return 0;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  private getPlayerIdFromResponse(res: any): number | undefined {
    return res?.idPlayer ?? res?.playerId ?? res?.id;
  }

  // ---------- R A Ç A ----------
  fetchRacas() {
    this.loadingRacas = true;
    this.http.get<Raca[]>(API_ENDPOINTS.racas).subscribe({
      next: (arr) => {
        this.racas = Array.isArray(arr) ? arr : [];
        this.currentRaca = 0;
        this.loadingRacas = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as raças.';
        this.loadingRacas = false;
      }
    });
  }

  openRaceDeck()  { if (!this.deckOpenRaca) this.deckOpenRaca = true; }
  closeRaceDeck() { this.deckOpenRaca = false; }
  prevRace() { if (this.racas.length) this.currentRaca = (this.currentRaca - 1 + this.racas.length) % this.racas.length; }
  nextRace() { if (this.racas.length) this.currentRaca = (this.currentRaca + 1) % this.racas.length; }
  chooseCurrentRace() { if (this.racas.length) { this.selectedRaca = this.racas[this.currentRaca]; this.deckOpenRaca = false; } }
  leftIndexRaca()  { return this.racas.length ? (this.currentRaca - 1 + this.racas.length) % this.racas.length : 0; }
  rightIndexRaca() { return this.racas.length ? (this.currentRaca + 1) % this.racas.length : 0; }

  // ---------- C L A S S E ----------
  fetchClasses() {
    this.loadingClassesList = true;
    this.http.get<Classe[]>(API_ENDPOINTS.classes).subscribe({
      next: (arr) => {
        this.classes = Array.isArray(arr) ? arr : [];
        this.currentClasse = 0;
        this.loadingClassesList = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as classes.';
        this.loadingClassesList = false;
      }
    });
  }

  openClassDeck()  { if (!this.deckOpenClasse) this.deckOpenClasse = true; }
  closeClassDeck() { this.deckOpenClasse = false; }
  prevClass() { if (this.classes.length) this.currentClasse = (this.currentClasse - 1 + this.classes.length) % this.classes.length; }
  nextClass() { if (this.classes.length) this.currentClasse = (this.currentClasse + 1) % this.classes.length; }
  chooseCurrentClass() { if (this.classes.length) { this.selectedClasse = this.classes[this.currentClasse]; this.deckOpenClasse = false; } }
  leftIndexClasse()  { return this.classes.length ? (this.currentClasse - 1 + this.classes.length) % this.classes.length : 0; }
  rightIndexClasse() { return this.classes.length ? (this.currentClasse + 1) % this.classes.length : 0; }

  // ---------- O R I G E M ----------
  fetchOrigens() {
    this.loadingOrigens = true;
    this.http.get<Origem[]>(API_ENDPOINTS.origens).subscribe({
      next: (arr) => {
        this.origens = Array.isArray(arr) ? arr : [];
        this.currentOrigem = 0;
        this.loadingOrigens = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as origens.';
        this.loadingOrigens = false;
      }
    });
  }

  openOrigemDeck()  { if (!this.deckOpenOrigem) this.deckOpenOrigem = true; }
  closeOrigemDeck() { this.deckOpenOrigem = false; }
  prevOrigem() { if (this.origens.length) this.currentOrigem = (this.currentOrigem - 1 + this.origens.length) % this.origens.length; }
  nextOrigem() { if (this.origens.length) this.currentOrigem = (this.currentOrigem + 1) % this.origens.length; }
  chooseCurrentOrigem() { if (this.origens.length) { this.selectedOrigem = this.origens[this.currentOrigem]; this.deckOpenOrigem = false; } }
  leftIndexOrigem()  { return this.origens.length ? (this.currentOrigem - 1 + this.origens.length) % this.origens.length : 0; }
  rightIndexOrigem() { return this.origens.length ? (this.currentOrigem + 1) % this.origens.length : 0; }

  // ---------- D I V I N D A D E ----------
  fetchDivindades() {
    this.loadingDivindades = true;
    this.http.get<Divindade[]>(API_ENDPOINTS.divindades).subscribe({
      next: (arr) => {
        this.divindades = Array.isArray(arr) ? arr : [];
        this.currentDiv = 0;
        this.loadingDivindades = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as divindades.';
        this.loadingDivindades = false;
      }
    });
  }

  openDivDeck()  { if (!this.deckOpenDivindade) this.deckOpenDivindade = true; }
  closeDivDeck() { this.deckOpenDivindade = false; }
  prevDiv() { if (this.divindades.length) this.currentDiv = (this.currentDiv - 1 + this.divindades.length) % this.divindades.length; }
  nextDiv() { if (this.divindades.length) this.currentDiv = (this.currentDiv + 1) % this.divindades.length; }
  chooseCurrentDiv() { if (this.divindades.length) { this.selectedDivindade = this.divindades[this.currentDiv]; this.deckOpenDivindade = false; } }
  leftIndexDiv()  { return this.divindades.length ? (this.currentDiv - 1 + this.divindades.length) % this.divindades.length : 0; }
  rightIndexDiv() { return this.divindades.length ? (this.currentDiv + 1) % this.divindades.length : 0; }

  // ---------- A R M A ----------
  fetchArmas() {
    this.loadingArmas = true;
    this.http.get<Arma[]>(API_ENDPOINTS.armas).subscribe({
      next: (arr) => {
        this.armas = Array.isArray(arr) ? arr : [];
        this.currentArma = 0;
        this.loadingArmas = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as armas.';
        this.loadingArmas = false;
      }
    });
  }
  openArmaDeck()  { if (!this.deckOpenArma) this.deckOpenArma = true; }
  closeArmaDeck() { this.deckOpenArma = false; }
  prevArma()      { if (this.armas.length) this.currentArma = (this.currentArma - 1 + this.armas.length) % this.armas.length; }
  nextArma()      { if (this.armas.length) this.currentArma = (this.currentArma + 1) % this.armas.length; }
  chooseCurrentArma() {
    if (this.armas.length) {
      const a = this.armas[this.currentArma];
      this.selectedArma = a; // mantém compatibilidade com seu fluxo atual
      if (!this.selectedArmas.some(x => x.idArma === a.idArma)) {
        this.selectedArmas.unshift(a);
      }
      this.deckOpenArma = false;
    }
  }
  leftIndexArma()  { return this.armas.length ? (this.currentArma - 1 + this.armas.length) % this.armas.length : 0; }
  rightIndexArma() { return this.armas.length ? (this.currentArma + 1) % this.armas.length : 0; }

  // ---------- M A G I A ----------
  fetchMagias() {
    this.loadingMagias = true;
    this.http.get<Magia[]>(API_ENDPOINTS.magias).subscribe({
      next: (arr) => {
        this.magias = Array.isArray(arr) ? arr : [];
        this.currentMagia = 0;
        this.loadingMagias = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as magias.';
        this.loadingMagias = false;
      }
    });
  }
  openMagiaDeck()  { if (!this.deckOpenMagia) this.deckOpenMagia = true; }
  closeMagiaDeck() { this.deckOpenMagia = false; }
  prevMagia()      { if (this.magias.length) this.currentMagia = (this.currentMagia - 1 + this.magias.length) % this.magias.length; }
  nextMagia()      { if (this.magias.length) this.currentMagia = (this.currentMagia + 1) % this.magias.length; }
  chooseCurrentMagia() {
    if (this.magias.length) {
      const m = this.magias[this.currentMagia];
      this.selectedMagia = m;
      if (!this.selectedMagias.some(x => x.idMagia === m.idMagia)) {
        this.selectedMagias.unshift(m);
      }
      this.deckOpenMagia = false;
    }
  }
  leftIndexMagia()  { return this.magias.length ? (this.currentMagia - 1 + this.magias.length) % this.magias.length : 0; }
  rightIndexMagia() { return this.magias.length ? (this.currentMagia + 1) % this.magias.length : 0; }

  // ---------- P O D E R ----------
  fetchPoderes() {
    this.loadingPoderes = true;
    this.http.get<Poder[]>(API_ENDPOINTS.poderes).subscribe({
      next: (arr) => {
        this.poderes = Array.isArray(arr) ? arr : [];
        this.currentPoder = 0;
        this.loadingPoderes = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar os poderes.';
        this.loadingPoderes = false;
      }
    });
  }
  openPoderDeck()  { if (!this.deckOpenPoder) this.deckOpenPoder = true; }
  closePoderDeck() { this.deckOpenPoder = false; }
  prevPoder()      { if (this.poderes.length) this.currentPoder = (this.currentPoder - 1 + this.poderes.length) % this.poderes.length; }
  nextPoder()      { if (this.poderes.length) this.currentPoder = (this.currentPoder + 1) % this.poderes.length; }
  chooseCurrentPoder() {
    if (this.poderes.length) {
      const p = this.poderes[this.currentPoder];
      this.selectedPoder = p;
      if (!this.selectedPoderes.some(x => x.idPoder === p.idPoder)) {
        this.selectedPoderes.unshift(p);
      }
      this.deckOpenPoder = false;
    }
  }
  leftIndexPoder()  { return this.poderes.length ? (this.currentPoder - 1 + this.poderes.length) % this.poderes.length : 0; }
  rightIndexPoder() { return this.poderes.length ? (this.currentPoder + 1) % this.poderes.length : 0; }

  fetchPericias() {
    this.loadingPericias = true;
    this.http.get<Pericia[]>(API_ENDPOINTS.pericias).subscribe({
      next: (arr) => {
        this.pericias = Array.isArray(arr) ? arr : [];

        const map: Record<number, Pericia[]> = {};
        for (const p of this.pericias) {
          const id = p.atributo?.idAtributo ?? -1;
          if (!map[id]) map[id] = [];
          map[id].push(p);
        }
        this.periciasByAttr = map;

        // garante array para o ngModel de cada caixa
        Object.keys(this.periciasByAttr).forEach(k => {
          const id = Number(k);
          if (!this.selectedPericiasByAttr[id]) this.selectedPericiasByAttr[id] = [];
        });

        this.loadingPericias = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as perícias.';
        this.loadingPericias = false;
      }
    });
  }

  // abreviação: 3 primeiras letras em maiúsculo (ex.: DES, FOR, INT)
  abbrAtributo(a?: Atributo | null) {
    return (a?.nome || '?').slice(0, 3).toUpperCase();
  }

  // ids de atributo ordenados (para *ngFor)
  attrIds(): number[] {
    return Object.keys(this.periciasByAttr).map(Number).filter(n => n >= 0).sort((a,b)=>a-b);
  }

  // ---------- IMG helpers ----------
  imgSrcRaca(r?: Raca): string | null {
    if (!r) return null;
    let raw = r.fotoBase64 ?? r.imagem ?? null;
    if (!raw) return null;
    if (/^data:.*;base64,/i.test(raw)) return raw.replace(/\s/g, '');
    const mime = r.fotoMime || r.imagemContentType || 'image/png';
    return `data:${mime};base64,${(raw || '').replace(/\s/g, '')}`;
  }

  imgSrcClasse(c?: Classe): string | null {
    if (!c) return null;
    const b64 = (c.imagemBase64 || '').replace(/\s/g, '');
    if (!b64) return null;
    const mime = c.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(b64)) return b64;
    return `data:${mime};base64,${b64}`;
  }

  imgSrcOrigem(o?: Origem): string | null {
    if (!o || !o.imagem) return null;
    const raw = (o.imagem || '').replace(/\s/g, '');
    const mime = o.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(raw)) return raw;
    return `data:${mime};base64,${raw}`;
  }

  imgSrcDivindade(d?: Divindade): string | null {
    if (!d || !d.imagem) return null;
    const raw = (d.imagem || '').replace(/\s/g, '');
    const mime = d.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(raw)) return raw;
    return `data:${mime};base64,${raw}`;
  }

  imgSrcArma(a?: Arma): string | null {
    if (!a || !a.imagem) return null;
    const raw = (a.imagem || '').replace(/\s/g, '');
    const mime = a.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(raw)) return raw;
    return `data:${mime};base64,${raw}`;
  }

  imgSrcMagia(m?: Magia): string | null {
    if (!m || !m.imagem) return null;
    const raw = (m.imagem || '').replace(/\s/g, '');
    const mime = m.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(raw)) return raw;
    return `data:${mime};base64,${raw}`;
  }

  imgSrcPoder(p?: Poder): string | null {
    if (!p || !p.imagem) return null;
    const raw = (p.imagem || '').replace(/\s/g, '');
    const mime = p.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(raw)) return raw;
    return `data:${mime};base64,${raw}`;
  }

  // foto do personagem (arquivo -> base64)
  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const comma = res.indexOf(',');
      this.fotoMime = file.type || 'image/png';
      this.fotoB64 = comma >= 0 ? res.slice(comma + 1) : res;
    };
    reader.readAsDataURL(file);
  }

  openCard(kind: 'arma' | 'magia' | 'poder', data: any) {
    this.cardKind = kind;
    this.cardData = data;
    this.showCardModal = true;
    this.isFlipped = false; // começa mostrando a frente

    // imagem da frente conforme o tipo
    this.cardImgSrc = kind === 'arma'  ? this.imgSrcArma(data)
                    : kind === 'magia' ? this.imgSrcMagia(data)
                                      : this.imgSrcPoder(data);

    setTimeout(() => document.getElementById('cardModal')?.focus(), 0);
  }

  toggleCardFace() {
    this.isFlipped = !this.isFlipped;
  }

  closeCardModal() {
    this.showCardModal = false;
    this.cardKind = null;
    this.cardData = null;
    this.cardImgSrc = null;
    this.isFlipped = false;
  }

  removeSelected(kind: 'arma'|'magia'|'poder', id: number) {
    if (kind === 'arma')   this.selectedArmas   = this.selectedArmas.filter(a => a.idArma   !== id);
    if (kind === 'magia')  this.selectedMagias  = this.selectedMagias.filter(m => m.idMagia !== id);
    if (kind === 'poder')  this.selectedPoderes = this.selectedPoderes.filter(p => p.idPoder!== id);
  }

  isPericiaChecked(attrId: number, idPericia: number): boolean {
    const arr = this.selectedPericiasByAttr[attrId] || [];
    return arr.includes(idPericia);
  }

  onTogglePericia(attrId: number, idPericia: number, checked: boolean) {
    const arr = this.selectedPericiasByAttr[attrId] ?? (this.selectedPericiasByAttr[attrId] = []);
    const i = arr.indexOf(idPericia);
    if (checked && i === -1) arr.push(idPericia);
    if (!checked && i !== -1) arr.splice(i, 1);
  }

  continuar() {
  if (!this.nome.trim()) { this.erro = 'Informe um nome para o personagem.'; return; }
  if (!this.selectedRaca) { this.erro = 'Escolha uma raça.'; return; }
  if (!this.selectedClasse) { this.erro = 'Escolha uma classe.'; return; }

  // sessão -> pega id de forma tolerante
  const user = this.session.get(); // pode ser null
  const userId = this.session.get()?.idUsuario ?? this.idUsuario; // <- só props válidas
  if (!userId) {
    this.erro = 'Não consegui identificar seu usuário. Faça login novamente.';
    return;
  }

  this.erro = '';
  this.isSaving = true;

  const pv = this.toInt(this.vitals.pv);
  const pm = this.toInt(this.vitals.pm);

  const body: any = {
    nome: this.nome.trim(),

    forca:        this.toInt(this.attrs.forca),
    destreza:     this.toInt(this.attrs.destreza),
    sabedoria:    this.toInt(this.attrs.sabedoria),
    constituicao: this.toInt(this.attrs.constituicao),
    inteligencia: this.toInt(this.attrs.inteligencia),
    carisma:      this.toInt(this.attrs.carisma),

    pv, pvMax: pv || 0, pvTemp: 0,
    pm, pmMax: pm || 0, pmTemp: 0,

    idUsuario: userId,                 // ✅ agora sempre definido
    idJogo: this.idJogo,
    idOrigem: this.selectedOrigem?.idOrigem ?? null,
    idRaca: this.selectedRaca.idRaca,
    idRiqueza: 1,
    idDivindade: this.selectedDivindade?.idDivindade ?? null,
    idClasse: this.selectedClasse.idClasse,
    idTamanho: 1
  };

  this.http.post<any>(API_ENDPOINTS.players, body).pipe(
    switchMap((res) => {
      const playerId = this.getPlayerIdFromResponse(res);
      if (!playerId) throw new Error('Resposta sem idPlayer.');

      const calls = [];

      // perícias (dedupe)
      const periciaIds = Array.from(new Set(Object.values(this.selectedPericiasByAttr).flat()));
      for (const periciaId of periciaIds) {
        calls.push(this.http.post(API_ENDPOINTS.pericia_player, { playerId, periciaId }));
      }

      for (const p of this.selectedPoderes) {
        calls.push(this.http.post(API_ENDPOINTS.poder_player, { playerId, poderId: p.idPoder }));
      }

      for (const m of this.selectedMagias) {
        calls.push(this.http.post(API_ENDPOINTS.magia_player, { playerId, magiaId: m.idMagia }));
      }

      return calls.length ? forkJoin(calls).pipe(map(() => playerId)) : of(playerId);
    }),
    catchError((err) => {
      const msg = err?.error?.message || err?.message || 'Falha ao salvar.';
      this.erro = `Não foi possível salvar o personagem. ${msg}`;
      return of(null);
    }),
    finalize(() => this.isSaving = false)
    ).subscribe((playerId) => {
      if (playerId) this.router.navigate(['/minhas-sessoes']);
    });
  }
};