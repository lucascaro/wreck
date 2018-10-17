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
  ClaimMessage,
} from '@helpers/Message';

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

const workQueue: Map<string, WorkPayload> = new Map();
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

  if (message instanceof WorkMessage) {
    debug('received work item');
    debug(JSON.stringify(message.payload));
    enqueueURL(message.payload);
  } else if (message instanceof ClaimMessage) {
    // TODO: handle claim timeout
    debug('received work claim');
    debug(message.payload);
    pendingClaims.push(message.payload.workerNo);
  } else if (message instanceof DoneMessage) {
    debug('done with work item');
    debug(message.payload);
    finishedUrls += 1;
    markAsDone(message as DoneMessage, finishedUrls);
  } else {
    debug('unknown message type');
    debug(m);
  }

  fulfillPendingClaims();
});

function enqueueURL(payload: WorkPayload) {
  const url = payload.url;
  if (!allUrls.has(url)) {
    workQueue.set(url, payload);
    allUrls.add(url);
    console.log('+ adding url to queue:', url);
  }
}

function fulfillPendingClaims() {
  // TODO: rate limiting
  if (workQueue.size > 0 && pendingClaims.length > 0) {
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
  const pendingWorkItem = workClaims.get(result.url);
  if (pendingWorkItem) {
    pendingWorkItem.resolve();
  }
  workClaims.delete(message.payload.url);
  const neighbours = message.payload.neighbours;
  if (Array.isArray(neighbours)) {
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
