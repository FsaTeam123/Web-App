// src/app/pages/signup/signup.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule,
  AbstractControl, ValidationErrors, FormControl
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClientModule, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { SignupService } from './signup.service';
import { Sexo, CreateUserRequest, ApiError } from './models';
import { finalize } from 'rxjs/operators';

type SignupForm = {
  nome: FormControl<string>;
  nickname: FormControl<string>;
  email: FormControl<string>;
  sexo: FormControl<number | null>;   // receberá o idSexo
  senha: FormControl<string>;
  confirmarSenha: FormControl<string>;
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HttpClientModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit {
  form: FormGroup<SignupForm>;
  isSubmitting = false;
  isLoadingSexos = false;
  sexos: Sexo[] = [];
  currentYear = new Date().getFullYear();

  // estado de feedback
  flash: { type: 'success' | 'error'; text: string } | null = null;
  private flashTimer: any;

  constructor(private fb: FormBuilder, private api: SignupService) {
    this.form = this.fb.nonNullable.group<SignupForm>({
      nome: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
      nickname: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]),
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
      sexo: this.fb.control<number | null>(null, { validators: [Validators.required] }),
      senha: this.fb.nonNullable.control('', [Validators.required, SignupComponent.passwordStrength]),
      confirmarSenha: this.fb.nonNullable.control('', [Validators.required, SignupComponent.match('senha')]),
    });

    // Revalida confirmar senha ao alterar senha
    this.form.controls.senha.valueChanges.subscribe(() => {
      this.form.controls.confirmarSenha.updateValueAndValidity({ onlySelf: true });
    });
  }

  ngOnInit(): void {
    this.loadSexos();
  }

  private showFlash(type: 'success' | 'error', text: string, autohide = true) {
    clearTimeout(this.flashTimer);
    this.flash = { type, text };
    if (autohide) {
      this.flashTimer = setTimeout(() => (this.flash = null), 6000);
    }
  }
  dismissFlash() {
    clearTimeout(this.flashTimer);
    this.flash = null;
  }

  private loadSexos() {
    this.isLoadingSexos = true;
    this.api.getSexos()
      .pipe(finalize(() => { this.isLoadingSexos = false; }))
      .subscribe({
        next: (data) => { this.sexos = data.filter(s => s.ativo === 1); },
        error: () => { this.showFlash('error', 'Não foi possível carregar a lista de sexos.'); }
      });
  }

  // Validadores
  private static passwordStrength(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '');
    if (!value) return null;
    // min 8, 1 maiúscula, 1 minúscula, 1 especial
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^\w\s]).{8,}$/;
    return pattern.test(value) ? null : { weakPassword: true };
  }
  private static match(otherControlName: string) {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) return null;
      const other = parent.get(otherControlName);
      return other && control.value === other.value ? null : { notMatch: true };
    };
  }

  // Getters para template
  get nome() { return this.form.controls.nome; }
  get nickname() { return this.form.controls.nickname; }
  get email() { return this.form.controls.email; }
  get sexo() { return this.form.controls.sexo; }
  get senha() { return this.form.controls.senha; }
  get confirmarSenha() { return this.form.controls.confirmarSenha; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();

    const payload: CreateUserRequest = {
      nome: v.nome,
      nickname: v.nickname,
      senha: v.senha,
      email: v.email,
      idSexo: Number(v.sexo),
      idPerfil: 1
    };

    this.isSubmitting = true;
    this.api.createUser(payload)
      .pipe(finalize(() => { this.isSubmitting = false; })) // ⬅️ garante destravar o botão
      .subscribe({
        next: (resp) => {
          if (resp.status === 200 || resp.status === 201) {
            this.showFlash('success', 'Usuário criado com sucesso!');
            // opcional: this.form.reset({ nome:'', nickname:'', email:'', sexo:null, senha:'', confirmarSenha:'' } as any);
          } else {
            this.showFlash('success', 'Usuário criado com sucesso.'); // fallback
          }
        },
        error: (err) => {
          const apiMessage: string | undefined =
            (err?.error as ApiError)?.message || err?.message;
          this.showFlash('error', apiMessage || 'Erro ao criar usuário.');
        }
      });
  }
}
