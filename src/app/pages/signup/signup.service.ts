// src/app/pages/signup/signup.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Sexo, CreateUserRequest } from './models';
import { API_ENDPOINTS } from '../../../config/app-config';

@Injectable({ providedIn: 'root' })
export class SignupService {
  constructor(private http: HttpClient) {}

  getSexos(): Observable<Sexo[]> {
    return this.http.get<Sexo[]>(API_ENDPOINTS.sexos);
  }

  // ✅ Tipar como HttpResponse<any> (ou um tipo seu, se tiver)
  createUser(payload: CreateUserRequest): Observable<HttpResponse<any>> {
    return this.http.post<any>(API_ENDPOINTS.usuarios, payload, { observe: 'response' });
  }
}
