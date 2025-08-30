// src/app/pages/mestrar-secao/mestrar-secao.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_ENDPOINTS } from '../../../config/app-config';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { AppHeaderComponentFix } from '../../shared/ui/app-header-fixo/app-header-fixo.component';
import { Router } from '@angular/router';

import { UserSessionService } from '../../core/session/user-session.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-mestre-secao',
  standalone: true,
  imports: [CommonModule, FormsModule, PageShellComponent, AppFooterComponent, AppHeaderComponentFix],
  templateUrl: './mestre-secao.component.html',
  styleUrls: ['./mestre-secao.component.css']
})
export class MestreSecaoComponent implements OnInit {

  titulo = '';
  qtdPessoas!: number;
  publicoPrivado: 'publico' | 'privado' = 'publico';
  classesEspecificas = false;

  // 🔹 novo: nível inicial (1..20) e senha (somente se privado)
  nivelInicial = 1;
  senha = '';

  // listas para os selects
  universos: any[] = [];
  estilos: any[] = [];
  historias: any[] = [];
  temas: any[] = [];

  // selecionados (guardar somente IDs)
  selectedUniversoId?: number;
  selectedEstiloId?: number;
  selectedHistoriaId?: number;
  selectedTemaId?: number;

  // classes e slider
  classes: any[] = [];
  currentIndex = 0;
  flippedIndices = new Set<number>();
  selectedIds = new Set<number>();

  // feedback
  successMsg = '';
  errorMsg = '';
  isSubmitting = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private session: UserSessionService
  ) {}

  ngOnInit(): void {
    // classes p/ slider
    this.http.get<any[]>(API_ENDPOINTS.classes).subscribe(res => {
      this.classes = Array.isArray(res) ? res : [];
      if (this.currentIndex >= this.classes.length) this.currentIndex = 0;
    });

    // 🔹 carregar selects
    this.http.get<any[]>(API_ENDPOINTS.geracoesMundo).subscribe(r => this.universos = r ?? []);
    this.http.get<any[]>(API_ENDPOINTS.estilosCampanha).subscribe(r => this.estilos = r ?? []);
    this.http.get<any[]>(API_ENDPOINTS.historias).subscribe(r => this.historias = r ?? []);
    this.http.get<any[]>(API_ENDPOINTS.temas).subscribe(r => this.temas = r ?? []);
  }

  // helpers do slider
  get current(): any | null { return this.classes?.[this.currentIndex] ?? null; }
  prev(){ if(this.classes?.length) this.currentIndex = (this.currentIndex - 1 + this.classes.length) % this.classes.length; }
  next(){ if(this.classes?.length) this.currentIndex = (this.currentIndex + 1) % this.classes.length; }
  toggleFlip(){ const i=this.currentIndex; this.flippedIndices.has(i) ? this.flippedIndices.delete(i) : this.flippedIndices.add(i); }
  isFlipped(): boolean { return this.flippedIndices.has(this.currentIndex); }
  toggleSelect(id: number, checked: boolean){ checked ? this.selectedIds.add(id) : this.selectedIds.delete(id); }

  // labels do verso da carta
  get currentPvInitLabel(): string {
    const c = this.current; if (!c) return '';
    const attr = c.atributoPV?.nome ?? 'Atributo';
    const pv = (c.pvInit ?? '').toString();
    return `${pv} + ${attr}`;
  }
  get currentPvNivelLabel(): string {
    const c = this.current; if (!c) return '';
    const attr = c.atributoPV?.nome ?? 'Atributo';
    const pv = (c.pvNivel ?? '').toString();
    return `${pv} + ${attr}`;
  }
  get currentPmNivelLabel(): string {
    const c = this.current; if (!c || c.pmNivel == null) return '0';
    return String(c.pmNivel);
  }
  get currentProeficienciasText(): string {
    const list = this.current?.proeficiencias as any[] | undefined;
    if (!list || list.length === 0) return 'Nenhuma';
    return list.map(x => x?.nome).filter(Boolean).join(', ');
  }
  get currentPericiasText(): string {
    const list = this.current?.pericias as any[] | undefined;
    if (!list || list.length === 0) return 'Nenhuma';
    return list.map(x => x?.nome).filter(Boolean).join(', ');
  }

  // 🔹 criar sessão
  async criarSessao(){
    this.errorMsg = '';
    this.successMsg = '';
    if (this.isSubmitting) return;

    // validações básicas
    if (!this.titulo.trim()){
      this.errorMsg = 'Informe um título.';
      return;
    }
    if (!this.qtdPessoas || this.qtdPessoas < 1){
      this.errorMsg = 'Quantidade de pessoas deve ser maior que 0.';
      return;
    }
    if (this.nivelInicial < 1 || this.nivelInicial > 20){
      this.errorMsg = 'Nível inicial deve estar entre 1 e 20.';
      return;
    }
    if (this.publicoPrivado === 'privado' && !this.senha.trim()){
      this.errorMsg = 'Informe uma senha para sessão privada.';
      return;
    }

    const userId = this.session.get()?.idUsuario ?? 0;

    const payload = {
      masterId: userId,
      titulo: this.titulo.trim(),
      qtdPessoas: this.qtdPessoas,
      isEspecificClass: this.classesEspecificas ? 1 : 0,
      nivelInicial: this.nivelInicial,
      tipoJogoId: this.publicoPrivado === 'publico' ? 1 : 2,
      geracaoMundoId: this.selectedUniversoId ?? null,
      estiloCampanhaId: this.selectedEstiloId ?? null,
      historiaId: this.selectedHistoriaId ?? null,
      temaId: this.selectedTemaId ?? null,
      senha: this.publicoPrivado === 'privado' ? this.senha : '',
      ativo: 1
    };

    console.log('Payload p/ criar sessão:', payload);

    this.isSubmitting = true;
    try{
      const jogo = await firstValueFrom(this.http.post<any>(API_ENDPOINTS.jogos, payload));
      console.log('Sessão criada:', jogo);

      // se for classes específicas, cria vínculos
      if (payload.isEspecificClass === 1 && this.selectedIds.size > 0){
        console.log('Vinculando classes:', Array.from(this.selectedIds), 'ao jogo', jogo);
        const idJogo = jogo?.idJogo;
        const posts = Array.from(this.selectedIds).map(idClasse =>
          this.http.post(API_ENDPOINTS.classeJogo, { idClasse, idJogo })
        );
        console.log('Posts a serem feitos:', posts);
        // dispara todos e espera
        //await firstValueFrom((await import('rxjs')).forkJoin(posts));
      }

      this.successMsg = 'Sua sessão foi criada com sucesso! Redirecionando...';
      setTimeout(() => this.router.navigate(['/minhas-sessoes']), 1000);

    } catch(err:any){
      this.errorMsg = 'Não foi possível criar a sessão. Tente novamente.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
