export const enum OutputLevel {
  SILENT = 0,
  NORMAL = 1,
  VERBOSE = 2,
}

let outputLevel = OutputLevel.NORMAL;
export default {

  setLevel(l: OutputLevel) {
    outputLevel = l;
  },

  write(...args: any) {
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
