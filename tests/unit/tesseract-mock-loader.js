export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'tesseract.js') {
    return { shortCircuit: true, url: 'tesseract-mock://tesseract.js' };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'tesseract-mock://tesseract.js') {
    const source = `
const mockWorker = {
  recognize: async () => ({
    data: {
      text: "Hello World\\n",
      confidence: 95,
      words: [
        { text: "Hello", confidence: 97, bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
        { text: "World", confidence: 93, bbox: { x0: 55, y0: 0, x1: 100, y1: 20 } },
      ],
    },
  }),
  setParameters: async () => {},
  terminate: async () => {},
};

const mockScheduler = {
  addWorker: () => {},
  addJob: async (type, data) => ({
    data: {
      text: "Pool Result\\n",
      confidence: 90,
      words: [
        { text: "Pool", confidence: 92, bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } },
        { text: "Result", confidence: 88, bbox: { x0: 45, y0: 0, x1: 100, y1: 20 } },
      ],
    },
  }),
  terminate: () => {},
};

let _failCreateWorker = false;
let _failMultiLang = false;
let _createWorkerCallCount = 0;
let _missingCreateWorker = false;
let _createSchedulerMissing = false;

const mockTesseract = {
  get createWorker() {
    if (_missingCreateWorker) return undefined;
    return async (lang, oem, opts) => {
      _createWorkerCallCount++;
      if (_failCreateWorker) throw new Error("Worker creation failed");
      if (_failMultiLang && lang.includes("+")) throw new Error("Multi-lang failed");
      return { ...mockWorker };
    };
  },
  get createScheduler() {
    if (_createSchedulerMissing) return undefined;
    return () => ({ ...mockScheduler });
  },
};

export function __setFailCreateWorker(v) { _failCreateWorker = v; }
export function __setFailMultiLang(v) { _failMultiLang = v; }
export function __getCreateWorkerCallCount() { return _createWorkerCallCount; }
export function __resetCreateWorkerCallCount() { _createWorkerCallCount = 0; }
export function __setMissingCreateWorker(v) { _missingCreateWorker = v; }
export function __setCreateSchedulerMissing(v) { _createSchedulerMissing = v; }

const exp = { default: mockTesseract };
export default exp;
`;
    return { shortCircuit: true, format: 'module', source };
  }
  return nextLoad(url, context);
}
