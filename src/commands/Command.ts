// tslint:disable-next-line:import-name
import Commando from 'console-commando';
import Crawl from './Crawl';
import output, { OutputLevel } from '../helpers/output';

// Use plain old require to get version string.
const { version } = require('@root/package.json');

export default new Commando('wreck')
  .description('Reliable and Efficient Web Crawler')
  .option('-v --verbose', 'Make operation more talkative.')
  .option('-s --silent', 'Make operation silent (Only errors and warnings will be shown).')
  .version(version)
  .command(Crawl)
  .before((command: Commando) => {
    if (command.getOption('verbose')) {
      output.setLevel(OutputLevel.VERBOSE);
    }
    if (command.getOption('quiet')) {
      output.setLevel(OutputLevel.SILENT);
    }
  });
