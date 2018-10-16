import { fork, ChildProcess } from 'child_process';
import * as Debug from 'debug';
import * as os from 'os';
import { WorkMessage, ClaimMessage, MessageType, DoneMessage } from '../helpers/Message';

const debug = Debug('wreck:processes:main');

export interface MainProcessParameters {
  initialURLs: string[];
  concurrency: number;
  nRetries: number;
  nWorkers: number;
  rateLimit: number;
}
// const child = fork(path);
// const crawler = new Crawler(valid).start();
// console.log('CHLD', child);
// child.on('message', m => {
  //   console.log('PARENT got message:', m);
  //   child.disconnect();
  // });
  // setTimeout(() => {
    //   child.send({ op: 'hello' });
    // },         100);
export default class MainProcess {
  private queue!: ChildProcess;
  private workers!: ChildProcess[];
  private initialURLs: string[];
  private concurrency: number;
  private rateLimit: number;
  private nRetries: number;
  private nWorkers: number;

  constructor(
    params: Partial<MainProcessParameters>,
  ) {
    this.initialURLs = params.initialURLs || [];
    debug('new Crawler created');
    debug(this.initialURLs);
    this.nWorkers = params.nWorkers || os.cpus().length;
    this.concurrency = params.concurrency || 1;
    this.rateLimit = params.rateLimit || 5;
    this.nRetries = params.nRetries || 3;

    this.createSubprocesses();
    this.setupListeners();
    this.setupSignalHandlers();
  }

  start() {
    debug('starting to crawl URLs');
  }

  async close() {
    debug('closing all subprocesses');
    await this.killSubprocesses();
    this.workers.forEach(w => w.kill('SIGINT'));
  }

  private createSubprocesses() {
    debug('reating queue process');
    let magicPort = 9329;
    const queueExecArgv = process.env.DEBUG_QUEUE ? [
      `--inspect-brk=${magicPort += 1}`,
    ] : undefined;
    const workerExecArgv = process.env.DEBUG_WORKERS ? [
      `--inspect-brk=${magicPort += 1}`,
    ] : undefined;
    this.queue = fork(`${__dirname }/queue`, [], {
      execArgv: queueExecArgv,
      env: {
        ...process.env,
        WRECK_RATE_LIMIT_RATE: String(this.rateLimit),
        WRECK_RATE_LIMIT_CONCURRENCY: String(this.concurrency),
      },
    });
    this.workers = [...Array(this.nWorkers)].map((_, i) => {
      debug(`Creating worker #${i}`);
      return fork(
        `${__dirname}/worker`,
        [],
        {
          execArgv: workerExecArgv,
          env: {
            ...process.env,
            WRECK_CHILD_NO: String(i),
            WRECK_NUM_RETRIES: String(this.nRetries),
            WRECK_WORKER_CONCURRENCY: String(this.concurrency),
          },
        },
      );
    });
  }

  private killSubprocesses() {
    return Promise.all(
      [this.queue, ...this.workers].map((p) => {
        return new Promise((resolve) => {
          if (!p.connected) {
            resolve();
            return;
          }
          p.on('exit', resolve);
          p.kill('SIGTERM');
        });
      }),
    );
  }

  private setupListeners() {
    this.queue.on('message', (m: any) => this.handleQueueMessage(m));
    this.workers.forEach((w, i) =>
      w.on('message', (m: any) => this.handleWorkerMessage(i, m)),
    );
  }

  private setupSignalHandlers() {
    process.once('SIGINT', () => {
      console.error(
        '\nSIGINT detected, attemtping to exit gracefully. Press Ctrl-C again to force quit.',
      );
      this.close().then(() => {
        console.log('closed');
      });
    });

    // DEBUG CODE
    if (debug.enabled) {
      const signals = [
        'exit',
        'SIGUSR1',
        'SIGTERM',
        'SIGINT',
        'SIGPIPE',
        'SIGHUP',
        'SIGTERM',
        'SIGINT',
        'SIGBREAK',
      ];
      signals.forEach((s) => {
        process.on(s as NodeJS.Signals, () => {
          console.error(
            `RECEIVED ${s}.`,
          );
        });
      });
    }
    // END DEBUG CODE
  }
  private handleQueueMessage(message: any) {
    debug(`received message from queue: ${JSON.stringify(message)}`);
    if (!message || !message.type) {
      debug('received invalid message:', message);
      return;
    }
    switch (message.type) {
      case MessageType.READY:
        this.populateQueue();
        break;
      case MessageType.WORK:
        debug('got work from queue', message.payload);
        // TODO: be deffensive with the payload!
        const { workerNo } = message.payload;
        // TODO: deffensive with workerNo
        this.workers[workerNo].send(new WorkMessage(message.payload));
        break;
      case MessageType.QUEUE_EMPTY:
        console.log('All urls processed. Exiting.');
        this.close().then(() => {
          process.exit(0);
        });
        break;
      default:
        debug('received invalid message:', message);
    }
  }

  private handleWorkerMessage(workerNo: number, message: any) {
    debug(`received message from worker #${workerNo}: ${JSON.stringify(message)}`);
    if (!message || !message.type) {
      debug('received invalid message:', message);
      return;
    }
    switch (message.type) {
      case MessageType.READY:
        [...Array(this.concurrency)].forEach((_) => {
          this.queue.send(new ClaimMessage({ workerNo }));
        });
        break;

      case MessageType.DONE:
        const { url } = message.payload;
        debug(`Worker done with ${url}`);
        // TODO: handle error when reported worker number in payload is wrong.
        this.queue.send(new DoneMessage(message.payload));
        this.queue.send(new ClaimMessage({ workerNo }));
        break;
    }
  }

  private populateQueue() {
    this.initialURLs.forEach((url) => {
      this.queue.send(new WorkMessage({ url }));
    });
  }
}
