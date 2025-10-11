import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, HostListener, TrackByFunction 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { API_ENDPOINTS, DEFAULT_AVATAR_PATH, WS_ENDPOINTS } from '../../../config/app-config';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { StompService } from '../../core/realtime/stomp.service'; // <- novo serviço

type TabKey = 'home' | 'lobby' | 'personagens' | 'mapas' | 'anotacoes' | 'chat';
type ToolKey = 'pencil' | 'eraser' | 'rect' | 'ellipse';
type Snapshot = { dataUrl: string; width: number; height: number; originX: number; originY: number };

interface MesaPlayerVM {
  idPlayer: number;
  playerNome: string;
  userId: number;
  nickname: string;
  online: number | null;
  fotoUrl: string;
  _hasPhoto: boolean;
  isMaster?: boolean;
}
interface MesaMasterVM {
  idUsuario: number;
  nickname: string;
  online?: number | null;
  fotoUrl: string;
  _hasPhoto: boolean;
}

type ChatMsg = {
  senderId: number;
  senderNick: string;
  text: string;
  ts: string;     // ISO
  scope?: string; // opcional
};

type MapVM = {
  idMapa: number;
  idJogo: number;
  nome: string;
  descricao?: string;
  grid?: number;
  ativo?: number;
  hasImage: boolean;
  imgUrl: string; // conveniência (API_ENDPOINTS.mapaImagem)
};

@Component({
  selector: 'app-inicio-sessao',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './inicio-sessao.component.html',
  styleUrls: ['./inicio-sessao.component.css']
})

