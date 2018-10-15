// tslint:disable-next-line:import-name
import Commando from 'console-commando';
import Crawl from './Crawl';

// Use plain old require to get version string.
const { version } = require('@root/package.json');

export default new Commando('wreck')
  .description('Reliable and Efficient Web Crawler')
  .version(version)
  .command(Crawl);
