/******************************************************************
 * Polyfills para libs que esperam 'global' no browser (SockJS etc)
 ******************************************************************/
import 'zone.js'; // já deve existir

// 'global' → window
const _w = window as any;
if (typeof _w.global === 'undefined') {
  _w.global = _w;
}

// (opcional, apenas se precisar) fallback bobo para crypto.getRandomValues
if (!_w.crypto || !_w.crypto.getRandomValues) {
  _w.crypto = _w.crypto || {};
  _w.crypto.getRandomValues = (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  };
}

(window as any).global = window;

(window as any).process = (window as any).process || { env: {} };

// (opcional) alguns libs usam process.env.DEBUG
_w.process = _w.process || { env: { DEBUG: undefined } };
