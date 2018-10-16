import * as Debug from 'debug';
import { pRateLimit } from 'p-ratelimit';

import Subprocess from '@root/src/helpers/Subprocess';

import {
  MessageType,
  WorkMessage,
  WorkPayload,
  QueueEmptyMessage,
  DoneMessage,
  ReadyMessage,
  messageFromJSON,
} from '../helpers/Message';

const debug = Debug('wreck:queue');
const debugTick = Debug('wreck:queue:tick');

const subprocess = new Subprocess('queue');

debug('process started');

const RATE_LIMIT_RATE = subprocess.readEnvNumber('WRECK_RATE_LIMIT_RATE', 1);
const RATE_LIMIT_CONCURRENCY = subprocess.readEnvNumber(
  'WRECK_RATE_LIMIT_CONCURRENCY',
  1,
);

setInterval(() => {
  debugTick('---------------------TICK---------------------');
},          1000);
const rateLimitParameters = {
  interval: RATE_LIMIT_RATE < 100 ? 1000 / RATE_LIMIT_RATE : 1000,
  rate: RATE_LIMIT_RATE < 100 ? 1 : RATE_LIMIT_RATE,
  concurrency: RATE_LIMIT_CONCURRENCY,
  // maxDelay: 2000,
};

debugTick('rateLimitParameters:', rateLimitParameters);
const limit = pRateLimit(rateLimitParameters);

type PendingWorkItem = {
  url: string,
  resolve: (value?: void | PromiseLike<void> | undefined) => void,
  reject: (reason?: any) => void,
  payload: WorkPayload,
};

const workQueue: Set<string> = new Set();
const workClaims: Map<string, PendingWorkItem> = new Map();
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
  const message = messageFromJSON(m);

  switch (message.type) {
    case MessageType.WORK: {
      debug('received work item');
      debug(JSON.stringify(message.payload));
      enqueueURL(message.payload.url);
      break;
    }
    case MessageType.CLAIM: {
      // TODO: handle claim timeout
      debug('received work claim');
      debug(message.payload);
      pendingClaims.push(message.payload.workerNo);
      break;
    }
    case MessageType.DONE: {
      debug('done with work item');
      debug(message.payload);
      finishedUrls += 1;
      markAsDone(message as DoneMessage, finishedUrls);
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
    workQueue.delete(url);
    debugTick(`queue size: ${workQueue.size}`);
    debugTick(`active claims: ${workClaims.size}`);
    limit(() => {
      return new Promise<void>((resolve, reject)  => {
        debugTick(`in promise: ${url}`);
        const pendingWorkItem: PendingWorkItem = {
          url,
          resolve,
          reject,
          payload: {
            url,
            workerNo: claim,
          },
        };
        debug(`fulfilling claim: ${JSON.stringify(pendingWorkItem)}`);
        workClaims.set(url, pendingWorkItem);
        // TODO: concurrency requires handling WORK and DONE in a promise.
        subprocess.send(new WorkMessage(pendingWorkItem.payload));
        debug(`queue size: ${workQueue.size}`);
        debug(`pending claims: ${pendingClaims.length}`);
        debug(`active claims: ${workClaims.size}`);
        // resolve();
      })
      .then(() => {
        debug(`promise for ${url} resolved...`);
      })
      .catch((e) => {
        debug(`promise for ${url} rejected with ${JSON.stringify(e)}...`);
      });
    });
  }
}

function markAsDone(message: DoneMessage, finishedUrls: number) {
  const result = message.payload;

  // TODO: move to reporter
  console.log(
    '->',
    finishedUrls,
    result.url,
    result.statusCode,
    result.success ? 'OK' : 'ERROR',
  );
  const pendingWorkItem = workClaims.get(result.url);
  if (pendingWorkItem) {
    pendingWorkItem.resolve();
  }
  workClaims.delete(message.payload.url);
  const neighbours = message.payload.neighbours;
  if (Array.isArray(neighbours)) {
    neighbours.forEach((u) => {
      // TODO: even if not enqueued, the source url should be
      // marked as referrer for the neighbours.
      enqueueURL(u);
    });
  }
  if (workQueue.size === 0 && workClaims.size === 0) {
        // Queue is done!
    subprocess.send(new QueueEmptyMessage());
  }
}

subprocess.send(new ReadyMessage());

debug('started');
