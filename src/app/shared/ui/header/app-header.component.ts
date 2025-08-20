import {
  AfterViewInit, Component, ElementRef, HostListener, Input, QueryList, ViewChildren, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NavLink, NavChildLink } from '../../models/nav-link.model';
import { UserSessionService, CurrentUser } from '../../../core/session/user-session.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.css']
})
export class AppHeaderComponent implements AfterViewInit, OnInit {
  @Input() siteName = 'Reinos Perdidos RPG';
  @Input() logoSrc = 'assets/logo-rpg.png';
  @Input() links: NavLink[] = [];

  @ViewChildren('navItem') navItems!: QueryList<ElementRef<HTMLElement>>;

  openIndex: number | null = null;
  user$!: Observable<CurrentUser | null>;   // <-- só declara aqui

  defaultAvatar = '/assets/avatar-default.png';

  constructor(
    private session: UserSessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.user$ = this.session.user$;        // <-- inicializa aqui (agora 'session' já existe)
  }

  // --- avatar/tag ---
  tag(u: CurrentUser) { return this.session.userTag(u); }
  onImgError(ev: Event) { (ev.target as HTMLImageElement).src = this.defaultAvatar; }

  // --- dropdown ---
  toggle(i: number) { this.openIndex = this.openIndex === i ? null : i; }
  @HostListener('document:click') closeAll() { this.openIndex = null; }
  stop(e: Event) { e.stopPropagation(); }

  // --- alinhar submenu ---
  ngAfterViewInit(): void { setTimeout(() => this.recalcAlign(), 0); }
  @HostListener('window:resize') onResize() { this.recalcAlign(); }

  private recalcAlign() {
    const vw = window.innerWidth;
    const threshold = 260;
    const items = this.navItems?.toArray() ?? [];
    items.forEach((ref) => {
      const submenu = ref.nativeElement.querySelector('.submenu') as HTMLElement | null;
      if (!submenu) return;
      submenu.classList.remove('align-right');
      const rect = ref.nativeElement.getBoundingClientRect();
      const estimated = 260;
      if (vw - rect.left < estimated) submenu.classList.add('align-right');
    });
  }

  alignSubmenu(el: HTMLElement | null) {
    if (!el) return;
    el.classList.remove('align-right');
    const minWidth = 220;
    const cssMax = getComputedStyle(el).maxWidth;
    let maxWidthPx = 320;
    try {
      if (cssMax.endsWith('vw')) maxWidthPx = (parseFloat(cssMax) / 100) * window.innerWidth;
      else if (cssMax.endsWith('px')) maxWidthPx = parseFloat(cssMax);
    } catch {}
    const estimatedWidth = Math.max(minWidth, Math.min(maxWidthPx, 9999));
    const parent = el.closest('.nav-item') as HTMLElement | null;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    if (parentRect.left + estimatedWidth > window.innerWidth - 8) {
      el.classList.add('align-right');
    }
  }

  // --- clique nos itens do submenu (captura "Deslogar") ---
  async onChildClick(c: NavChildLink, ev: MouseEvent) {
    const label = (c.label || '').toLowerCase();
    const isLogout = label.includes('Deslogar') || c.route === '/conta/deslogar';
    if (isLogout) {
      ev.preventDefault();
      this.session.logout();
      this.closeAll();
      await this.router.navigate(['/']);
      return;
    }
    if (!c.newTab) this.closeAll();
  }
}