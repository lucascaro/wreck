export enum OutputLevel {
  SILENT = 0,
  NORMAL = 1,
  VERBOSE = 2,
}

let outputLevel = OutputLevel.NORMAL;
if (Object.prototype.hasOwnProperty.call(process.env, 'WRECK_OUTPUT_LEVEL')) {
  const savedLevel = Number(process.env.WRECK_OUTPUT_LEVEL);
  if (Object.values(OutputLevel).includes(savedLevel)) {
    outputLevel = savedLevel;
  }
}
export default {

  setLevel(l: OutputLevel) {
    outputLevel = l;
    process.env['WRECK_OUTPUT_LEVEL'] = String(l);
  },

  normal(...args: any) {
    if (outputLevel >= OutputLevel.NORMAL) {
      console.log(...args);
    }
  },

  warn(...args: any) {
    if (outputLevel >= OutputLevel.SILENT) {
      console.warn(...args);
    }
  },

  error(...args: any) {
    if (outputLevel >= OutputLevel.SILENT) {
      console.error(...args);
    }
  },

  verbose(...args: any) {
    if (outputLevel >= OutputLevel.VERBOSE) {
      console.log(...args);
    }
  },
};
