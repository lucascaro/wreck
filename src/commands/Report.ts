// tslint:disable-next-line:import-name
import Commando from 'console-commando';
import { validateURLs } from '@helpers/url';
import Mediator from '@root/src/processes/Mediator';
import * as Debug from 'debug';
import { getURLsFromArgOrSTDIN, getArrayOption } from '@helpers/argument';
import output from '../helpers/output';
import { PersistentState } from '../helpers/PersistentState';
import { WorkPayload } from '../helpers/Message';

const debug = Debug('wreck:commands:report');

export default new Commando('report')
  .action(async (command: Commando) => {
    const fileName = command.getOption('state-file');
    const allURLs: Set<string> = new Set();
    const workQueue: Map<string, WorkPayload> = new Map();
    const results = await PersistentState.readState(allURLs, workQueue);
    output.normal(`Processed ${allURLs.size} URLs. ${workQueue.size} are pending.`);
    // TODO: report options.
    const successes = results.filter(r => r.success);
    const errors = results.filter(r => !r.success);
    const notFound = results.filter(r => r.statusCode === 404);

    // TODO: formatters
    results.forEach((result, i) => {
      output.verbose(
        '->',
        i,
        result.url,
        result.referrer,
        result.statusCode,
        result.success ? 'OK' : 'ERROR',
      );
    });

    output.normal(`Success: ${successes.length}`);
    output.normal(`Error: ${errors.length}`);
    output.normal(`NotFound: ${notFound.length}`);
  });
