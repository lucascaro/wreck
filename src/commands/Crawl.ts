// tslint:disable-next-line:import-name
import Commando from 'console-commando';
import { validateURLs } from '@helpers/url';
import MainProcess from '@processes/MainProcess';
import * as Debug from 'debug';
import { getUrlsFromArgOrSTDIN, getArrayOption } from '@helpers/argument';
import output from '../helpers/output';

const debug = Debug('wreck:commands:crarwl');

export default new Commando('crawl')
  .option('-u --url <URL>', 'Crawl starting from this URL')
  .option('-R --retries <number>', 'Maximum retries for a URL', 3)
  .option('-t --timeout <number>', 'Maximum seconds to wait for requests', 1)
  .option('-m --max-requests <number>', 'Maximum request for this run.', Infinity)
  .option(
    '-n --no-resume',
    'Force the command to restart crawling from scratch, even if there is saved state.',
  )
  .option(
    '-w --workers <nWorkers>',
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
    '-c --concurrency <concurrency>',
    'How many requests can be active at the same time.',
    10,
  )
  .action((command: Commando) => {
    const urlList = getUrlsFromArgOrSTDIN(command.getOption('url'));
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
    new MainProcess({
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
