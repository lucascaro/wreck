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

import { DoneMessage, WorkPayload } from "@helpers/Message";
import { getNormalizedURL, isValidNormalizedURL } from "@helpers/url";
// tslint:disable-next-line:import-name
import fetch, { Response, Headers } from "node-fetch";
import * as cheerio from "cheerio";
import * as url from "url";
import * as util from "util";

const waitFor = util.promisify(setTimeout);

type RequestHelperParams = {
  debug: Function;
  CHILD_NO: number;
  REQUEST_TIMEOUT: number;
  MAX_CRAWL_DEPTH: number;
  EXCLUDE_URLS: RegExp[];
};

export default function requestHelper({
  debug,
  CHILD_NO,
  REQUEST_TIMEOUT,
  MAX_CRAWL_DEPTH,
  EXCLUDE_URLS
}: RequestHelperParams) {
  async function fetchURL(
    work: WorkPayload,
    method: string = "GET",
    retries: number
  ): Promise<DoneMessage> {
    // TODO: safer error handling for worker number
    const { workerNo = CHILD_NO } = work;
    try {
      const headers = new Headers({
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36"
      });
      const response = await fetch(work.url, {
        method: "GET",
        timeout: REQUEST_TIMEOUT,
        size: method === "HEAD" ? 0 : undefined
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
        neighbours: []
      });
    }
  }

  async function handleHTTPResponse(
    response: Response,
    work: WorkPayload,
    method: string = "GET",
    retries: number
  ): Promise<DoneMessage> {
    const { workerNo = CHILD_NO } = work;
    debug(`got response for ${work.url}: ${response.status}`);
    debug(response);

    const body = method === "GET" ? await response.text() : "";

    if (response.status === 429) {
      debug("429 response received, slowing down.");
      if (retries === 0) {
        throw new Error("Maximum retry count reached");
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
      neighbours: parseNeighbours(body, work.url)
    });
  }

  function getRetryAfterTimeout(
    response: Response,
    defaultValue: number
  ): number {
    if (response.headers && response.headers.has("retry-after")) {
      const retryAfter: string = response.headers.get("retry-after")!;
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

  function parseNeighbours(body: string, baseURL: string): string[] {
    if (body === "") {
      return [];
    }
    const $ = cheerio.load(body);
    const $links = $("[src],[href]");
    const urls = $links
      .toArray()
      .map(l => l.attribs["src"] || l.attribs["href"])
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
      return "HEAD";
    }

    if (EXCLUDE_URLS.some(p => p.test(work.url))) {
      debug(`excluding url ${work.url}`);
      return "HEAD";
    }

    // TODO: is the re a better way?
    // TODO: what if the server does not allow HEAD?
    const parsed = url.parse(work.url);
    const re = /\.(jpg|jpeg|svg|js|css|png|webp|)$/i;
    if (parsed.pathname && re.test(parsed.pathname)) {
      debug(`method = HEAD for ${parsed.pathname}`);
      return "HEAD";
    }

    // TODO: this should use a domain whitelist instead of
    // limiting to a single domain.
    const referrer = url.parse(work.referrer);
    const referrerHost = referrer.hostname || "";

    if (referrerHost !== "" && parsed.hostname !== referrerHost) {
      debug(`method = HEAD for ${parsed.hostname} from ${referrer}`);
      return "HEAD";
    }
    return "GET";
  }

  return Object.freeze({
    fetchURL,
    handleHTTPResponse,
    methodForURL,
    getRetryAfterTimeout,
    parseNeighbours
  });
}
