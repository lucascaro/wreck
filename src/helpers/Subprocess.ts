import { Message, messageFromJSON } from './Message';
import * as Debug from 'debug';

export type MessageHandler = (m: Message) => void;

export default class Subprocess {
  private debug: Debug.IDebugger;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();

  constructor(readonly kind: string) {
    if (!process.send) {
      throw new Error('This module should be spawned as a fork');
    }
    this.debug = Debug(`wreck:${kind}:subprocess`);
    process.on('SIGINT', () => {
      this.debug('exiting sub process');
      // process.exit();
    });

    this.setupMessageHandler();
  }

  send(msg: Message) {
    // We are sure send exists because it's validated in the constructor!
    process.send!(msg);
  }

  addMessageListener(type: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(type) || new Set();
    handlers.add(handler);
    this.messageHandlers.set(type, handlers);
  }

  readEnvString(name: string, fallback: string = ''): string {
    return process.env[name] || fallback;
  }

  readEnvNumber(name: string, fallback: number): number {
    return Number(process.env[name]) || fallback;
  }
  readEnvArray<T>(name: string, fallback: T[]): T[] {
    const str = process.env[name] || '';
    return JSON.parse(str) || fallback;
  }

  private setupMessageHandler() {
    process.on('message', (m) => {
      this.debug('received message');
      this.debug(m);
      if (!m || !m.type || typeof m.type !== 'string') {
        this.debug('Ingoring malformed message');
        this.debug(m);
      }
      const message = messageFromJSON(m);
      const handlers = this.messageHandlers.get(m.type) || new Set();
      if (handlers.size === 0) {
        this.debug('no handlers registered for message');
      }
      handlers.forEach(handler => handler(message));
    });
  }
}
