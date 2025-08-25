import {
  Component,
  OnInit,
  AfterViewInit,
  HostListener,
  QueryList,
  ViewChildren,
  ElementRef,
  Input 
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavLink, NavChildLink } from '../../models/nav-link.model';
import { UserSessionService, CurrentUser } from '../../../core/session/user-session.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-header-fixo',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './app-header-fixo.component.html',
  styleUrls: ['./app-header-fixo.component.css']
})
export class AppHeaderComponentFix implements OnInit, AfterViewInit {
  @Input() siteName: string = 'Reinos Perdidos RPG';  // @Input() para siteName
  @Input() logoSrc: string = 'assets/logo-rpg.png';  // @Input() para logoSrc

  idPerfil!: number;

  links: NavLink[] = []; // Inicialmente vazio

  @ViewChildren('navItem') navItems!: QueryList<ElementRef<HTMLElement>>;

  openIndex: number | null = null;
  user$!: Observable<CurrentUser | null>;

  defaultAvatar = '/assets/perfil-padrao.jpg';

  constructor(
    private session: UserSessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.user$ = this.session.user$;
    this.idPerfil = this.session.get()?.idPerfil ?? 0;
    console.log('ID do perfil:', this.idPerfil);

    // Montando o menu dinamicamente
    this.links = [
      { label: 'Home', route: '/inicio', variant: 'ghost' },
      {
        label: 'Iniciar Seção',
        variant: 'primary',
        children: [
          { label: 'Criar nova seção (mestre)', route: '/mestre-secao/criar', newTab: true },
          { label: 'Entrar com código', route: '/entrar-secao', newTab: true },
        ]
      },
      {
        label: 'Minhas seções ativas',
        variant: 'primary',
        children: [
          { label: 'Como Jogador', route: '/secoes-ativas/jogador', newTab: true },
          { label: 'Como Mestre', route: '/secoes-ativas/mestre', newTab: true },
        ]
      },
      { label: 'Meu histórico de seção', route: '/historico-secao', variant: 'ghost' },
      {
        label: 'Conta',
        variant: 'primary',
        children: [
          { label: 'Perfil', route: '/conta/perfil', newTab: true },
          { label: 'Deslogar', route: '/conta/deslogar', newTab: true },
        ]
      },
      ...(this.idPerfil == 2 ? [{
        label: 'Cadastro',
        variant: 'primary' as const,
        children: [
          { label: 'Tipos de Mundo', route: '/cadastro/mundo', newTab: true },
          { label: 'Tipos de Aventura', route: '/cadastro/aventura', newTab: true },
        ]
      }] : [])
    ];
  }

  onImgError(ev: Event) {
    (ev.target as HTMLImageElement).src = this.defaultAvatar;
  }

  tag(u: CurrentUser) {
    return this.session.userTag(u);
  }

  isActive(index: number): boolean {
    const currentRoute = this.router.url.split('?')[0];
    const linkRoute = this.links[index].route;

    if (this.links[index].children) {
      return currentRoute === linkRoute || this.links[index].children!.some(child => currentRoute.includes(child.route));
    }

    return currentRoute === linkRoute;
  }

  toggle(i: number) {
    this.openIndex = this.openIndex === i ? null : i;
  }

  @HostListener('document:click')
  closeAll() {
    this.openIndex = null;
  }

  stop(e: Event) {
    e.stopPropagation();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.recalcAlign(), 0);
  }

  @HostListener('window:resize')
  onResize() {
    this.recalcAlign();
  }

  private recalcAlign() {
    const vw = window.innerWidth;
    const items = this.navItems?.toArray() ?? [];
    items.forEach((ref) => {
      const submenu = ref.nativeElement.querySelector('.submenu') as HTMLElement | null;
      if (!submenu) return;
      submenu.classList.remove('align-right');
      const rect = ref.nativeElement.getBoundingClientRect();
      if (vw - rect.left < 260) submenu.classList.add('align-right');
    });
  }

  alignSubmenu(el: HTMLElement | null) {
    if (!el) return;
    el.classList.remove('align-right');
    const parent = el.closest('.nav-item') as HTMLElement | null;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const maxWidthPx = Math.max(220, 320);
    if (parentRect.left + maxWidthPx > window.innerWidth - 8) {
      el.classList.add('align-right');
    }
  }

  onChildClick(c: NavChildLink, ev: MouseEvent) {
    const isLogout = c.label?.toLowerCase().includes('deslogar');
    if (isLogout) {
      ev.preventDefault();
      this.session.logout();
      this.closeAll();
      this.router.navigate(['/']);
    } else {
      this.closeAll();
    }
  }

  isSubmenuActive(childRoute: string): boolean {
    const currentRoute = this.router.url.split('?')[0];
    return currentRoute === childRoute;
  }
}
