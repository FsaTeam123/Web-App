import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { UserSessionService } from '../../core/session/user-session.service';

interface LoginResponse {
  status: number;
  message: string;
  data: {
    token: string;
    status: string;
    idUsuario: number;
    idPerfil: number;
    nome: string;
    email: string;
    fotoUrl?: string;
    nickname?: string;
  };
}

type LoginForm = {
  email: FormControl<string>;
  senha: FormControl<string>;
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  form: FormGroup<LoginForm>;
  isSubmitting = false;
  apiErrorMessage: string | null = null;
  currentYear = new Date().getFullYear();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private session: UserSessionService
  ) {
    this.form = this.fb.nonNullable.group<LoginForm>({
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
      senha: this.fb.nonNullable.control('', [Validators.required])
    });
  }

  get email() { return this.form.controls.email; }
  get senha() { return this.form.controls.senha; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.apiErrorMessage = null;
    this.isSubmitting = true;

    const payload = this.form.getRawValue();

    this.http.post<LoginResponse>('https://t7tsd4gbsd.execute-api.sa-east-1.amazonaws.com/auth/login', payload)
      .pipe(finalize(() => { this.isSubmitting = false; }))
      .subscribe({
        next: (res) => {
          if (res?.status === 200 && res?.data) {
            const u = res.data;
            console.log('Login bem-sucedido:', u);

            // Salva a sessão completa (token + dados + foto + nickname)
            this.session.set({
              idUsuario: u.idUsuario,
              nome: u.nome,
              email: u.email,
              token: u.token,
              status: u.status,
              fotoUrl: u.fotoUrl || null,
              nickname: u.nickname || null,
              idPerfil: u.idPerfil
            });

            // (Opcional) Manter compat com seu armazenamento anterior
            localStorage.setItem('auth_user', JSON.stringify({
              idUsuario: u.idUsuario,
              nome: u.nome,
              email: u.email,
              status: u.status,
              token: u.token,
              fotoUrl: u.fotoUrl || null,
              nickname: u.nickname || null
            }));

            this.router.navigate(['/inicio']);
          } else {
            this.apiErrorMessage = res?.message || 'Falha no login.';
            this.senha.reset();
          }
        },
        error: (err) => {
          this.apiErrorMessage = err?.error?.message || 'Erro ao realizar login.';
          this.senha.reset();
        }
      });
  }
}