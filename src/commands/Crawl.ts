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

// tslint:disable-next-line:import-name
import {
  command,
  Command,
  stringOption,
  numericOption,
  multiStringOption,
  flag,
} from 'console-commando';
import { validateURLs } from '@helpers/url';
import Mediator from '@root/src/processes/Mediator';
import * as Debug from 'debug';
import { getURLsFromArgOrSTDIN, getArrayOption } from '@helpers/argument';
import output from '../helpers/output';

const debug = Debug('wreck:commands:crarwl');

export default command('crawl')
  .withDescription('Start or continue crawling')
  .withOption(stringOption('url', 'u', 'Crawl starting from this URL'))
  .withOption(numericOption('retries', 'R', 'Maximum retries for a URL', 3))
  .withOption(numericOption('timeout', 't', 'Maximum milliseconds to wait for requests', 1000))
  .withOption(numericOption('max-depth', 'd',  'Maximum link depth to crawl.'))
  .withOption(numericOption('workers', 'w', 'Start this many workers. Defaults to one per CPU.'))
  .withOption(numericOption('rate-limit', 'r', 'Number of requests that will be made per second.'))
  .withOption(numericOption('max-requests', 'm', 'Maximum request for this run.', Infinity))
  .withOption(multiStringOption(
    'exclude',
    'e',
    'Do now recurse into URLs that match this regex. Can be specified multiple times.',
  ))
  .withOption(numericOption('concurrency', 'c', 'Maximum concurrent requests.', 100))
  .withOption(flag('no-resume', 'n', 'Delete saved state before crawling.'))
  .withOption(flag('retry-failed', 'F', 'Retry URLs that previously failed.'))
  .withHandler((command: Command) => {
    const urlList = getURLsFromArgOrSTDIN(command.getStringOption('url'));
    const { valid, invalid } = validateURLs(urlList);
    debug({ valid, invalid });
    if (invalid.length > 0) {
      output.warn('invalid URLs:');
      output.warn(invalid.join('\n'));
    }
    if (valid.length === 0) {
      output.error('Error: no valid urls found');
      process.exit(1);
    }
    output.verbose('processing URLs:');
    output.verbose(valid.join('\n'));
    new Mediator({
      exclude: getArrayOption(command.getMultiStringOption('exclude')),
      timeout: command.getNumericOption('timeout'),
      maxDepth: command.getNumericOption('max-depth'),
      nRetries: command.getNumericOption('retries'),
      nWorkers: command.getNumericOption('workers'),
      noResume: command.getFlag('no-resume'),
      rateLimit: command.getNumericOption('rate-limit'),
      concurrency: command.getNumericOption('concurrency'),
      maxRequests: command.getNumericOption('max-requests'),
      retryFailed: command.getFlag('retry-failed'),
      initialURLs: valid.map(String),
    })
    .start();
  });
