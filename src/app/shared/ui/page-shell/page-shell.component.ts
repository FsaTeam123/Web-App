// src/app/shared/ui/page-shell.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-shell.component.html',
  styleUrls: ['./page-shell.component.css']
})
export class PageShellComponent {
  /** Alterna imagem/gif de fundo */
  @Input() useAltBackground = false;
}