export class InicioSessaoComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('gridCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hdr', { static: true }) hdrRef!: ElementRef<HTMLElement>;

  // CHAT: estado
  chatOpen = true;
  chatWidth = 360;          // px
  private chatMinW = 260;
  private chatMaxW = 720;
  private chatIsResizing = false;
  private chatStartX = 0;
  private chatStartW = 0;

  diarioOpen = false;
  diarioLoading = false;
  diarioSaving = false;
  diarioErr: string | null = null;

  diarioId: number | null = null;     // id_anotacao
  diarioJogoId: number | null = null; // id do jogo
  diarioText = '';  

  chatMsgs: ChatMsg[] = [];
  newMsg = '';
  private unsubChat?: () => void;

  @ViewChild('chatBody') chatBodyRef!: ElementRef<HTMLDivElement>;

  jogo: any | null = null;
  activeTab: TabKey = 'lobby';

  mapsOpen = false;
  mapsLoading = false;
  mapsErr: string | null = null;
  maps: MapVM[] = [];

  mapModalOpen = false;           // pop-up "Novo mapa"
  mapSaving = false;
  mapForm = { nome: '', descricao: '', grid: 48, file: null as File | null };

  selectedMapId: number | null = null;
  private mapImg: HTMLImageElement | null = null;
  private mapImgLoaded = false;

  private unsubMapWS?: () => void;

  constructor(
    private router: Router,
    private http: HttpClient,
    private stompSvc: StompService
  ) {}

  // viewport / transform
  private ctx!: CanvasRenderingContext2D;
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private scale = 1;
  private minScale = 0.2;
  private maxScale = 4;
  private offsetX = 0;
  private offsetY = 0;

  // grid (em unidades de "mundo")
  private gridSize = 48;

  // desenho: offscreen “mundo grande”
  private ART_SIZE = 4096;
  private origin = { x: this.ART_SIZE / 2, y: this.ART_SIZE / 2 };
  private art!: HTMLCanvasElement;
  private artCtx!: CanvasRenderingContext2D;

  // estados de interação
  isPanning = false;
  isDrawing = false;
  private lastScreen = { x: 0, y: 0 };      // último ponto da tela (pan)
  private lastWorld = { x: 0, y: 0 };       // último ponto no mundo (draw)
  private pointers = new Map<number, {x:number,y:number}>(); // pinch-zoom

  // ferramentas
  tool: ToolKey = 'pencil';
  color = '#e6bd3b';
  stroke = 4; // espessura em px visuais (corrigido com scale)

  // histórico
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private maxHistory = 30;

  // formas
  private shapeStart: {x:number,y:number} | null = null;
  private shapeCurr:  {x:number,y:number} | null = null;

  // pinch
  private initialPinchDist = 0;
  private initialScale = 1;

  // UI slider
  get zoomPercent(){ return Math.round(this.scale * 100); }
  set zoomPercent(v: number){ this.setZoom(v/100, 'center'); }

  // refs para remover listeners no destroy
  private boundDown?: (e: PointerEvent)=>void;
  private boundMove?: (e: PointerEvent)=>void;
  private boundUp?: (e: PointerEvent)=>void;
  private boundCancel?: (e: PointerEvent)=>void;
  private boundWheel?: (e: WheelEvent)=>void;

  mesaOpen = false;
  mesaLoading = false;
  mesaErr: string | null = null;
  mesaPlayers: MesaPlayerVM[] = [];
  mesaMaster: MesaMasterVM | null = null;
  DEFAULT_AVATAR_PATH = DEFAULT_AVATAR_PATH;

  private mesaUnsubs: Array<() => void> = [];

  private mapScale = 1;       // 1 = 100%
  private mapMinScale = 0.1;  // 10%
  private mapMaxScale = 8;    // 800%

  private setMapScale(v: number){
    this.mapScale = Math.min(this.mapMaxScale, Math.max(this.mapMinScale, v));
    this.render();
  }
  mapScaleIn(){  this.setMapScale(this.mapScale * 1.10); }  // +10%
  mapScaleOut(){ this.setMapScale(this.mapScale / 1.10); }  // -10%
  mapScaleReset(){ this.setMapScale(1); }
  get mapScalePercent(){ return Math.round(this.mapScale * 100); }
  set mapScalePercent(v: number){ this.setMapScale(v/100); }
  private saveMapScale(mapId: number){ localStorage.setItem(`mapScale:${mapId}`, String(this.mapScale)); }
  private loadMapScale(mapId: number){
    const v = +(localStorage.getItem(`mapScale:${mapId}`) ?? '0');
    if (v > 0){ this.setMapScale(v); }
  }


  ngOnInit(): void {
    const st = history.state?.jogo;
    if (st) {
      this.jogo = st;
      sessionStorage.setItem('jogoAtual', JSON.stringify(st));
    } else {
      const cache = sessionStorage.getItem('jogoAtual');
      if (cache) { try { this.jogo = JSON.parse(cache); } catch {} }
    }
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx = ctx;

    // (1) CRIE O OFFSCREEN ANTES DE QUALQUER RENDER
    this.art = document.createElement('canvas');
    this.art.width  = this.ART_SIZE;
    this.art.height = this.ART_SIZE;
    this.artCtx = this.art.getContext('2d', { alpha: true })!;
    this.artCtx.lineCap = 'round';
    this.artCtx.lineJoin = 'round';

    // (2) mede header e seta var CSS
    this.setCanvasHeaderVar();

    // (3) DPR + touch-action
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.touchAction = 'none';

    // (4) dimensiona e desenha (agora o offscreen já existe)
    this.resizeCanvas();
    requestAnimationFrame(() => this.resizeCanvas());

    // (5) eventos
    this.boundDown   = this.onPointerDown.bind(this);
    this.boundMove   = this.onPointerMove.bind(this);
    this.boundUp     = this.onPointerUpOrCancel.bind(this);
    this.boundCancel = this.onPointerUpOrCancel.bind(this);
    this.boundWheel  = this.onWheel.bind(this);

    canvas.addEventListener('pointerdown', this.boundDown);
    canvas.addEventListener('pointermove', this.boundMove);
    canvas.addEventListener('pointerup', this.boundUp);
    canvas.addEventListener('pointercancel', this.boundCancel);
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    const saved = +localStorage.getItem(`chatW:${idJogo}`)!;
    if (saved) this.chatWidth = Math.min(this.chatMaxW, Math.max(this.chatMinW, saved));

    if (idJogo) this.bindChat(idJogo);
    if (idJogo) {
      this.bindMapSelectedWS(idJogo);
      this.loadMapsForGame(idJogo);
    }
  }

  ngOnDestroy(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    if (this.boundDown) canvas.removeEventListener('pointerdown', this.boundDown);
    if (this.boundMove) canvas.removeEventListener('pointermove', this.boundMove);
    if (this.boundUp) canvas.removeEventListener('pointerup', this.boundUp);
    if (this.boundCancel) canvas.removeEventListener('pointercancel', this.boundCancel);
    if (this.boundWheel) canvas.removeEventListener('wheel', this.boundWheel as any);
    if (this.unsubMapWS){ try{ this.unsubMapWS(); }catch{} this.unsubMapWS = undefined; }
    this.cleanupMesaRealtime();
    this.unbindChat();
  }

  @HostListener('window:resize')
  resizeCanvas(){
    const c = this.canvasRef.nativeElement;

    // tamanhos em CSS px
    const wCss = c.clientWidth;
    const hCss = c.clientHeight;

    const w = Math.max(1, Math.floor(wCss * this.dpr));
    const h = Math.max(1, Math.floor(hCss * this.dpr));

    if (c.width !== w || c.height !== h){
        c.width  = w;
        c.height = h;
    }

    // volta para identidade antes de redesenhar
    this.ctx.setTransform(1,0,0,1,0,0);
    this.render();
  }

  handleWindowResize(){
    this.setCanvasHeaderVar();
    this.resizeCanvas();
  }

  // ---------------- Tabs (visual) ----------------
  go(tab: TabKey){
    if (tab === 'home'){
        this.router.navigate(['/inicio']);
        return;
    }
    this.activeTab = tab;
  }

  // ---------------- Pan / Zoom ----------------
  private screenToWorld(x: number, y: number){
    return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale };
  }
  private clampZoom(z: number){ return Math.min(this.maxScale, Math.max(this.minScale, z)); }

  private setCanvasHeaderVar() {
    // Mede a altura REAL do header e expõe como CSS var
    const h = this.hdrRef?.nativeElement?.getBoundingClientRect().height || 72;
    document.documentElement.style.setProperty('--session-header-h', `${Math.round(h)}px`);
  }

  private setZoom(newScale: number, anchor: 'center' | {x:number,y:number}){
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const a = anchor === 'center' ? { x: rect.width/2, y: rect.height/2 } : anchor;
    const worldAtAnchor = this.screenToWorld(a.x, a.y);

    this.scale = this.clampZoom(newScale);
    // mantém o mesmo ponto do mundo sob o mesmo pixel da tela
    this.offsetX = a.x - worldAtAnchor.x * this.scale;
    this.offsetY = a.y - worldAtAnchor.y * this.scale;

    this.render();
  }

  zoomIn(){ this.setZoom(this.scale * 1.15, 'center'); }
  zoomOut(){ this.setZoom(this.scale / 1.15, 'center'); }
  zoomReset(){ this.scale = 1; this.offsetX = 0; this.offsetY = 0; this.render(); }

  // ---------------- Histórico ----------------
  private pushHistory(){
    try {
      this.undoStack.push({
        dataUrl: this.art.toDataURL('image/png'),
        width: this.art.width,
        height: this.art.height,
        originX: this.origin.x,
        originY: this.origin.y,
      });
      if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
      this.redoStack.length = 0;
    } catch {}
  }

  undo(){
    if (!this.undoStack.length) return;
    const current: Snapshot = {
      dataUrl: this.art.toDataURL('image/png'),
      width: this.art.width, height: this.art.height,
      originX: this.origin.x, originY: this.origin.y
    };
    const prev = this.undoStack.pop()!;
    this.redoStack.push(current);
    this.restoreArtFrom(prev);
  }

  redo(){
    if (!this.redoStack.length) return;
    const current: Snapshot = {
      dataUrl: this.art.toDataURL('image/png'),
      width: this.art.width, height: this.art.height,
      originX: this.origin.x, originY: this.origin.y
    };
    const next = this.redoStack.pop()!;
    this.undoStack.push(current);
    this.restoreArtFrom(next);
  }

  private async restoreArtFrom(snap: Snapshot){
    const img = new Image();
    await new Promise<void>((res, rej)=>{ img.onload = ()=>res(); img.onerror = rej; img.src = snap.dataUrl; });

    const newArt = document.createElement('canvas');
    newArt.width  = snap.width;
    newArt.height = snap.height;
    const newCtx = newArt.getContext('2d', { alpha: true })!;
    newCtx.drawImage(img, 0, 0);

    this.art = newArt;
    this.artCtx = newCtx;
    this.artCtx.lineCap = 'round';
    this.artCtx.lineJoin = 'round';
    this.origin.x = snap.originX;
    this.origin.y = snap.originY;

    this.render();
  }

  clearArt(){
    this.pushHistory();
    this.artCtx.clearRect(0, 0, this.art.width, this.art.height);
    this.render();
  }

  // ---------------- Ferramentas ----------------
  private applyStrokeStyleForCurrentTool(){
    this.artCtx.globalCompositeOperation = (this.tool === 'eraser') ? 'destination-out' : 'source-over';
    this.artCtx.strokeStyle = this.color;
    this.artCtx.lineWidth = Math.max(1, this.stroke / this.scale);
  }

  // ---------------- Offscreen growth ----------------
  private ensureArtCapacityRect(minWx:number, minWy:number, maxWx:number, maxWy:number) {
    const margin = 64;
    const toArt = (wx:number, wy:number) => ({ ax: wx + this.origin.x, ay: wy + this.origin.y });

    let needExpand = false;
    let newW = this.art.width, newH = this.art.height;
    let shiftX = 0, shiftY = 0;

    const a1 = toArt(minWx, minWy);
    const a2 = toArt(maxWx, maxWy);
    let minAx = Math.min(a1.ax, a2.ax);
    let minAy = Math.min(a1.ay, a2.ay);
    let maxAx = Math.max(a1.ax, a2.ax);
    let maxAy = Math.max(a1.ay, a2.ay);

    while (minAx < margin) { needExpand = true; shiftX += newW; this.origin.x += newW; minAx += newW; maxAx += newW; newW *= 2; }
    while (minAy < margin) { needExpand = true; shiftY += newH; this.origin.y += newH; minAy += newH; maxAy += newH; newH *= 2; }
    while (maxAx > newW - margin) { needExpand = true; newW *= 2; }
    while (maxAy > newH - margin) { needExpand = true; newH *= 2; }

    if (needExpand) {
      const newArt = document.createElement('canvas');
      newArt.width = newW; newArt.height = newH;
      const newCtx = newArt.getContext('2d', { alpha: true })!;
      newCtx.drawImage(this.art, shiftX, shiftY);
      this.art = newArt;
      this.artCtx = newCtx;
      this.artCtx.lineCap = 'round';
      this.artCtx.lineJoin = 'round';
    }
    return needExpand;
  }

  // ---------------- Eventos Pointer ----------------
  private onPointerDown(e: PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = this.getLocal(e);
    this.pointers.set(e.pointerId, { x: p.x, y: p.y });

    // 2 ponteiros: inicia pinch
    if (this.pointers.size === 2){
      const [p1, p2] = Array.from(this.pointers.values());
      this.initialPinchDist = this.distance(p1, p2);
      this.initialScale = this.scale;
      this.isPanning = false;
      this.isDrawing = false;
      return;
    }

    const panKey = e.ctrlKey || e.metaKey || e.button === 1;
    if (panKey){
      this.isPanning = true;
      this.lastScreen = { x: p.x, y: p.y };
      return;
    }

    // Lápis / Borracha
    if (this.tool === 'pencil' || this.tool === 'eraser'){
      this.isDrawing = true;
      this.pushHistory();
      const pt = this.screenToWorld(p.x, p.y);
      this.lastWorld = pt;

      this.applyStrokeStyleForCurrentTool();
      this.ensureArtCapacityRect(pt.x, pt.y, pt.x, pt.y);

      this.artCtx.beginPath();
      this.artCtx.moveTo(pt.x + this.origin.x, pt.y + this.origin.y);
      this.render();
      return;
    }

    // Retângulo / Elipse
    if (this.tool === 'rect' || this.tool === 'ellipse'){
      this.isDrawing = true;
      this.pushHistory();
      const pt = this.screenToWorld(p.x, p.y);
      this.shapeStart = pt;
      this.shapeCurr  = pt;
      this.render();
      return;
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.getLocal(e);
    this.pointers.set(e.pointerId, { x: p.x, y: p.y });

    // Pinch
    if (this.pointers.size === 2){
      const [p1, p2] = Array.from(this.pointers.values());
      const dist = this.distance(p1, p2);
      const mid = this.midpoint(p1, p2);
      if (!this.initialPinchDist){
        this.initialPinchDist = dist;
        this.initialScale = this.scale;
      } else {
        const factor = dist / this.initialPinchDist;
        this.setZoom(this.initialScale * factor, { x: mid.x, y: mid.y });
      }
      return;
    }

    // Pan
    if (this.isPanning){
      const dx = p.x - this.lastScreen.x;
      const dy = p.y - this.lastScreen.y;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastScreen = { x: p.x, y: p.y };
      this.render();
      return;
    }

    // Lápis / Borracha
    if (this.isDrawing && (this.tool === 'pencil' || this.tool === 'eraser')){
      const pt = this.screenToWorld(p.x, p.y);
      const expanded = this.ensureArtCapacityRect(pt.x, pt.y, pt.x, pt.y);
      if (expanded){
        // contexto mudou; re-aplica estilo e reconecta o path
        this.applyStrokeStyleForCurrentTool();
        this.artCtx.beginPath();
        this.artCtx.moveTo(this.lastWorld.x + this.origin.x, this.lastWorld.y + this.origin.y);
      }
      this.artCtx.lineTo(pt.x + this.origin.x, pt.y + this.origin.y);
      this.artCtx.stroke();
      this.lastWorld = pt;
      this.render();
      return;
    }

    // Formas (preview)
    if (this.isDrawing && (this.tool === 'rect' || this.tool === 'ellipse')){
      this.shapeCurr = this.screenToWorld(p.x, p.y);
      this.render();
    }
  }

  private onPointerUpOrCancel(e: PointerEvent) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2){ this.initialPinchDist = 0; }

    // Finaliza lápis/borracha
    if (this.isDrawing && (this.tool === 'pencil' || this.tool === 'eraser')){
      this.isDrawing = false;
      this.artCtx.closePath();
      this.render();
    }

    // Commit de formas
    if (this.isDrawing && (this.tool === 'rect' || this.tool === 'ellipse') && this.shapeStart && this.shapeCurr){
      const s = this.shapeStart, c = this.shapeCurr;

      // garante espaço ANTES de desenhar
      this.ensureArtCapacityRect(s.x, s.y, c.x, c.y);

      this.artCtx.save();
      this.artCtx.globalCompositeOperation = 'source-over';
      this.artCtx.strokeStyle = this.color;
      this.artCtx.lineWidth = Math.max(1, this.stroke / this.scale);

      if (this.tool === 'rect'){
        const x = Math.min(s.x, c.x) + this.origin.x;
        const y = Math.min(s.y, c.y) + this.origin.y;
        const w = Math.abs(c.x - s.x);
        const h = Math.abs(c.y - s.y);
        this.artCtx.strokeRect(x, y, w, h);
      } else {
        const cx = (s.x + c.x)/2 + this.origin.x;
        const cy = (s.y + c.y)/2 + this.origin.y;
        const rx = Math.abs(c.x - s.x)/2;
        const ry = Math.abs(c.y - s.y)/2;
        this.artCtx.beginPath();
        this.artCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
        this.artCtx.stroke();
      }
      this.artCtx.restore();

      this.isDrawing = false;
      this.shapeStart = this.shapeCurr = null;
      this.render();
    }

    this.isPanning = false;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();

    // Alt + Scroll => escala do MAPA
    if (e.altKey){
      const delta = Math.sign(e.deltaY);
      const factor = delta > 0 ? 1/1.12 : 1.12;
      this.setMapScale(this.mapScale * factor);
      return;
    }

    // Scroll normal => zoom geral
    const delta = Math.sign(e.deltaY);
    const factor = delta > 0 ? 1/1.12 : 1.12;
    const p = this.getLocal(e);
    this.setZoom(this.scale * factor, { x: p.x, y: p.y });
  }

  // ---------------- Render ----------------
  private render(){
    if (!this.ctx || !this.art) return; // guarda de segurança

    const c = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, c.width, c.height);

    ctx.setTransform(
        this.dpr * this.scale, 0, 0,
        this.dpr * this.scale,
        this.dpr * this.offsetX,
        this.dpr * this.offsetY
    );

    // 1) mapa (fundo)
    if (this.mapImg && this.mapImgLoaded) {
      // tamanho final do mapa em "unidades de mundo"
      const w = this.mapImg.width  * this.mapScale;
      const h = this.mapImg.height * this.mapScale;

      // centraliza o mapa no (0,0) do mundo
      const mx = -w/2;
      const my = -h/2;

      // suavização ligada (ou desligue se quiser pixel art)
      this.ctx.imageSmoothingEnabled = true;

      ctx.drawImage(this.mapImg, mx, my, w, h);
    }
    this.drawGrid(ctx);
    ctx.drawImage(this.art, -this.origin.x, -this.origin.y);

    if (this.isDrawing && this.shapeStart && this.shapeCurr){
        this.drawShapePreview(ctx, this.shapeStart, this.shapeCurr, this.tool);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D){
    const c = this.canvasRef.nativeElement;
    const startWorld = this.screenToWorld(0,0);
    const endWorld = this.screenToWorld(c.width/this.dpr, c.height/this.dpr);

    const startX = Math.floor(startWorld.x / this.gridSize) * this.gridSize;
    const startY = Math.floor(startWorld.y / this.gridSize) * this.gridSize;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 / this.scale;

    ctx.beginPath();
    for (let x = startX; x <= endWorld.x; x += this.gridSize){
      ctx.moveTo(x, startWorld.y);
      ctx.lineTo(x, endWorld.y);
    }
    for (let y = startY; y <= endWorld.y; y += this.gridSize){
      ctx.moveTo(startWorld.x, y);
      ctx.lineTo(endWorld.x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------------- Utils ----------------
  private getLocal(e: {clientX:number; clientY:number}) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  private distance(a:{x:number,y:number}, b:{x:number,y:number}){ return Math.hypot(a.x - b.x, a.y - b.y); }
  private midpoint(a:{x:number,y:number}, b:{x:number,y:number}){ return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }; }

  private drawShapePreview(ctx: CanvasRenderingContext2D, s:{x:number,y:number}, c:{x:number,y:number}, kind: ToolKey){
    if (kind !== 'rect' && kind !== 'ellipse') return;

    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(1, this.stroke / this.scale);
    ctx.setLineDash([8/this.scale, 8/this.scale]); // tracejado

    if (kind === 'rect'){
      const x = Math.min(s.x, c.x);
      const y = Math.min(s.y, c.y);
      const w = Math.abs(c.x - s.x);
      const h = Math.abs(c.y - s.y);
      ctx.strokeRect(x, y, w, h);
    } else {
      const cx = (s.x + c.x)/2;
      const cy = (s.y + c.y)/2;
      const rx = Math.abs(c.x - s.x)/2;
      const ry = Math.abs(c.y - s.y)/2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  openMesa(){
    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    if (!idJogo){ this.mesaOpen = true; this.mesaErr = 'ID do jogo não encontrado.'; return; }

    this.mesaOpen = true;
    this.mesaErr = null;
    this.mesaLoading = true;

    this.fetchMesa(idJogo).finally(()=>{
      this.mesaLoading = false;
      this.bindMesaRealtime(idJogo);
    });
  }

  closeMesa(){
    this.mesaOpen = false;
    this.cleanupMesaRealtime();
  }

  private cleanupMesaRealtime(){
    // cancela inscrições STOMP desta tela
    this.mesaUnsubs.forEach(u => { try{ u(); } catch{} });
    this.mesaUnsubs = [];
  }

  private async fetchMesa(idJogo: number){
    try{
      // players
      const resp = await this.http.get<any[]>(API_ENDPOINTS.playersPorJogo(idJogo)).toPromise();
      const players = Array.isArray(resp) ? resp : [];

      // mestre
      const masterId: number | undefined =
        this.jogo?.master?.idUsuario ?? players?.[0]?.jogo?.master?.idUsuario;

      let masterVM: MesaMasterVM | null = null;
      if (masterId){
        const m = await this.http.get<any>(`${API_ENDPOINTS.usuarios}/${masterId}`).toPromise();
        masterVM = {
          idUsuario: m?.idUsuario,
          nickname: m?.nickname || 'Mestre',
          online: m?.online ?? null,
          fotoUrl: API_ENDPOINTS.usuarioFoto(m?.idUsuario),
          _hasPhoto: true,
        };
      }

      // map players
      const mapped: MesaPlayerVM[] = players.map(p => ({
        idPlayer: p.idPlayer,
        playerNome: p.nome,
        userId: p.usuario?.idUsuario,
        nickname: p.usuario?.nickname || p.usuario?.nome || 'Jogador',
        online: p.usuario?.online ?? null,
        fotoUrl: API_ENDPOINTS.usuarioFoto(p.usuario?.idUsuario),
        _hasPhoto: true
      }));

      // remove o mestre da lista (se vier como player)
      const filtered = masterVM
        ? mapped.filter(x => x.userId !== masterVM!.idUsuario)
        : mapped;

      filtered.sort((a,b)=> (this.isOnline(b.online) ? 1:0) - (this.isOnline(a.online) ? 1:0));

      this.mesaMaster = masterVM;
      this.mesaPlayers = filtered;
    }catch(e){
      console.error(e);
      this.mesaErr = 'Erro ao carregar a Mesa.';
    }
  }

  private bindMesaRealtime(idJogo: number){
    this.cleanupMesaRealtime();

    const unsubMesa = this.stompSvc.subscribe(
      WS_ENDPOINTS.topics.mesa(idJogo),
      (msg)=> this.handleMesaMessage(msg, idJogo)
    );
    const unsubStatus = this.stompSvc.subscribe(
      WS_ENDPOINTS.topics.mesaStatus(idJogo),
      (msg)=> this.handleMesaMessage(msg, idJogo)
    );

    this.mesaUnsubs.push(unsubMesa, unsubStatus);
  }

  private async handleMesaMessage(message: any, idJogo: number){
    try{
      const payload = JSON.parse(message.body || '{}');
      const t = String(payload.type || '').toUpperCase();

      if (t === 'ONLINE' || t === 'OFFLINE'){
        const onlineVal = t === 'ONLINE' ? 1 : 0;
        // mestre
        if (this.mesaMaster && this.mesaMaster.idUsuario === payload.userId){
          this.mesaMaster.online = onlineVal;
        }
        // players
        const i = this.mesaPlayers.findIndex(p => p.userId === payload.userId);
        if (i >= 0){
          this.mesaPlayers[i] = { ...this.mesaPlayers[i], online: onlineVal };
        }
        return;
      }

      if (t === 'JOIN'){
        const vm: MesaPlayerVM = {
          idPlayer: payload.idPlayer,
          playerNome: payload.nome,
          userId: payload.usuario?.idUsuario,
          nickname: payload.usuario?.nickname || 'Jogador',
          online: payload.usuario?.online ?? null,
          fotoUrl: API_ENDPOINTS.usuarioFoto(payload.usuario?.idUsuario),
          _hasPhoto: true
        };
        const i = this.mesaPlayers.findIndex(p => p.userId === vm.userId);
        if (i >= 0) this.mesaPlayers[i] = vm;
        else this.mesaPlayers = [vm, ...this.mesaPlayers];
        return;
      }

      if (t === 'LEAVE'){
        this.mesaPlayers = this.mesaPlayers.filter(p => p.userId !== payload.userId);
        return;
      }

      if (t === 'PHOTO_UPDATE'){
        const bust = (u: string) => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        if (this.mesaMaster && this.mesaMaster.idUsuario === payload.userId){
          this.mesaMaster.fotoUrl = bust(this.mesaMaster.fotoUrl);
          this.mesaMaster._hasPhoto = true;
        }
        const i = this.mesaPlayers.findIndex(p => p.userId === payload.userId);
        if (i >= 0){
          this.mesaPlayers[i] = { ...this.mesaPlayers[i], fotoUrl: bust(this.mesaPlayers[i].fotoUrl), _hasPhoto: true };
        }
        return;
      }

      // fallback (mensagem desconhecida)
      await this.fetchMesa(idJogo);
    }catch(e){
      console.warn('Mensagem STOMP inválida', e);
    }
  }

  // CHAT: bind/unbind
  private bindChat(idJogo: number){
    this.unbindChat();
    const unsub = this.stompSvc.subscribe(
      WS_ENDPOINTS.topics.chat(idJogo),
      (frame)=> {
        try{
          const msg = JSON.parse(frame.body) as ChatMsg;
          this.chatMsgs = [...this.chatMsgs, msg];
          this.scrollChatBottomSoon();
        }catch(e){ console.warn('chat msg inválida', e); }
      }
    );
    this.unsubChat = unsub;
  }
  private unbindChat(){ if (this.unsubChat){ try{ this.unsubChat(); }catch{} this.unsubChat = undefined; } }

  // CHAT: enviar
  sendChat(ev?: Event){
    ev?.preventDefault();
    const txt = (this.newMsg || '').trim();
    if (!txt) return;

    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    if (!idJogo) return;

    const payload: ChatMsg = {
      senderId: 0,                   // preencha com seu usuário logado
      senderNick: 'Você',            // idem
      text: txt,
      ts: new Date().toISOString(),
      // scope: 'geral'
    };

    this.stompSvc.send(
      WS_ENDPOINTS.app.chatSend(idJogo),
      payload               // ← objeto, sem stringify
    );

    this.newMsg = '';
  }

  private scrollChatBottomSoon(){
    queueMicrotask(()=> {
      const el = this.chatBodyRef?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }

  // CHAT: resize (puxador)
  startChatResize(e: PointerEvent){
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.chatIsResizing = true;
    this.chatStartX = e.clientX;
    this.chatStartW = this.chatWidth;
  }
  onChatResizeMove(e: PointerEvent){
    if (!this.chatIsResizing) return;
    const dx = (this.chatStartX - e.clientX); // puxador fica na borda esquerda do painel
    const next = Math.min(this.chatMaxW, Math.max(this.chatMinW, this.chatStartW + dx));
    this.chatWidth = next;
  }
  endChatResize(e: PointerEvent){
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (!this.chatIsResizing) return;
    this.chatIsResizing = false;
    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    if (idJogo) localStorage.setItem(`chatW:${idJogo}`, String(this.chatWidth));
  }

  // utils mesa
  private isOnline(v: number | null | undefined){ return v === 1; }
  handleImageError(item: { _hasPhoto: boolean }){ item._hasPhoto = false; }
  trackByUserId = (_: number, p: MesaPlayerVM) => p.userId || p.idPlayer;
  trackByChat: TrackByFunction<ChatMsg> = (index: number, m: ChatMsg) =>
  // identifique a mensagem; se não tiver ID único do backend,
  // combine timestamp + senderId (+ tamanho do texto para reduzir colisão)
  (m.ts ? `${m.ts}|${m.senderId}|${m.text?.length ?? 0}` : index);

  openDiario(){
    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    this.diarioOpen = true;
    this.diarioErr = null;

    if (!idJogo){
      this.diarioErr = 'ID do jogo não encontrado.';
      return;
    }

    this.diarioLoading = true;
    this.ensureDiarioForGame(idJogo)
      .finally(()=> this.diarioLoading = false);
  }

  closeDiario(){
    this.diarioOpen = false;
  }

  private async ensureDiarioForGame(idJogo: number){
    try{
      const arr = await this.http
        .get<any[]>(API_ENDPOINTS.anotacoesPorJogo(idJogo))
        .toPromise();

      if (Array.isArray(arr) && arr.length > 0){
        const n = arr[0];
        this.diarioId = n.idAnotacao;
        this.diarioJogoId = n.jogoId ?? idJogo;
        this.diarioText = n.anotacao ?? '';
        return;
      }
    }catch(e){
      console.error(e);
    }

    // cria se vazio
    try{
      await this.http.post(
        API_ENDPOINTS.anotacoes,
        {
          jogoId: String(idJogo),
          anotacao: 'Escreva aqui suas anotações'
        }
      ).toPromise();

      const arr2 = await this.http
        .get<any[]>(API_ENDPOINTS.anotacoesPorJogo(idJogo))
        .toPromise();

      const n2 = Array.isArray(arr2) && arr2.length ? arr2[0] : null;
      if (n2){
        this.diarioId = n2.idAnotacao;
        this.diarioJogoId = n2.jogoId ?? idJogo;
        this.diarioText = n2.anotacao ?? '';
      }else{
        this.diarioErr = 'Não foi possível criar/carregar a anotação.';
      }
    }catch(e){
      console.error(e);
      this.diarioErr = 'Erro ao criar a anotação inicial.';
    }
  }

  saveDiario(){
    if (!this.diarioId || !this.diarioJogoId){
      this.diarioErr = 'Anotação/Jogo inválidos.';
      return;
    }
    this.diarioSaving = true;

    this.http.put(
      `${API_ENDPOINTS.anotacoes}/${this.diarioId}`,
      {
        jogoId: String(this.diarioJogoId),
        anotacao: this.diarioText ?? ''
      }
    ).toPromise()
      .catch((e)=> {
        console.error(e);
        this.diarioErr = 'Erro ao salvar a anotação.';
      })
      .finally(()=> this.diarioSaving = false);
  }

  openMaps(){
    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    if (!idJogo){ this.mapsErr = 'ID do jogo não encontrado.'; this.mapsOpen = true; return; }
    this.mapsOpen = true;
    this.mapsErr = null;
    this.loadMapsForGame(idJogo);
  }

  closeMaps(){ this.mapsOpen = false; this.mapModalOpen = false; }

  private async loadMapsForGame(idJogo: number){
    this.mapsLoading = true; this.mapsErr = null;
    try{
      const arr = await this.http.get<any[]>(API_ENDPOINTS.mapasPorJogo(idJogo)).toPromise();
      this.maps = (arr ?? []).map((m:any) => ({
        idMapa: m.idMapa,
        idJogo: m.idJogo ?? idJogo,
        nome: m.nome,
        descricao: m.descricao,
        grid: m.grid,
        ativo: m.ativo,
        hasImage: !!m.hasImage,
        imgUrl: API_ENDPOINTS.mapaImagem(m.idMapa)
      }));
    }catch(e){
      console.error(e);
      this.mapsErr = 'Erro ao carregar mapas do jogo.';
    }finally{
      this.mapsLoading = false;
    }
  }

  trackByMapaId = (_: number, m: MapVM) => m.idMapa;

  // Seleção local + broadcast (opcional)
  async selectMap(m: MapVM, broadcast = true){
    this.selectedMapId = m.idMapa;
    // carrega a imagem (cache via URL – o endpoint já entrega bytes)
    this.mapImgLoaded = false;
    this.mapImg = new Image();
    await new Promise<void>((res, rej) => {
      if (!this.mapImg) return res();
      this.mapImg.onload = ()=>{ this.mapImgLoaded = true; res(); };
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();

      // "fit to view" opcional (ajusta zoom para caber na tela)
      const fit = Math.min(
        rect.width  / this.mapImg!.width,
        rect.height / this.mapImg!.height
      );
      // use 1:1 no máximo para não pixelar; ajuste se quiser permitir zoom-in automático
      this.scale = this.clampZoom(Math.min(1, fit));

      // centraliza o centro do mapa (0,0) no centro da tela
      this.centerOn(0, 0);
      this.mapImg.onerror = rej;
      this.mapImg.src = m.imgUrl + `?t=` + Date.now(); // bust cache

      // (a) tenta restaurar escala salva deste mapa
      this.loadMapScale(m.idMapa);

      // (b) se não houver escala salva, faça um "fit" inicial (sem passar de 1:1)
      if (!localStorage.getItem(`mapScale:${m.idMapa}`)) {
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();
        const fit = Math.min(
          rect.width  / this.mapImg!.width,
          rect.height / this.mapImg!.height
        );
        this.setMapScale(Math.min(1, fit));
      }

      // centraliza câmera no centro do mundo (mapa está centrado em 0,0)
      this.centerOn(0, 0);

      // guarde a escala atual
      this.saveMapScale(m.idMapa);
    });
    this.render();

    // WS: avisa todo mundo da sessão
    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    if (broadcast && idJogo){
      this.stompSvc.send(
        WS_ENDPOINTS.app.mapSelect(idJogo),
        { mapaId: m.idMapa } // pode incluir {scale, offsetX, offsetY} se quiser sincronizar a câmera
      );
    }
  }

  private bindMapSelectedWS(idJogo: number){
    if (this.unsubMapWS){ try{ this.unsubMapWS(); }catch{} this.unsubMapWS = undefined; }
    this.unsubMapWS = this.stompSvc.subscribe(
      WS_ENDPOINTS.topics.mapaSelected(idJogo),
      async (frame) => {
        try{
          const payload = JSON.parse(frame.body || '{}');
          const id = +payload.mapaId;
          if (!id) return;
          const m = this.maps.find(x => x.idMapa === id);
          if (m) {
            // aplica também escala/offset recebidos (se vierem)
            if (typeof payload.scale === 'number') this.scale = this.clampZoom(payload.scale);
            if (typeof payload.offsetX === 'number') this.offsetX = payload.offsetX;
            if (typeof payload.offsetY === 'number') this.offsetY = payload.offsetY;
            await this.selectMap(m, /*broadcast*/ false);
          } else {
            // não está na lista ainda? recarrega e tenta de novo
            const jid = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
            if (jid){ await this.loadMapsForGame(jid); }
            const m2 = this.maps.find(x => x.idMapa === id);
            if (m2) await this.selectMap(m2, false);
          }
        }catch(e){ console.warn('mapa selected payload inválido', e); }
      }
    );
  }

  // Pop-up "Novo mapa"
  openNewMapModal(){ this.mapModalOpen = true; this.mapForm = { nome:'', descricao:'', grid:48, file:null }; }
  closeNewMapModal(){ this.mapModalOpen = false; }

  // Criar mapa (POST JSON -> POST imagem)
  async createMap(){
    const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
    if (!idJogo){ return; }
    if (!this.mapForm.nome?.trim()){ alert('Informe um nome para o mapa.'); return; }

    this.mapSaving = true;
    try{
      // 1) cria o metadado
      const body = {
        nome: this.mapForm.nome.trim(),
        descricao: this.mapForm.descricao?.trim() ?? '',
        grid: this.mapForm.grid ?? 48,
        ativo: 1,
        jogo: { idJogo } // ManyToOne
      };
      const created = await this.http.post<any>(API_ENDPOINTS.mapas, body).toPromise();
      const newId = created?.idMapa;

      // 2) envia a imagem (se houver)
      if (newId && this.mapForm.file){
        const fd = new FormData();
        fd.append('file', this.mapForm.file);
        await this.http.post(`${API_ENDPOINTS.mapas}/${newId}/imagem`, fd).toPromise();
      }

      // 3) recarrega a lista e fecha modal
      await this.loadMapsForGame(idJogo);
      this.mapModalOpen = false;

    }catch(e){
      console.error(e);
      alert('Erro ao criar o mapa.');
    }finally{
      this.mapSaving = false;
    }
  }

  // Deletar mapa
  async deleteMap(m: MapVM){
    if (!confirm(`Excluir definitivamente o mapa "${m.nome}"?`)) return;
    try{
      await this.http.delete(`${API_ENDPOINTS.mapas}/${m.idMapa}`).toPromise();
      const idJogo = this.jogo?.idJogo || this.jogo?.jogo?.idJogo;
      if (idJogo) await this.loadMapsForGame(idJogo);
      if (this.selectedMapId === m.idMapa){
        this.selectedMapId = null;
        this.mapImg = null; this.mapImgLoaded = false; this.render();
      }
    }catch(e){
      console.error(e);
      alert('Erro ao excluir o mapa.');
    }
  }

  // file input handler
  onMapFileChange(ev: Event){
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.mapForm.file = file;
  }

  private centerOn(wx: number, wy: number) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.offsetX = rect.width  / 2 - wx * this.scale;
    this.offsetY = rect.height / 2 - wy * this.scale;
    this.render();
  }
}
