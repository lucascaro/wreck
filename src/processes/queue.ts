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
  ClaimMessage,
} from '@helpers/Message';
import { PersistentState } from '../helpers/PersistentState';

const debug = Debug('wreck:queue');
const debugTick = Debug('wreck:queue:tick');

const subprocess = new Subprocess('queue');

// TODO: if no limit is specified, there should be no rate limit.
const RATE_LIMIT_RATE = subprocess.readEnvNumber('WRECK_RATE_LIMIT_RATE', Infinity);
const MAX_REQUESTS = subprocess.readEnvNumber('WRECK_QUEUE_MAX_REQUESTS', Infinity);
const RATE_LIMIT_CONCURRENCY = subprocess.readEnvNumber(
  'WRECK_RATE_LIMIT_CONCURRENCY',
  Infinity,
);

debug('process started');
debug({
  RATE_LIMIT_RATE,
  MAX_REQUESTS,
  RATE_LIMIT_CONCURRENCY,
});

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
const shouldLimit = RATE_LIMIT_RATE !== Infinity || RATE_LIMIT_CONCURRENCY !== Infinity;
const limit = shouldLimit ?
  pRateLimit(rateLimitParameters) :
  <T>(f: (() => Promise<T>)) => f();

type PendingWorkItem = {
  url: string,
  resolve: (value?: void | PromiseLike<void> | undefined) => void,
  reject: (reason?: any) => void,
  payload: WorkPayload,
};

const workQueue: Map<string, WorkPayload> = new Map();
const workClaims: Map<string, PendingWorkItem> = new Map();
const pendingClaims: number[] = [];
const allUrls: Set<string> = new Set();

debug('Attempting to restore previous state...');
PersistentState.readState(allUrls, workQueue)
.then(startQueue);

function startQueue() {
  let finishedUrls = allUrls.size - workQueue.size;
  let fulfilledClaims = 0;

  debug(
    `read ${allUrls.size} total and ${workQueue.size} pending URLs -- ${finishedUrls} are done`,
  );

  subprocess.addMessageListener(MessageType.WORK, (message: WorkMessage) => {
    debug('received work item');
    enqueueURL(message.payload);
    // TODO: add a way to call this function after any messages?
    fulfillPendingClaims();
  });

  subprocess.addMessageListener(MessageType.CLAIM, (message: ClaimMessage) => {
    debug('received work claim');
    pendingClaims.push(message.payload.workerNo);
    fulfillPendingClaims();
  });

  subprocess.addMessageListener(MessageType.DONE, (message: DoneMessage) => {
    debug('done with work item');
    finishedUrls += 1;
    markAsDone(message as DoneMessage, finishedUrls);
  });

  function enqueueURL(payload: WorkPayload) {
    const url = payload.url;
    if (!allUrls.has(url)) {
      if (fulfilledClaims >= MAX_REQUESTS) {
        debug('Maximum requests reached. Rejecting new work.');
        return;
      }
      workQueue.set(url, payload);
      allUrls.add(url);
      console.log('+ adding url to queue:', url);
    }
  }

  function fulfillPendingClaims() {
    // TODO: handle claim timeout
    while (workQueue.size > 0 && pendingClaims.length > 0) {
      const workPayload = workQueue.values().next().value;
      const url = workPayload.url;
      const referrer = workPayload.referrer;
      const depth = workPayload.depth;
      debug(`claims: ${pendingClaims}`);
      const claim = pendingClaims.shift();
      workQueue.delete(url);
      debugTick(`queue size: ${workQueue.size}`);
      debugTick(`active claims: ${workClaims.size}`);
      limit(() => {
        return new Promise<void>((resolve, reject)  => {
          debugTick(`in promise: ${url}`);
          if (fulfilledClaims >= MAX_REQUESTS) {
            reject();
            return;
          }
          const pendingWorkItem: PendingWorkItem = {
            url,
            resolve,
            reject,
            payload: {
              url,
              referrer,
              depth,
              workerNo: claim,
            },
          };
          debug(`fulfilling claim: ${JSON.stringify(pendingWorkItem)}`);
          workClaims.set(url, pendingWorkItem);
          // TODO: concurrency requires handling WORK and DONE in a promise.
          subprocess.send(new WorkMessage(pendingWorkItem.payload));
          fulfilledClaims += 1;
          if (fulfilledClaims >= MAX_REQUESTS) {
            debug('maximum requests reached, emptying work queue.');
            workQueue.clear();
          }
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
      result.referrer,
      result.statusCode,
      result.success ? 'OK' : 'ERROR',
    );
    PersistentState.write(`${JSON.stringify(result)}\n`);
    const pendingWorkItem = workClaims.get(result.url);
    if (pendingWorkItem) {
      pendingWorkItem.resolve();
    }
    workClaims.delete(message.payload.url);
    const neighbours = message.payload.neighbours;
    if (fulfilledClaims < MAX_REQUESTS && Array.isArray(neighbours)) {
      neighbours.forEach((u) => {
        const payload: WorkPayload = {
          url: u,
          referrer: result.url,
          depth: result.depth + 1,
        };
        enqueueURL(payload);
      });
    }
    if (workQueue.size === 0 && workClaims.size === 0) {
          // Queue is done!
      subprocess.send(new QueueEmptyMessage());
    }
  }

  subprocess.send(new ReadyMessage());

  debug('started');
}
