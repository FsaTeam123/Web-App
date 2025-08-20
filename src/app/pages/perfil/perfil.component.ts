import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { PageShellComponent } from '../../shared/ui/page-shell/page-shell.component';
import { AppHeaderComponent } from '../../shared/ui/header/app-header.component';
import { AppFooterComponent } from '../../shared/ui/footer/app-footer.component';
import { NavLink } from '../../shared/models/nav-link.model';
import { UserSessionService } from '../../core/session/user-session.service';
import { AccountApiService, UsuarioDTO, SexoDTO } from '../../core/account-api.service';

type PerfilForm = {
  nome: FormControl<string>;
  nickname: FormControl<string>;
  email: FormControl<string>;
  sexoId: FormControl<number | null>;
  senha: FormControl<string>;
};

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink,
    PageShellComponent, AppHeaderComponent, AppFooterComponent
  ],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private session = inject(UserSessionService);
  private api = inject(AccountApiService);
  private readonly MAX_MB = 10;
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  loading = true;
  saving = false;
  uploading = false;
  editMode = false;
  errorMsg: string | null = null;
  successMsg: string | null = null;

  form!: FormGroup<PerfilForm>;
  sexos: SexoDTO[] = [];
  usuario!: UsuarioDTO;

  siteName = 'Reinos Perdidos RPG';
  useAltBackground = false;
  defaultAvatar = '/assets/avatar-default.png';
  fotoUrl: string | null = null;

  links: NavLink[] = [
    { label: 'Home', route: '/inicio', variant: 'ghost' },
    { label: 'Minhas seções ativas', route: '/secoes-ativas', variant: 'ghost' },
    { label: 'Meu histórico de seção', route: '/historico-secao', variant: 'ghost' },
    { label: 'Conta', route: '/conta/perfil', variant: 'primary' },
    { label: 'Sair', variant: 'ghost', children: [{ label: 'Deslogar', route: '/conta/deslogar', newTab: false }] }
  ];

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    const user = this.session.get();
    if (!user) { this.router.navigate(['/login']); return; }

    this.form = this.fb.nonNullable.group<PerfilForm>({
        nome: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
        nickname: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(32)]),
        email: this.fb.nonNullable.control('', [Validators.required, Validators.email]), // <- sem disabled aqui
        sexoId: this.fb.control<number | null>(null, [Validators.required]),
        senha: this.fb.nonNullable.control('', [])
    });

        // desabilita tudo logo após criar (como você já fazia)
        this.form.disable();

    // carrega dados (usuário + sexos)
    this.loadData(user.idUsuario, user.fotoUrl || null);
  }

  private loadData(idUsuario: number, fotoSessao: string | null) {
    this.loading = true; this.errorMsg = null;

    this.api.getUsuarioById(idUsuario).subscribe({
      next: (u) => {
        this.usuario = u;
        this.api.getSexos().subscribe({
          next: (sx) => {
            this.sexos = sx || [];
            this.patchForm(u);
            this.fotoUrl = fotoSessao || this.api.fotoUrlOf(u.idUsuario);
            this.loading = false;
          },
          error: (err) => this.handleError(err, 'Falha ao carregar lista de sexos.')
        });
      },
      error: (err) => this.handleError(err, 'Falha ao carregar dados do usuário.')
    });
  }

  private patchForm(u: UsuarioDTO) {
    this.form.patchValue({
      nome: u.nome ?? '',
      nickname: u.nickname ?? '',
      email: u.email ?? '' as any,
      sexoId: u.sexo?.idSexo ?? null,
      senha: ''
    }, { emitEvent: false });
  }

  enableEdit() {
    this.editMode = true;
    this.successMsg = null; this.errorMsg = null;
    this.form.enable(); this.form.controls.email.disable();
  }

  cancelEdit() {
    this.editMode = false;
    this.successMsg = null; this.errorMsg = null;
    this.patchForm(this.usuario);
    this.form.disable();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const dto: any = {};
    const f = this.form.getRawValue();

    if (f.nome && f.nome !== this.usuario.nome) dto.nome = f.nome;
    if (f.nickname && f.nickname !== this.usuario.nickname) dto.nickname = f.nickname;
    if (f.sexoId && f.sexoId !== this.usuario.sexo?.idSexo) dto.idSexo = f.sexoId;
    if (f.senha && f.senha.trim().length > 0) dto.senha = f.senha.trim();

    if (Object.keys(dto).length === 0) {
      this.successMsg = 'Nada para salvar.'; this.editMode = false; this.form.disable();
      return;
    }

    this.saving = true; this.errorMsg = null; this.successMsg = null;

    this.api.updateUsuarioByEmail(this.usuario.email, dto).subscribe({
      next: () => {
        // recarrega usuário para refletir alterações
        this.api.getUsuarioById(this.usuario.idUsuario).subscribe({
          next: (u) => {
            this.usuario = u;
            this.patchForm(u);
            this.editMode = false; this.form.disable(); this.saving = false;
            this.successMsg = 'Perfil atualizado com sucesso!';
            // se mudou nickname, atualiza sessão para refletir no header
            const sess = this.session.get();
            if (sess && u.nickname && u.nickname !== sess.nickname) {
              this.session.set({ ...sess, nickname: u.nickname });
            }
          },
          error: (err) => this.handleError(err, 'Atualizado, mas falhou ao recarregar. Atualize a página.')
        });
      },
      error: (err) => this.handleError(err, 'Falha ao salvar alterações.', () => this.saving = false)
    });
  }

  triggerFile() {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // validação de tamanho (evita 500/413 do backend)
    if (file.size > this.MAX_MB * 1024 * 1024) {
      this.errorMsg = `Arquivo muito grande. Máximo ${this.MAX_MB}MB.`;
      input.value = '';
      return;
    }

    // validação de tipo
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      this.errorMsg = 'Formato inválido. Envie JPG, PNG ou WEBP.';
      input.value = '';
      return;
    }

    this.uploading = true;
    this.errorMsg = null;
    this.successMsg = null;

    this.api.uploadFoto(this.usuario.idUsuario, file).subscribe({
      next: (res) => {
        const newUrl = res?.data || this.api.fotoUrlOf(this.usuario.idUsuario);
        // force cache-bust no <img>
        this.fotoUrl = `${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

        // atualiza sessão para refletir no header
        const sess = this.session.get();
        if (sess) this.session.set({ ...sess, fotoUrl: newUrl });

        this.uploading = false;
        this.successMsg = 'Foto atualizada com sucesso!';
        input.value = '';
      },
      error: (err) => this.handleError(err, 'Falha ao enviar a foto.', () => {
        this.uploading = false;
        input.value = '';
      })
    });
  }

  onImgError(ev: Event) { (ev.target as HTMLImageElement).src = this.defaultAvatar; }

  private handleError(err: any, fallbackMsg: string, after?: () => void) {
    console.error(err);
    this.loading = false; this.saving = false; this.uploading = false;
    this.errorMsg = err?.error?.message || fallbackMsg;
    if (after) after();
  }
}
