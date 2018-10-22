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
import Commando from 'console-commando';
import { validateURLs } from '@helpers/url';
import Mediator from '@root/src/processes/Mediator';
import * as Debug from 'debug';
import { getURLsFromArgOrSTDIN, getArrayOption } from '@helpers/argument';
import output from '../helpers/output';

const debug = Debug('wreck:commands:crarwl');

export default new Commando('crawl')
  .option('-u --url <URL>', 'Crawl starting from this URL')
  .option('-R --retries <number>', 'Maximum retries for a URL', 3)
  .option('-t --timeout <number>', 'Maximum milliseconds to wait for requests', 1000)
  .option('-m --max-requests <number>', 'Maximum request for this run.', Infinity)
  .option(
    '-n --no-resume',
    'Force the command to restart crawling from scratch, even if there is saved state.',
  )
  .option(
    '-w --workers <number>',
    'Start this many workers. Defaults to one per CPU.',
  )
  .option('-d --max-depth <number>', 'Maximum link depth to crawl.')
  .option(
    '-r --rate-limit <number>',
    'Number of requests that will be made per second.',
  )
  .option(
    '-e --exclude <regex>',
    'Do now crawl URLs that match this regex. Can be specified multiple times.',
    [],
  )
  .option(
    '-c --concurrency <number>',
    'How many requests can be active at the same time.',
    100,
  )
  .action((command: Commando) => {
    const urlList = getURLsFromArgOrSTDIN(command.getOption('url'));
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
      exclude: getArrayOption(command.getOption('exclude')),
      timeout: command.getOption('timeout'),
      maxDepth: command.getOption('max-depth'),
      nWorkers: command.getOption('workers'),
      noResume: command.getOption('no-resume'),
      rateLimit: command.getOption('rate-limit'),
      concurrency: command.getOption('concurrency'),
      maxRequests: command.getOption('max-requests'),
      // .map(u => normalizeURL(u)),
      initialURLs: valid.map(String),
    })
    .start();
  });
