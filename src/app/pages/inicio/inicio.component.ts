// src/app/pages/inicio/inicio.component.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { AppHeaderComponentFix } from '../../shared/ui/app-header-fixo/app-header-fixo.component';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, PageShellComponent, AppFooterComponent, AppHeaderComponentFix],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css']
})
export class InicioComponent {
  siteName = 'Reinos Perdidos RPG';
  teamName = 'Equipe FSA RPG';
  useAltBackground = true;
}