// src/app/pages/esqueci-senha/esqueci-senha.component.ts
import { Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthApiService, UsuarioDTO } from '../../core/auth-api.service';

type EmailForm = { email: FormControl<string> };
type PasswordForm = {
  senha: FormControl<string>;
  confirmarSenha: FormControl<string>;
};

@Component({
  selector: 'app-esqueci-senha',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HttpClientModule],
  templateUrl: './esqueci-senha.component.html',
  styleUrls: ['./esqueci-senha.component.css']
})
export class EsqueciSenhaComponent {
  step: 1 | 2 | 3 = 1;

  emailForm: FormGroup<EmailForm>;
  codeForm: FormGroup;
  passwordForm: FormGroup<PasswordForm>;

  isSubmitting = false;
  apiErrorMessage: string | null = null;
  successMessage: string | null = null;

  currentYear = new Date().getFullYear();

  usuarioRetornado: UsuarioDTO | null = null;
  get emailSalvo(): string | null { return this.usuarioRetornado?.email ?? null; }

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(private fb: FormBuilder, private api: AuthApiService, private router: Router) {
    this.emailForm = this.fb.nonNullable.group<EmailForm>({
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    });

    this.codeForm = this.fb.group({
      code: this.fb.array(
        Array(8).fill('').map(() => this.fb.control('', [
          Validators.required,
          Validators.pattern(/^[A-Za-z0-9]$/) // 1 char alfanumérico
        ])),
        [Validators.required, EsqueciSenhaComponent.codeCompleteValidator]
      )
    });

    this.passwordForm = this.fb.nonNullable.group<PasswordForm>({
      senha: this.fb.nonNullable.control('', [Validators.required, EsqueciSenhaComponent.passwordStrength]),
      confirmarSenha: this.fb.nonNullable.control('', [Validators.required, EsqueciSenhaComponent.match('senha')]),
    });

    this.passwordForm.controls.senha.valueChanges.subscribe(() => {
      this.passwordForm.controls.confirmarSenha.updateValueAndValidity({ onlySelf: true });
    });
  }

  // ---------- Validadores ----------
  private static passwordStrength(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '');
    if (!value) return null;
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

  private static codeCompleteValidator(control: AbstractControl): ValidationErrors | null {
    const fa = control as FormArray;
    const chars = fa.controls.map(c => String(c.value || '')).join('').toUpperCase();
    return /^[A-Z0-9]{8}$/.test(chars) ? null : { codeIncomplete: true };
  }

  // ---------- Getters ----------
  get email() { return this.emailForm.controls.email; }
  get senha() { return this.passwordForm.controls.senha; }
  get confirmarSenha() { return this.passwordForm.controls.confirmarSenha; }
  get codeArray() { return this.codeForm.get('code') as FormArray; }
  private get codeRaw(): string {
    return this.codeArray.controls.map(c => String(c.value || '')).join('').toUpperCase();
  }

  // ---------- Helpers ----------
  private goAfterSuccess(delayMs: number, action: () => void) {
    setTimeout(() => {
      action();
      this.successMessage = null;
      // foco no primeiro input do código quando for para o step 2
      if (this.step === 2) setTimeout(() => this.otpInputs?.get(0)?.nativeElement.focus(), 0);
    }, delayMs);
  }

  // ---------- Ações ----------
  solicitarReset() {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.apiErrorMessage = null;
    this.successMessage = null;
    this.isSubmitting = true;

    const email = this.email.value.trim();
    this.api.requestReset(email).subscribe({
      next: (usuario) => {
        this.usuarioRetornado = usuario;
        this.isSubmitting = false;
        this.successMessage = 'Código enviado ao seu e-mail. Verifique sua caixa de entrada.';
        this.goAfterSuccess(5000, () => this.step = 2); // delay 5s
      },
      error: (err) => {
        this.isSubmitting = false;
        this.apiErrorMessage = err?.error?.message || 'Não foi possível solicitar o reset. Verifique o e-mail e tente novamente.';
      }
    });
  }

  validarCodigo() {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    if (!this.emailSalvo) {
      this.apiErrorMessage = 'E-mail não encontrado no fluxo. Solicite o reset novamente.';
      return;
    }

    this.apiErrorMessage = null;
    this.successMessage = null;
    this.isSubmitting = true;

    this.api.verifyCode(this.emailSalvo, this.codeRaw).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res?.status === 200 && res?.data?.token) {
          this.api.saveToken(res.data.token); // salva o token
          this.successMessage = 'Código validado com sucesso. Você pode definir a nova senha.';
          this.goAfterSuccess(5000, () => this.step = 3); // delay 5s
        } else {
          this.apiErrorMessage = res?.message || 'Código inválido ou expirado.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.apiErrorMessage = err?.error?.message || 'Código inválido ou expirado.';
      }
    });
  }

  enviarNovaSenha() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    if (!this.emailSalvo) {
      this.apiErrorMessage = 'E-mail não encontrado no fluxo. Solicite o reset novamente.';
      return;
    }

    this.apiErrorMessage = null;
    this.successMessage = null;
    this.isSubmitting = true;

    this.api.updatePassword(this.emailSalvo, this.senha.value).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res?.status === 200 || res?.status === 201) {
          this.successMessage = 'Senha redefinida com sucesso. Redirecionando para o login...';
          // limpa token de reset e vai pro login após 5s
          this.goAfterSuccess(5000, () => {
            this.api.clearToken();
            this.router.navigate(['/login']);
          });
        } else {
          this.apiErrorMessage = res?.message || 'Não foi possível redefinir a senha.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.apiErrorMessage = err?.error?.message || 'Não foi possível redefinir a senha.';
      }
    });
  }

  // ---------- Handlers dos inputs do código ----------
  onOtpInput(e: Event, index: number) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    input.value = v;
    this.codeArray.at(index).setValue(v as any, { emitEvent: false });
    if (v && index < this.otpInputs.length - 1) this.otpInputs.get(index + 1)?.nativeElement.focus();
  }

  onOtpKeydown(e: KeyboardEvent, index: number) {
    const input = e.target as HTMLInputElement;
    if (e.key === 'Backspace' && !input.value && index > 0) {
      e.preventDefault();
      const prev = this.otpInputs.get(index - 1)!.nativeElement;
      prev.focus(); prev.value = '';
      this.codeArray.at(index - 1).setValue('' as any, { emitEvent: false });
    }
    if ((e.key === 'ArrowLeft' || e.key === 'Left') && index > 0) this.otpInputs.get(index - 1)?.nativeElement.focus();
    if ((e.key === 'ArrowRight' || e.key === 'Right') && index < this.otpInputs.length - 1) this.otpInputs.get(index + 1)?.nativeElement.focus();
  }

  onOtpPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text') ?? '';
    const chars = Array.from(text.toUpperCase().replace(/[^A-Z0-9]/g, '')).slice(0, 8);
    chars.forEach((ch, i) => {
      const el = this.otpInputs.get(i)?.nativeElement;
      if (!el) return;
      el.value = ch;
      this.codeArray.at(i).setValue(ch as any, { emitEvent: false });
    });
    const next = chars.length < 8 ? chars.length : 7;
    this.otpInputs.get(next)?.nativeElement.focus();
  }

  // exibe 12-34-56-78
  get codigoFormatado(): string {
    const d = this.codeArray.controls.map(c => (c.value ? String(c.value).toUpperCase() : '•')).join('');
    return d.replace(/(..)(?=.)/g, '$1-');
  }
}
