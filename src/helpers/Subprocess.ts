import { Message, messageFromJSON, MessageType } from './Message';
import * as Debug from 'debug';

export type MessageHandler<T> = (m: T) => void;

export default class Subprocess {
  private debug: Debug.IDebugger;
  private messageHandlers: Map<MessageType, Set<MessageHandler<Message>>> = new Map();

  constructor(readonly kind: string) {
    if (!process.send) {
      throw new Error('This module should be spawned as a fork');
    }
    this.debug = Debug(`wreck:${kind}:subprocess`);
    this.setupSignalHandlers();
    this.setupMessageHandler();
  }

  send(msg: Message) {
    // We are sure send exists because it's validated in the constructor!
    process.send!(msg);
  }

  addMessageListener<T extends Message>(type: MessageType, handler: MessageHandler<T>) {
    const handlers: Set<MessageHandler<T>> = this.messageHandlers.get(type) || new Set();
    handlers.add(handler);
    this.messageHandlers.set(type, handlers as Set<MessageHandler<Message>>);
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

  private setupSignalHandlers() {
    process.on('SIGINT', () => {
      this.debug('exiting sub process');
      // process.exit();
      setTimeout(() => {
        this.debug('never');
      },         2000);
    });

    process.on('disconnect', () => {
      this.debug('Process disconnected. Exiting.');
      process.exit();
    });
  }
}
