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

import { DoneMessage, MessageType, ReadyMessage, WorkMessage, WorkPayload } from '@helpers/Message';
import Subprocess from '@helpers/Subprocess';
import * as Debug from 'debug';
import requestHelper from '@root/src/helpers/requestHelper';

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
const request = requestHelper({
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
  request.fetchURL(work, method, NUM_RETRIES)
    .then(subprocess.send);
});

subprocess.send(new ReadyMessage());
