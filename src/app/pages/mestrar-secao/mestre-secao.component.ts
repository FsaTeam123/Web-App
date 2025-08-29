import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_ENDPOINTS } from '../../../config/app-config';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { AppHeaderComponentFix } from '../../shared/ui/app-header-fixo/app-header-fixo.component';

@Component({
  selector: 'app-mestre-secao',
  standalone: true,
  imports: [CommonModule, FormsModule, PageShellComponent, AppFooterComponent, AppHeaderComponentFix],
  templateUrl: './mestre-secao.component.html',
  styleUrls: ['./mestre-secao.component.css']
})
export class MestreSecaoComponent implements OnInit {

  titulo: string = '';
  qtdPessoas!: number;

  publicoPrivado: 'publico' | 'privado' = 'publico';
  classesEspecificas: boolean = false;

  classes: any[] = [];
  currentIndex: number = 0;

  /** NOVO: controle de flip por índice e seleção por id */
  flippedIndices = new Set<number>();
  selectedIds     = new Set<number>();

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>(API_ENDPOINTS.classes).subscribe(res => {
      this.classes = Array.isArray(res) ? res : [];
      // garante índice válido
      if (this.currentIndex >= this.classes.length) this.currentIndex = 0;
    });
  }

  /** Helper para pegar a classe atual */
  get current(): any | null {
    return this.classes?.[this.currentIndex] ?? null;
  }

  /** Slider */
  prev() {
    if (!this.classes?.length) return;
    this.currentIndex = (this.currentIndex - 1 + this.classes.length) % this.classes.length;
  }
  next() {
    if (!this.classes?.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.classes.length;
  }

  /** Flip do card atual */
  toggleFlip() {
    const idx = this.currentIndex;
    if (this.flippedIndices.has(idx)) this.flippedIndices.delete(idx);
    else this.flippedIndices.add(idx);
  }
  isFlipped(): boolean {
    return this.flippedIndices.has(this.currentIndex);
  }

  /** Seleção do card atual */
  toggleSelect(id: number, checked: boolean) {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    // se quiser ver no console:
    // console.log('selecionadas:', Array.from(this.selectedIds));
  }

    get currentPvInitLabel(): string {
        const c = this.current;
        if (!c) return '';
        const attr = c.atributoPV?.nome ?? 'Atributo';
        const pv = (c.pvInit ?? '').toString();
        return `${pv} + ${attr}`;
    }

    /** "Proeficiências": lista de nomes separados por vírgula ou "Nenhuma" */
    get currentProeficienciasText(): string {
        const list = this.current?.proeficiencias as Array<any> | undefined;
        if (!list || list.length === 0) return 'Nenhuma';
        return list.map(x => x?.nome).filter(Boolean).join(', ');
    }

    /** "Perícias": lista de nomes separados por vírgula ou "Nenhuma" */
    get currentPericiasText(): string {
        const list = this.current?.pericias as Array<any> | undefined;
        if (!list || list.length === 0) return 'Nenhuma';
        return list.map(x => x?.nome).filter(Boolean).join(', ');
    }
    get currentPvNivelLabel(): string {
        const c = this.current;
        if (!c) return '';
        const attr = c.atributoPV?.nome ?? 'Atributo';
        const pv = (c.pvNivel ?? '').toString();
        return `${pv} + ${attr}`;
    }
    get currentPmNivelLabel(): string {
        const c = this.current;
        if (!c || c.pmNivel == null) return '0';
        return String(c.pmNivel);
    }
}
