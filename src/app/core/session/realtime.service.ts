// realtime.service.ts
import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface DrawMsg {
  type: 'stroke:start'|'stroke:segment'|'stroke:end'|'shape:rect'|'shape:ellipse'|'clear'|'snapshot';
  sessionId: string;
  clientId: string;
  strokeId?: string;
  tool?: 'pencil'|'eraser'|'rect'|'ellipse';
  color?: string;
  worldWidth?: number;
  x?: number; y?: number;
  x2?: number; y2?: number;
  dataUrl?: string; originX?: number; originY?: number;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private stomp?: Client;
  private sub?: StompSubscription;

  connect(sessionId: string, onMsg: (m: DrawMsg)=>void) {
    this.stomp = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 2000
    });
    this.stomp.onConnect = () => {
      this.sub = this.stomp!.subscribe(`/topic/sessao.${sessionId}`, (frame: IMessage) => {
        onMsg(JSON.parse(frame.body));
      });
    };
    this.stomp.activate();
  }

  disconnect() {
    this.sub?.unsubscribe();
    this.stomp?.deactivate();
  }

  send(sessionId: string, msg: DrawMsg) {
    this.stomp?.publish({ destination: `/app/sessao.${sessionId}.draw`, body: JSON.stringify(msg) });
  }
}
