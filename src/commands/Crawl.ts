// tslint:disable-next-line:import-name
import Commando from 'console-commando';
import * as fs from 'fs';
import { validateURLs, normalizeURL } from '@helpers/url';
import MainProcess from '@processes/MainProcess';
import * as Debug from 'debug';

const debug = Debug('wreck:commands:crarwl');

export default new Commando('crawl')
  .option('-u --url <URL>', 'Crawl starting from this URL')
  .option('-R --retries <number>', 'Maximum retries for a URL', 3)
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
  .option(
    '-n --no-resume',
    'Force the command to restart crawling from scratch, even if there is saved state.',
  )
  // .argument('<URL>', 'Crawl starting from this URL')

  // Default command action
  .action((command: Commando) => {
    const urlList: string[] = [];
    const argURL = command.getOption('url');
    if (argURL) {
      urlList.push(argURL);
      console.log(`Starting to crawl '${urlList}'`);
    } else {
      const input = fs.readFileSync(0, 'utf-8').toString();
      const lines = input
        .split('\n')
        .map(l => l.trim())
        .filter(l => l !== '');
      urlList.push(...lines);
    }
    const { valid, invalid } = validateURLs(urlList.map(u => normalizeURL(u)));
    debug({ valid, invalid });
    if (invalid.length > 0) {
      console.error('invalid urls:');
      console.error(invalid.join('\n'));
    }
    if (valid.length === 0) {
      console.error('Error: no valid urls found');
      process.exit();
    }
    debug('processing URLs:');
    debug(valid.join('\n'));
    const nWorkers = command.getOption('workers');
    const concurrency = command.getOption('concurrency');
    const rateLimit = command.getOption('rate-limit');
    const maxDepth = command.getOption('max-depth');
    let exclude = command.getOption('exclude');
    const noResume = command.getOption('no-resume');
    if (typeof exclude === 'string') {
      exclude = [exclude];
    } else {
      exclude = Array.from(exclude) as string[];
    }
    debug({ exclude });
    debug({ maxDepth });
    const p = new MainProcess({
      rateLimit,
      concurrency,
      nWorkers,
      maxDepth,
      exclude,
      noResume,
      initialURLs: valid,
    });
  });
