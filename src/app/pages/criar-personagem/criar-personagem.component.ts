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

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('jogo');
    this.idJogo = q ? Number(q) : undefined;

    this.fetchRacas();
    this.fetchClasses();
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

  // ---------- IMG helpers ----------
  imgSrcRaca(r?: Raca): string | null {
    if (!r) return null;
    let raw = r.fotoBase64 ?? r.imagem ?? null;
    if (!raw) return null;
    if (/^data:.*;base64,/i.test(raw)) return raw.replace(/\s/g, '');
    const mime = r.fotoMime || r.imagemContentType || 'image/png';
    return `data:${mime};base64,${raw.replace(/\s/g, '')}`;
  }

  imgSrcClasse(c?: Classe): string | null {
    if (!c) return null;
    const b64 = (c.imagemBase64 || '').replace(/\s/g, '');
    if (!b64) return null;
    const mime = c.imagemContentType || 'image/png';
    if (/^data:.*;base64,/i.test(b64)) return b64;
    return `data:${mime};base64,${b64}`;
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

    this.router.navigate(['/criar-personagem/classe'], {
      queryParams: {
        jogo: this.idJogo,
        nome: this.nome,
        raca: this.selectedRaca?.idRaca,
        classe: this.selectedClasse?.idClasse
      }
    });
  }
}
