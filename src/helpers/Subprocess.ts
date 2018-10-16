import Message from './Message';
import * as Debug from 'debug';

export default class Subprocess {
  debug: Debug.IDebugger;
  constructor(readonly kind: string) {
    if (!process.send) {
      throw new Error('This module should be spawned as a fork');
    }
    this.debug = Debug(`wreck:${kind}:subprocess`);
    process.on('SIGINT', () => {
      this.debug('exiting sub process');
      // process.exit();
    });
  }

  send(msg: Message) {
    // We are sure send exists because it's validated in the constructor!
    process.send!(msg);
  }

  readEnvString(name: string, fallback: string = ''): string {
    return process.env[name] || fallback;
  }

  readEnvNumber(name: string, fallback: number): number {
    return Number(process.env[name]) || fallback;
  }
}
