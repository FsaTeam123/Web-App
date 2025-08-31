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
  // imagens – o backend pode mandar em qualquer destes campos
  fotoBase64?: string;                 // base64
  fotoMime?: string;
  imagem?: string;               // base64 (variante)
  imagemContentType?: string;
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

  // raças / deck
  loadingRacas = true;
  deckOpen = false;
  racas: Raca[] = [];
  current = 0;            // índice da carta central (carousel)
  selected?: Raca;        // raca escolhida

  ngOnInit(): void {
    // id do jogo vindo de /entrar-secao
    const q = this.route.snapshot.queryParamMap.get('jogo');
    this.idJogo = q ? Number(q) : undefined;

    this.fetchRacas();
  }

  fetchRacas() {
    this.loadingRacas = true;
    this.http.get<Raca[]>(API_ENDPOINTS.racas).subscribe({
      next: (arr) => {
        this.racas = Array.isArray(arr) ? arr : [];
        this.loadingRacas = false;
        // se já existir ao menos uma, abre no meio
        this.current = 0;
      },
      error: () => {
        this.erro = 'Não foi possível carregar as raças.';
        this.loadingRacas = false;
      }
    });
  }

  // ===== Deck / Carousel =====
  openDeck() { if (!this.deckOpen) this.deckOpen = true; }
  closeDeck() { this.deckOpen = false; }

  prev() {
    if (!this.racas.length) return;
    this.current = (this.current - 1 + this.racas.length) % this.racas.length;
  }
  next() {
    if (!this.racas.length) return;
    this.current = (this.current + 1) % this.racas.length;
  }

  chooseCurrent() {
    if (!this.racas.length) return;
    this.selected = this.racas[this.current];
    this.deckOpen = false; // fecha o baralho ao escolher
  }

  leftIndex()  { return this.racas.length ? (this.current - 1 + this.racas.length) % this.racas.length : 0; }
  rightIndex() { return this.racas.length ? (this.current + 1) % this.racas.length : 0; }

  imgSrc(r?: Raca): string | null {
    if (!r) return null;

    // aceita qualquer um dos campos, priorizando fotoBase64
    let raw = r.fotoBase64 ?? r.imagem ?? null;
    if (!raw) return null;

    // Se já vier "data:image/png;base64,AAAA", reaproveita
    const alreadyDataUrl = /^data:.*;base64,/i.test(raw);
    if (alreadyDataUrl) {
        return raw.replace(/\s/g, ''); // remove quebras de linha ocasionais
    }

    // Caso venha apenas o base64 cru, monta o data URL
    const b64 = raw.replace(/\s/g, ''); // limpa espaços/CRLF do backend
    const mime = r.fotoMime || r.imagemContentType || 'image/png';
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
      if (comma >= 0) {
        this.fotoMime = file.type || 'image/png';
        this.fotoB64 = res.slice(comma + 1);
      } else {
        // fallback se vier só o binário
        this.fotoMime = file.type || 'image/png';
        this.fotoB64 = res;
      }
    };
    reader.readAsDataURL(file);
  }

  // enviar/continuar (aqui apenas navego adiante mantendo idJogo)
  continuar() {
    if (!this.nome.trim()) {
      this.erro = 'Informe um nome para o personagem.';
      return;
    }
    if (!this.selected) {
      this.erro = 'Escolha uma raça.';
      return;
    }
    this.erro = '';

    // Aqui você pode chamar seu endpoint de criação de Player.
    // Por enquanto, seguimos para a próxima etapa levando infos via query.
    this.router.navigate(['/criar-personagem/classe'], {
      queryParams: {
        jogo: this.idJogo,
        nome: this.nome,
        raca: this.selected?.idRaca
      }
    });
  }

  stackImg(which: 'left'|'center'|'right'): string | null {
    if (!this.racas.length) return null;
    let idx = this.current;
    if (which === 'left')  idx = this.leftIndex();
    if (which === 'right') idx = this.rightIndex();
    return this.imgSrc(this.racas[idx]);
  }

  stackBg(which: 'left'|'center'|'right') {
    const src = this.stackImg(which);
    return src ? `url("${src}")` : 'none';
  }
}
