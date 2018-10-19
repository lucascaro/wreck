import { DoneMessage, WorkPayload } from '@helpers/Message';
import { getNormalizedURL, isValidNormalizedURL } from '@helpers/url';
// tslint:disable-next-line:import-name
import fetch, { Response } from 'node-fetch';
import * as url from 'url';
import { waitFor } from './promise';

type RequestHelperParams = {
  debug: Function,
  NUM_RETRIES: number,
  CHILD_NO: number,
  REQUEST_TIMEOUT: number,
  MAX_CRAWL_DEPTH: number,
  EXCLUDE_URLS: RegExp[],
};

export default function requestHelper({
  debug,
  NUM_RETRIES,
  CHILD_NO,
  REQUEST_TIMEOUT,
  MAX_CRAWL_DEPTH,
  EXCLUDE_URLS,
}: RequestHelperParams) {

  async function fetchURL(
    work: WorkPayload,
    method: string = 'GET',
    retries: number = NUM_RETRIES,
  ): Promise<DoneMessage > {
    // TODO: safer error handling for worker number
    const { workerNo = CHILD_NO } = work;
    try {
      const response = await fetch(work.url, {
        method,
        timeout: REQUEST_TIMEOUT,
      });

      return await handleHTTPResponse(response, work, method, retries);

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

  async function handleHTTPResponse(
    response: Response,
    work: WorkPayload,
    method: string = 'GET',
    retries: number = NUM_RETRIES,
  ): Promise<DoneMessage > {

    const { workerNo = CHILD_NO } = work;
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
      if (!Number.isNaN(dateTimeout)) {
        const dateDiff = dateTimeout - Date.now();
        if (dateDiff > 0) {
          return dateDiff;
        }
      }
    }

    return defaultValue;
  }

  function parseNeighbours(body: string, baseURL: string) : string[] {
    if (body === '') {
      return [];
    }
    const $ = cheerio.load(body);
    const $links = $('[src],[href]');
    const urls = $links
      .toArray()
      .map(l => l.attribs['src'] || l.attribs['href'])
      .map(u => getNormalizedURL(u, baseURL))
      .filter(u => isValidNormalizedURL(u))
      .map(String);
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

  return Object.freeze({
    fetchURL,
    handleHTTPResponse,
    methodForURL,
    getRetryAfterTimeout,
    parseNeighbours,
  });
}
