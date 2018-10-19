import { DoneMessage, MessageType, ReadyMessage, WorkMessage, WorkPayload } from '@helpers/Message';
import Subprocess from '@helpers/Subprocess';
import { getNormalizedURL, isValidNormalizedURL } from '@helpers/url';
import * as cheerio from 'cheerio';
import * as Debug from 'debug';
import * as url from 'url';
import { waitFor } from '../helpers/promise';
import RequestHelper from '@root/src/helpers/RequestHelper';

const CHILD_NO = process.env.WRECK_CHILD_NO;
const debug = Debug(`wreck:worker.${CHILD_NO}`);
const subprocess = new Subprocess(`worker.${CHILD_NO}`);

const NUM_RETRIES = subprocess.readEnvNumber('WRECK_NUM_RETRIES', 3);
const MAX_CRAWL_DEPTH = subprocess.readEnvNumber('WRECK_WORKER_MAX_DEPTH', Infinity);
const REQUEST_TIMEOUT = subprocess.readEnvNumber('WRECK_WORKER_REQUEST_TIMEOUT', 5000);
const EXCLUDE_URLS = subprocess
.readEnvArray<string>('WRECK_WORKER_EXCLUDE_URLS', [])
.map(pattern => new RegExp(pattern));

debug('process started');
debug({
  CHILD_NO,
  NUM_RETRIES,
  MAX_CRAWL_DEPTH,
  EXCLUDE_URLS,
  REQUEST_TIMEOUT,
});
const request = RequestHelper({
  NUM_RETRIES,
  MAX_CRAWL_DEPTH,
  EXCLUDE_URLS,
  REQUEST_TIMEOUT,
  CHILD_NO: Number(CHILD_NO) || -1,
  debug: Debug(`wreck:worker.${CHILD_NO}`),
});

subprocess.addMessageListener(MessageType.WORK, (message: WorkMessage) => {
  debug('received work item');
  const work = message.payload;
  const method = request.methodForURL(work);
  debug(`crawling ${work.url} with ${method}`);
  request.fetchURL(work, method).then(subprocess.send);
});

subprocess.send(new ReadyMessage());
