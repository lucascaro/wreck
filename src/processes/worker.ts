// tslint:disable-next-line:import-name
import fetch, { Response } from 'node-fetch';
import * as Debug from 'debug';
import * as cheerio from 'cheerio';
import * as url from 'url';
import {
  DoneMessage,
  ReadyMessage,
  WorkMessage,
  WorkPayload,
  messageFromJSON,
  MessageType,
} from '@helpers/Message';
import { normalizeURL } from '@helpers/url';
import Subprocess from '@helpers/Subprocess';
import { waitFor } from '../helpers/promise';

const CHILD_NO = process.env.WRECK_CHILD_NO;
const debug = Debug(`wreck:worker.${CHILD_NO}`);
const subprocess = new Subprocess(`worker.${CHILD_NO}`);

const NUM_RETRIES = subprocess.readEnvNumber('WRECK_NUM_RETRIES', 3);
const MAX_CRAWL_DEPTH = subprocess.readEnvNumber('WRECK_WORKER_MAX_DEPTH', Infinity);
const EXCLUDE_URLS = subprocess
  .readEnvArray<string>('WRECK_WORKER_EXCLUDE_URLS', [])
  .map(pattern => new RegExp(pattern));

debug('process started');
debug({
  CHILD_NO,
  NUM_RETRIES,
  MAX_CRAWL_DEPTH,
  EXCLUDE_URLS,
});

subprocess.addMessageListener(MessageType.WORK, (message: WorkMessage) => {
  debug('received work item');
  const work = message.payload;
  const method = methodForURL(work);
  debug(`crawling ${work.url} with ${method}`);
  fetchURL(work, method).then(subprocess.send);
});

async function fetchURL(
  work: WorkPayload,
  method: string = 'GET',
  retries: number = NUM_RETRIES,
): Promise<DoneMessage> {
  // TODO: safer error handling for worker number
  const workerNo = work.workerNo || Number(CHILD_NO) || 0;
  try {
    const response = await fetch(work.url, {
      method,
    });

    debug(`got response for ${work.url}: ${response.status}`);
    debug(response);

    const body = method === 'GET' ? await response.text() : '';

    if (response.status === 429) {
      debug('429 response received, slowing down.');
      if (retries === 0) {
        throw new Error('Maximum retry count reached');
      }
      const timeout = getRetryAfterTimeout(response, 30000);
      debug(`Waiting for ${timeout}.`);
      await waitFor(timeout);
      debug(`Retrying ${work.url} after ${timeout}.`);
      return fetchURL(work, method, retries - 1);
    }
    return new DoneMessage({
      workerNo,
      url: work.url,
      referrer: work.referrer,
      depth: work.depth,
      statusCode: response.status,
      success: response.ok,
      neighbours: parseNeighbours(body, work.url),
    });
  } catch (e) {
    debug(`Error fetching ${work.url}: ${e.message}`);
    return new DoneMessage({
      workerNo,
      url: work.url,
      referrer: work.referrer,
      depth: work.depth,
      statusCode: 0,
      success: false,
      neighbours: [],
    });
  }
}

function getRetryAfterTimeout(
  response: Response,
  defaultValue: number,
): number {
  if (response.headers && response.headers.has('retry-after')) {
    const retryAfter: string = response.headers.get('retry-after')!;
    const intTimeout = Number.parseInt(retryAfter, 10);
    if (!Number.isNaN(intTimeout)) {
      return intTimeout * 1000;
    }
    const dateTimeout = Date.parse(retryAfter);
  }

  return defaultValue;
}

function parseNeighbours(body: string, baseURL: string): string[] {
  if (body === '') {
    return [];
  }
  const $ = cheerio.load(body);
  const $links = $('[src],[href]');
  const urls = $links
    .toArray()
    .map(l => l.attribs['src'] || l.attribs['href'])
    .map(u => normalizeURL(u, baseURL));
  // TODO: what about images and fonts loaded from css?
  // TODO: does not understand images added via js.
  // TODO: phantomjs / jsdom plugins that can do this?
  return urls;
}

function methodForURL(work: WorkPayload) {
  if (work.depth > MAX_CRAWL_DEPTH) {
    return 'HEAD';
  }

  if (EXCLUDE_URLS.some(p => p.test(work.url))) {
    debug(`excluding url ${work.url}`);
    return 'HEAD';
  }

  // TODO: is the re a better way?
  // TODO: what if the server does not allow HEAD?
  const parsed = url.parse(work.url);
  const re = /\.(jpg|jpeg|svg|js|css|png|webp|)$/i;
  if (parsed.path && re.test(parsed.path)) {
    debug(`method = HEAD for ${parsed.path}`);
    return 'HEAD';
  }

  // TODO: this should use a domain whitelist instead of
  // limiting to a single domain.
  const referrer = url.parse(work.referrer);
  const referrerHost = referrer.hostname || '';

  if (referrerHost !== '' && parsed.hostname !== referrerHost) {
    debug(`method = HEAD for ${parsed.hostname} from ${referrer}`);
    return 'HEAD';
  }
  return 'GET';
}

subprocess.send(new ReadyMessage());
