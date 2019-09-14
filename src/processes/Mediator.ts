/*!
 *   Copyright 2018 Lucas Caro <lucascaro@gmail.com>
 *   This file is part of Foobar.
 *
 *   Foobar is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Foobar is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Foobar.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

import { fork, ChildProcess } from 'child_process';
import * as Debug from 'debug';
import * as os from 'os';
import {
  WorkMessage,
  ClaimMessage,
  MessageType,
  DoneMessage,
  messageFromJSON,
} from '@helpers/Message';
import { PersistentState } from '../helpers/PersistentState';
import output from '@helpers/output';

const debug = Debug('wreck:processes:main');

export interface MediatorParameters {
  initialURLs: string[];
  concurrency: number;
  nRetries: number;
  retryFailed: boolean;
  nWorkers: number;
  rateLimit: number;
  maxDepth: number;
  maxRequests: number;
  exclude: string[];
  noResume: boolean;
  timeout: number;
}

export default class Mediator {
  private queue!: ChildProcess;
  private workers!: ChildProcess[];
  private initialURLs: string[];
  private concurrency: number;
  private rateLimit: number;
  private nRetries: number;
  private retryFailed: boolean;
  private nWorkers: number;
  private maxDepth: number;
  private maxRequests: number;
  private exclude: string[];
  private noResume: boolean;
  private timeout: number;
  // TODO: move to a deferred helper;
  private onQueueReadyHandlers: Set<Function> = new Set();
  private queueIsReady = false;

  constructor(
    params: Partial<MediatorParameters>,
  ) {
    this.initialURLs = params.initialURLs || [];
    debug('new Crawler created');
    debug(params);
    this.nWorkers = params.nWorkers || os.cpus().length;
    this.concurrency = params.concurrency || 10;
    this.rateLimit = params.rateLimit || Infinity;
    this.nRetries = params.nRetries || 3;
    this.retryFailed = params.retryFailed || false;
    this.maxDepth = params.maxDepth || Infinity;
    this.maxRequests = params.maxRequests || Infinity;
    this.exclude = params.exclude || [];
    this.noResume = !!params.noResume;
    this.timeout = (params.timeout || 1000);
  }

  start() {
    debug('starting to crawl URLs');
    if (this.noResume) {
      PersistentState.resetState();
    }
    this.createSubprocesses();
    this.setupListeners();
    this.setupSignalHandlers();
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
        WRECK_QUEUE_MAX_REQUESTS: String(this.maxRequests),
        WRECK_QUEUE_RETRY_FAILED: JSON.stringify(this.retryFailed),
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
            WRECK_WORKER_MAX_DEPTH: String(this.maxDepth),
            WRECK_WORKER_EXCLUDE_URLS: JSON.stringify(this.exclude),
            WRECK_WORKER_REQUEST_TIMEOUT: JSON.stringify(this.timeout),
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
        output.normal('closed');
      });
    });

    // DEBUG CODE
    if (debug.enabled) {
      const signals = [
        'exit',
        'SIGUSR1',
        'SIGTERM',
        'SIGPIPE',
        'SIGHUP',
        'SIGTERM',
        // 'SIGINT',
        'SIGBREAK',
      ];
      signals.forEach((s) => {
        process.on(s as NodeJS.Signals, () => {
          debug(
            `RECEIVED ${s}.`,
          );
        });
      });
    }
    // END DEBUG CODE
  }
  private handleQueueMessage(m: any) {
    debug(`received message from queue: ${JSON.stringify(m)}`);
    const message = messageFromJSON(m);
    if (!message || !message.type) {
      debug('received invalid message:', message);
      return;
    }
    switch (message.type) {
      case MessageType.READY:
        this.populateQueue();
        // TODO: Move to helper
        this.queueIsReady = true;
        this.onQueueReadyHandlers.forEach((handler) => {
          handler();
        });
        break;
      case MessageType.WORK:
        debug('got work from queue', message.payload);
        // TODO: be deffensive with the payload!
        const { workerNo } = message.payload;
        // TODO: deffensive with workerNo
        this.workers[workerNo].send(new WorkMessage(message.payload));
        break;
      case MessageType.QUEUE_EMPTY:
        output.normal('All urls processed. Exiting.');
        this.close().then(() => {
          process.exit(0);
        });
        break;
      case MessageType.ERROR:
        output.error(`Fatal Error: ${message.payload}.`);
        this.close().then(() => {
          process.exit(1);
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
        // This is the event that triggers crawling but we don't know
        // whether the queue is ready at this point.
        // onQueueReady will call the function when the queue is ready,
        // which could be immediately if the queue has finished before
        // this particular worker.
        this.onQueueReady(() => {
          const workerConcurrency = Math.ceil(this.concurrency / this.nWorkers);
          [...Array(workerConcurrency)].forEach((_) => {
            this.queue.send(new ClaimMessage({ workerNo }));
          });
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
      this.queue.send(new WorkMessage({ url, referrer: '', depth: 1 }));
    });
  }

  private onQueueReady(callback: Function) {
    if (this.queueIsReady) {
      callback();
      return;
    }
    this.onQueueReadyHandlers.add(callback);
  }

}
