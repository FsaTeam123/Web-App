import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

interface LoginResponse {
  status: number;
  message: string;
  data: {
    token: string;
    status: string;
    idUsuario: number;
    nome: string;
    email: string;
  };
}

type LoginForm = {
  email: FormControl<string>;
  senha: FormControl<string>;
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
    private router: Router
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

    this.http.post<LoginResponse>('http://15.228.149.190:8085/auth/login', payload)
      .pipe(
        finalize(() => {
          // ✅ sempre executa, com sucesso ou erro
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: (res) => {
          if (res?.status === 200 && res?.data) {
            localStorage.setItem('auth_token', res.data.token);
            localStorage.setItem('auth_user', JSON.stringify({
              idUsuario: res.data.idUsuario,
              nome: res.data.nome,
              email: res.data.email,
              status: res.data.status
            }));
            this.router.navigate(['/inicio']);
          } else {
            this.apiErrorMessage = res?.message || 'Falha no login.';
            // opcional: limpar o campo senha
            this.senha.reset();
          }
        },
        error: (err) => {
          this.apiErrorMessage = err?.error?.message || 'Erro ao realizar login.';
          // opcional: limpar o campo senha
          this.senha.reset();
        }
      });
  }
}
