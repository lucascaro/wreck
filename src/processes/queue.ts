import * as Debug from 'debug';
import{ pRateLimit } from 'p-ratelimit';

import {
  MessageType,
  WorkMessage,
  WorkPayload,
  QueueEmptyMessage,
  DoneMessage,
} from '../helpers/Message';

const debug = Debug('wreck:queue');

if (!process.send) {
  throw new Error('This module should be spawned as a fork');
}
const send = (msg: any) => (process.send ? process.send(msg) : null);

debug('Queue process started');

process.on('SIGINT', () => {
  debug('exiting');
  // process.exit();
});

const RATE_LIMIT_RATE = Number(process.env.WRECK_RATE_LIMIT_RATE) || 1;
const RATE_LIMIT_CONCURRENCY = Number(process.env.WRECK_RATE_LIMIT_CONCURRENCY) || 1;

const rateLimitParameters = {
  interval: 1000 / RATE_LIMIT_RATE,
  rate: 1,
  concurrency: RATE_LIMIT_CONCURRENCY,
  // maxDelay: 2000,
};
debug('rateLimitParameters:', rateLimitParameters);
const limit = pRateLimit(rateLimitParameters);

const workQueue: Set<string> = new Set();
const workClaims: Map<string, WorkPayload> = new Map();
const pendingClaims: number[] = [];
const allUrls: Set<string> = new Set();
let finishedUrls: number = 0;

process.on('message', (m) => {
  debug('got message:', m);
  if (!m.type || typeof m.type !== 'string') {
    debug('missing message type');
    debug(m);
    return;
  }

  switch (m.type) {
    case MessageType.WORK: {
      debug('received work item');
      // TODO: use factory?
      const message = new WorkMessage(m.payload);
      debug(JSON.stringify(message.payload));
      enqueueURL(message.payload.url);
      break;
    }
    case MessageType.CLAIM: {
      // TODO: handle claim timeout
      debug('received work claim');
      debug(m.payload);
      pendingClaims.push(m.payload.workerNo);
      break;
    }
    case MessageType.DONE: {
      debug('done with work item');
      debug(m.payload);
      const message = new DoneMessage(m.payload);
      const result = message.payload;
      finishedUrls += 1;
      console.log(
        '->',
        finishedUrls,
        result.url,
        result.statusCode,
        result.success ? 'OK' : 'ERROR',
      );
      workClaims.delete(m.payload.url);
      const neighbours = m.payload.neighbours;
      if (Array.isArray(neighbours)) {
        neighbours.forEach((u) => {
          // TODO: even if not enqueued, the source url should be
          // marked as referrer for the neighbours.
          enqueueURL(u);
        });
      }
      if (
        workQueue.size === 0
        && workClaims.size === 0
      ) {
        // Queue is done!
        send(new QueueEmptyMessage());
      }
      break;
    }
    default: {
      debug('unknown message type');
      debug(m);
    }
  }
  fulfillPendingClaims();
});

function enqueueURL(url: string) {
  if (!allUrls.has(url)) {
    workQueue.add(url);
    allUrls.add(url);
    console.log('+ adding url to queue:', url);
  }
}

function fulfillPendingClaims() {
  // TODO: rate limiting
  if (workQueue.size > 0 && pendingClaims.length > 0) {
    const url = workQueue.values().next().value;
    debug(`claims: ${pendingClaims}`);
    const claim = pendingClaims.shift();
    const payload: WorkPayload = {
      url,
      workerNo: claim,
    };

    workQueue.delete(url);
    workClaims.set(url, payload);

    debug(`fulfilling claim: ${JSON.stringify(payload)}`);
    limit(() => {
      // TODO: concurrency requires handling WORK and DONE in a promise.
      send(new WorkMessage(payload));
      return Promise.resolve();
    });
  }
  debug(`queue size: ${workQueue.size}`);
  debug(`pending claims: ${pendingClaims.length}`);
  debug(`active claims: ${workClaims.size}`);
}

send({ type: 'ready' });

debug('started');
