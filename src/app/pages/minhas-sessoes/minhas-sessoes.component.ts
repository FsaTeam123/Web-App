// src/app/pages/minhas-sessoes/minhas-sessoes.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_ENDPOINTS } from '../../../config/app-config';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { AppHeaderComponentFix } from '../../shared/ui/app-header-fixo/app-header-fixo.component';
import { UserSessionService } from '../../core/session/user-session.service';

@Component({
  selector: 'app-minhas-sessoes',
  standalone: true,
  imports: [CommonModule, PageShellComponent, AppFooterComponent, AppHeaderComponentFix],
  templateUrl: './minhas-sessoes.component.html',
  styleUrls: ['./minhas-sessoes.component.css']
})
export class MinhasSessoesComponent implements OnInit {

  mestradas: any[] = [];
  jogadasTitulos: string[] = [];
  loading = true;

  constructor(
    private http: HttpClient,
    private router: Router,
    private session: UserSessionService
  ) {}

  ngOnInit(): void {
    const userId = this.session.get()?.idUsuario ?? 0;

    this.http.get<any[]>(API_ENDPOINTS.jogosPorMestre(userId)).subscribe({
      next: (r) => this.mestradas = r ?? [],
      error: () => {},
    }); 

    this.http.get<string[]>(API_ENDPOINTS.jogosPorJogador(userId)).subscribe({
      next: (r) => this.jogadasTitulos = r ?? [],
      error: () => {},
      complete: () => this.loading = false
    });
  }

  irParaSessao(item: any){
    // por enquanto só navega — você pode passar query params se precisar
     this.router.navigate(['/inicio-sessao'], { state: { jogo: item } });
  }

  infoLinha(j: any): string {
    const parts = [
      j?.tipoJogo?.nome,
      j?.geracaoMundo?.nome,
      j?.estiloCampanha?.nome,
      j?.historia?.nome,
      j?.tema?.nome,
    ]
    .map(v => (typeof v === 'string' ? v.trim() : v))
    .filter(Boolean);
    return parts.join(' - ');
  }
}
