// src/app/pages/inicio/inicio.component.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppHeaderComponent } from '../../shared/ui/header/app-header.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { NavLink } from '../../shared/models/nav-link.model';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, PageShellComponent, AppHeaderComponent, AppFooterComponent],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css']
})
export class InicioComponent {
  siteName = 'Reinos Perdidos RPG';
  teamName = 'Equipe FSA RPG';
  useAltBackground = true;

  links: NavLink[] = [
    { label: 'Home', route: '/inicio', variant: 'ghost' },

    {
      label: 'Iniciar Seção',
      variant: 'primary',
      children: [
        { label: 'Criar nova seção (mestre)', route: '/mestre-secao/criar', newTab: true },
        { label: 'Entrar com código',        route: '/entrar-secao',       newTab: true },
      ]
    },

    {
      label: 'Minhas seções ativas',
      variant: 'primary',
      children: [
        { label: 'Como Jogador', route: '/secoes-ativas/jogador', newTab: true },
        { label: 'Como Mestre',  route: '/secoes-ativas/mestre',  newTab: true },
      ]
    },

    { label: 'Meu histórico de seção', route: '/historico-secao', variant: 'ghost' },

    {
      label: 'Conta',
      variant: 'primary',
      children: [
        { label: 'Perfil', route: '/conta/perfil', newTab: true }, 
        { label: 'Deslogar',  route: '/conta/deslogar',  newTab: true },
      ]
    },
  ];
}