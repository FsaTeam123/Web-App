import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { API_ENDPOINTS, API_BASE_URL, DEFAULT_AVATAR_PATH } from '../../../config/app-config';

type TabKey = 'home' | 'lobby' | 'personagens' | 'mapas' | 'anotacoes' | 'chat';
type ToolKey = 'pencil' | 'eraser' | 'rect' | 'ellipse';
type Snapshot = { dataUrl: string; width: number; height: number; originX: number; originY: number };

@Component({
  selector: 'app-inicio-sessao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inicio-sessao.component.html',
  styleUrls: ['./inicio-sessao.component.css']
})

export class InicioSessaoComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('gridCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hdr', { static: true }) hdrRef!: ElementRef<HTMLElement>;

  jogo: any | null = null;
  activeTab: TabKey = 'lobby';

  constructor(private router: Router) {}

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
  }

  ngOnDestroy(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    if (this.boundDown) canvas.removeEventListener('pointerdown', this.boundDown);
    if (this.boundMove) canvas.removeEventListener('pointermove', this.boundMove);
    if (this.boundUp) canvas.removeEventListener('pointerup', this.boundUp);
    if (this.boundCancel) canvas.removeEventListener('pointercancel', this.boundCancel);
    if (this.boundWheel) canvas.removeEventListener('wheel', this.boundWheel as any);
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
}
