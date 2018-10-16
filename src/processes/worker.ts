// tslint:disable-next-line:import-name
import fetch, { Response, FetchError } from 'node-fetch';
import * as Debug from 'debug';
import * as cheerio from 'cheerio';
import * as url from 'url';
import {
  DoneMessage,
  ReadyMessage,
  WorkMessage,
  WorkPayload,
  messageFromJSON,
} from '../helpers/Message';
import { fixStringURL } from '../helpers/url';
import Subprocess from '../helpers/Subprocess';

const CHILD_NO = process.env.WRECK_CHILD_NO;
const debug = Debug(`wreck:worker.${CHILD_NO}`);
const subprocess = new Subprocess(`worker.${CHILD_NO}`);

const NUM_RETRIES = subprocess.readEnvNumber('WRECK_NUM_RETRIES', 3);

// TODO: white list domains
let mainDomain = '';

debug('process started');

process.on('message', (m) => {
  debug('got message:', m);
  const message = messageFromJSON(m);
  if (message instanceof WorkMessage) {
    debug('received work item');
    debug(message.payload);
    const work = message.payload;
    if (mainDomain === '') {
      const parsed = url.parse(work.url);
      mainDomain = parsed.hostname || '';
    }
    const method = methodForURL(work.url, mainDomain);
    debug(`crawling ${work.url} with ${method}`);
    fetchURL(work, method).then(subprocess.send);
  }
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
    const body = await response.text();

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
      statusCode: response.status,
      success: response.ok,
      neighbours: parseNeighbours(body, work.url),
    });
  } catch (e) {
    debug(`Error fetching ${work.url}: ${e.message}`);
    return new DoneMessage({
      workerNo,
      url: work.url,
      statusCode: 0,
      success: false,
      neighbours: [],
    });
  }
}

function waitFor(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
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
  const $ = cheerio.load(body);
  const $links = $('[src],[href]');
  const urls = $links
    .toArray()
    .map(l => l.attribs['src'] || l.attribs['href'])
    .map(u => fixStringURL(u, baseURL));
  // TODO: what about images and fonts loaded from css?
  // TODO: does not understand images added via js.
  // TODO: phantomjs / jsdom plugins that can do this?
  return urls;
}

function methodForURL(u: string, referrer: string = '') {
  // TODO: is the re a better way?
  // TODO: what if the server does not allow HEAD?
  const parsed = url.parse(u);
  const re = /\.(jpg|jpeg|svg|js|css|png|webp|)$/i;
  if (parsed.path && re.test(parsed.path)) {
    debug(`method = HEAD for ${parsed.path}`);
    return 'HEAD';
  }
  // const parsedBase = url.parse(referrer);
  if (referrer !== '' && parsed.hostname !== referrer) {
    debug(`method = HEAD for ${parsed.hostname} from ${referrer}`);
    return 'HEAD';
  }
  return 'GET';
}

subprocess.send(new ReadyMessage());
