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
type Pericia       = { idPericia: number;       nome: string; descricao?: string; ativo?: number };

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

  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  showHelp = false;

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

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('jogo');
    this.idJogo = q ? Number(q) : undefined;

    this.fetchRacas();
    this.fetchClasses();
    this.fetchOrigens();
    this.fetchDivindades();
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

  continuar() {
    if (!this.nome.trim()) { this.erro = 'Informe um nome para o personagem.'; return; }
    if (!this.selectedRaca) { this.erro = 'Escolha uma raça.'; return; }
    if (!this.selectedClasse) { this.erro = 'Escolha uma classe.'; return; }
    this.erro = '';

    const queryParams: any = {
      jogo: this.idJogo,
      nome: this.nome,
      raca: this.selectedRaca?.idRaca,
      classe: this.selectedClasse?.idClasse
    };

    if (this.selectedOrigem)    queryParams.origem    = this.selectedOrigem.idOrigem;
    if (this.selectedDivindade) queryParams.divindade = this.selectedDivindade.idDivindade;

    // atributos: só envia os que tiverem valor
    Object.entries(this.attrs).forEach(([k, v]) => {
      if (v && v.trim() !== '') queryParams[k] = v.trim();
    });
    
    Object.entries(this.vitals).forEach(([k, v]) => {
      if (v && v.trim() !== '') queryParams[k] = v.trim();
    });

    Object.entries(this.tibares).forEach(([k, v]) => {
      if (v && v.trim() !== '') queryParams[k] = v.trim();
    });

    this.router.navigate(['/criar-personagem/classe'], { queryParams });
  }
};