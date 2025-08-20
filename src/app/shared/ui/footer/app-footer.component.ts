// src/app/shared/ui/app-footer.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.css']
})
export class AppFooterComponent {
  @Input() siteName = 'Reinos Perdidos RPG';
  @Input() teamName = 'Equipe FSA RPG';
  @Input() leftLogoSrc = '/assets/logo-fsa.png';
  @Input() currentYear = new Date().getFullYear();
}
