import { Injectable, OnDestroy } from '@angular/core';
import SockJS from 'sockjs-client';
import { Client, IMessage, StompSubscription, IStompSocket } from '@stomp/stompjs';
import { WS_ENDPOINTS } from '../../../config/app-config';

type SubCb = (msg: IMessage) => void;

@Injectable({ providedIn: 'root' })
export class StompService implements OnDestroy {
  private client?: Client;
  private isActive = false;
  private pendingSubs: Array<{ dest: string; cb: SubCb }> = [];
  private liveSubs: StompSubscription[] = [];

  private sockFactory = (): IStompSocket =>
    new SockJS(WS_ENDPOINTS.sockJs) as unknown as IStompSocket;

  connect() {
    if (this.isActive) return;
    this.client = new Client({
      webSocketFactory: this.sockFactory,
      reconnectDelay: 3000,
    });

    this.client.onConnect = () => {
      this.isActive = true;
      this.pendingSubs.forEach(({ dest, cb }) => {
        const s = this.client!.subscribe(dest, cb);
        this.liveSubs.push(s);
      });
      this.pendingSubs = [];
    };

    this.client.onStompError = f => console.warn('[STOMP ERROR]', f.headers['message']);
    this.client.onWebSocketError = e => console.warn('[STOMP WS ERROR]', e);

    this.client.activate();
  }

  subscribe(destination: string, cb: SubCb): () => void {
    if (!this.client || !this.isActive) {
      this.pendingSubs.push({ dest: destination, cb });
      this.connect();
      return () => {
        this.pendingSubs = this.pendingSubs.filter(p => !(p.dest === destination && p.cb === cb));
      };
    }
    const sub = this.client.subscribe(destination, cb);
    this.liveSubs.push(sub);
    return () => {
      try { sub.unsubscribe(); } catch {}
      this.liveSubs = this.liveSubs.filter(s => s.id !== sub.id);
    };
  }

  send(destination: string, body: any) {
    if (!this.client) this.connect();
    this.client?.publish({ destination, body: JSON.stringify(body ?? {}) });
  }

  disconnect() {
    try {
      this.liveSubs.forEach(s => s.unsubscribe());
      this.liveSubs = [];
      this.client?.deactivate();
    } catch {}
    this.isActive = false;
  }

  ngOnDestroy(): void { this.disconnect(); }
}
