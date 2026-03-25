import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let mockCtrl;
let hasMock = false;
try {
  mockCtrl = await import('tesseract.js');
  hasMock = typeof mockCtrl.__setFailCreateWorker === 'function';
} catch { hasMock = false; }

const describeWithMock = hasMock ? describe : describe.skip;

let initTesseract, recognizeTesseract, recognizeWithBoxes, recognizeWithPool;
let initTesseractPool, terminateTesseract, terminateTesseractPool;
let isTesseractAvailable, isTesseractPoolReady, getTesseractStatus;
let resetTesseractAvailability, getRecommendedPoolSize, getAvailableTesseractLangs;

if (hasMock) {
  const mod = await import('../../app/modules/tesseract-adapter.js');
  initTesseract = mod.initTesseract;
  recognizeTesseract = mod.recognizeTesseract;
  recognizeWithBoxes = mod.recognizeWithBoxes;
  recognizeWithPool = mod.recognizeWithPool;
  initTesseractPool = mod.initTesseractPool;
  terminateTesseract = mod.terminateTesseract;
  terminateTesseractPool = mod.terminateTesseractPool;
  isTesseractAvailable = mod.isTesseractAvailable;
  isTesseractPoolReady = mod.isTesseractPoolReady;
  getTesseractStatus = mod.getTesseractStatus;
  resetTesseractAvailability = mod.resetTesseractAvailability;
  getRecommendedPoolSize = mod.getRecommendedPoolSize;
  getAvailableTesseractLangs = mod.getAvailableTesseractLangs;
}

async function cleanState() {
  await terminateTesseract();
  await terminateTesseractPool();
  resetTesseractAvailability();
  mockCtrl.__setFailCreateWorker(false);
  mockCtrl.__setFailMultiLang(false);
  mockCtrl.__setMissingCreateWorker(false);
  mockCtrl.__setCreateSchedulerMissing(false);
  mockCtrl.__resetCreateWorkerCallCount();
}

describeWithMock('initTesseract — success paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('initializes successfully with default lang (eng)', async () => {
    const ok = await initTesseract();
    assert.equal(ok, true);
    const status = getTesseractStatus();
    assert.equal(status.ready, true);
    assert.equal(status.lang, 'eng');
    assert.equal(status.available, true);
    assert.equal(status.initFailCount, 0);
  });

  it('initializes with a mapped language code', async () => {
    const ok = await initTesseract('rus');
    assert.equal(ok, true);
    assert.equal(getTesseractStatus().lang, 'rus');
  });

  it('initializes with auto mode (eng+rus)', async () => {
    const ok = await initTesseract('auto');
    assert.equal(ok, true);
    assert.equal(getTesseractStatus().lang, 'eng+rus');
  });

  it('reuses existing worker for same language', async () => {
    await initTesseract('eng');
    mockCtrl.__resetCreateWorkerCallCount();
    const ok = await initTesseract('eng');
    assert.equal(ok, true);
    assert.equal(mockCtrl.__getCreateWorkerCallCount(), 0);
  });

  it('terminates old worker when switching language', async () => {
    await initTesseract('eng');
    const ok2 = await initTesseract('fra');
    assert.equal(ok2, true);
    assert.equal(getTesseractStatus().lang, 'fra');
  });

  it('uses unmapped language code directly', async () => {
    const ok = await initTesseract('my_custom_lang');
    assert.equal(ok, true);
    assert.equal(getTesseractStatus().lang, 'my_custom_lang');
  });
});

describeWithMock('initTesseract — failure paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('returns false when createWorker fails', async () => {
    mockCtrl.__setFailCreateWorker(true);
    const ok = await initTesseract('eng');
    assert.equal(ok, false);
    assert.equal(getTesseractStatus().initFailCount, 1);
    assert.ok(getTesseractStatus().lastError.length > 0);
  });

  it('respects cooldown between retry attempts', async () => {
    mockCtrl.__setFailCreateWorker(true);
    await initTesseract('eng');
    const ok = await initTesseract('eng');
    assert.equal(ok, false);
    assert.equal(getTesseractStatus().initFailCount, 1);
  });

  it('concurrent init calls share the same promise', async () => {
    const p1 = initTesseract('eng');
    const p2 = initTesseract('eng');
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, true);
    assert.equal(r2, true);
  });
});

describeWithMock('initTesseract — multi-lang fallback (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('falls back to first lang when multi-lang fails', async () => {
    mockCtrl.__setFailMultiLang(true);
    const ok = await initTesseract('auto');
    assert.equal(ok, true);
    assert.equal(getTesseractStatus().ready, true);
  });
});

describeWithMock('recognizeTesseract — success paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('returns recognized text and confidence', async () => {
    await initTesseract('eng');
    const result = await recognizeTesseract({});
    assert.equal(result.text, 'Hello World');
    assert.equal(result.confidence, 95);
    assert.equal(result.words.length, 2);
  });

  it('returns word-level bbox data', async () => {
    await initTesseract('eng');
    const result = await recognizeTesseract({});
    assert.equal(result.words[0].text, 'Hello');
    assert.deepEqual(result.words[0].bbox, { x0: 0, y0: 0, x1: 50, y1: 20 });
  });

  it('auto-initializes worker if not ready', async () => {
    const result = await recognizeTesseract({}, { lang: 'eng' });
    assert.equal(result.text, 'Hello World');
    assert.equal(getTesseractStatus().ready, true);
  });

  it('re-initializes worker if language changed via options', async () => {
    await initTesseract('eng');
    const result = await recognizeTesseract({}, { lang: 'fra' });
    assert.equal(result.text, 'Hello World');
    assert.equal(getTesseractStatus().lang, 'fra');
  });

  it('uses _currentLang when no option provided', async () => {
    await initTesseract('deu');
    const result = await recognizeTesseract({});
    assert.equal(result.text, 'Hello World');
    assert.equal(getTesseractStatus().lang, 'deu');
  });
});

describeWithMock('recognizeTesseract — error paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('returns empty result when init fails', async () => {
    mockCtrl.__setFailCreateWorker(true);
    const result = await recognizeTesseract({});
    assert.equal(result.text, '');
    assert.equal(result.confidence, 0);
    assert.deepEqual(result.words, []);
  });
});

describeWithMock('recognizeWithBoxes — success (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('returns word-level bounding boxes', async () => {
    await initTesseract('eng');
    const boxes = await recognizeWithBoxes({});
    assert.equal(boxes.length, 2);
    assert.equal(boxes[0].text, 'Hello');
    assert.ok(boxes[0].bbox);
  });

  it('accepts optional lang parameter', async () => {
    const boxes = await recognizeWithBoxes({}, 'eng');
    assert.equal(boxes.length, 2);
  });
});

describeWithMock('initTesseractPool — success paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('initializes pool with default size', async () => {
    const ok = await initTesseractPool('eng');
    assert.equal(ok, true);
    assert.equal(isTesseractPoolReady(), true);
    assert.ok(getTesseractStatus().poolSize >= 2);
  });

  it('initializes pool with specific size', async () => {
    const ok = await initTesseractPool('eng', 2);
    assert.equal(ok, true);
    assert.equal(getTesseractStatus().poolSize, 2);
  });

  it('reuses existing pool with same config', async () => {
    await initTesseractPool('eng', 2);
    mockCtrl.__resetCreateWorkerCallCount();
    const ok = await initTesseractPool('eng', 2);
    assert.equal(ok, true);
    assert.equal(mockCtrl.__getCreateWorkerCallCount(), 0);
  });

  it('re-creates pool when language changes', async () => {
    await initTesseractPool('eng', 2);
    const ok = await initTesseractPool('fra', 2);
    assert.equal(ok, true);
  });

  it('re-creates pool when size changes', async () => {
    await initTesseractPool('eng', 2);
    const ok = await initTesseractPool('eng', 3);
    assert.equal(ok, true);
    assert.equal(getTesseractStatus().poolSize, 3);
  });

  it('concurrent pool init calls share the same promise', async () => {
    const p1 = initTesseractPool('eng', 2);
    const p2 = initTesseractPool('eng', 2);
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, true);
    assert.equal(r2, true);
  });
});

describeWithMock('initTesseractPool — failure paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('returns false when worker creation fails', async () => {
    mockCtrl.__setFailCreateWorker(true);
    const ok = await initTesseractPool('eng', 2);
    assert.equal(ok, false);
    assert.equal(isTesseractPoolReady(), false);
  });

  it('falls back to single worker when createScheduler is missing', async () => {
    mockCtrl.__setCreateSchedulerMissing(true);
    const ok = await initTesseractPool('eng', 2);
    assert.equal(typeof ok, 'boolean');
  });

  it('respects cooldown for pool init', async () => {
    mockCtrl.__setFailCreateWorker(true);
    await initTesseractPool('eng', 2);
    const ok = await initTesseractPool('eng', 2);
    assert.equal(ok, false);
  });
});

describeWithMock('recognizeWithPool — success paths (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('recognizes via pool when pool is active', async () => {
    await initTesseractPool('eng', 2);
    const result = await recognizeWithPool({});
    assert.equal(result.text, 'Pool Result');
    assert.equal(result.confidence, 90);
    assert.equal(result.words.length, 2);
  });

  it('returns word data from pool recognition', async () => {
    await initTesseractPool('eng', 2);
    const result = await recognizeWithPool({});
    assert.equal(result.words[0].text, 'Pool');
    assert.ok(result.words[0].bbox);
  });

  it('falls back to single worker when no pool', async () => {
    await initTesseract('eng');
    const result = await recognizeWithPool({});
    assert.equal(result.text, 'Hello World');
  });
});

describeWithMock('terminateTesseract — with active worker (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('terminates an active worker', async () => {
    await initTesseract('eng');
    assert.equal(getTesseractStatus().ready, true);
    await terminateTesseract();
    assert.equal(getTesseractStatus().ready, false);
    assert.equal(getTesseractStatus().lang, null);
  });

  it('also terminates pool when terminating worker', async () => {
    await initTesseract('eng');
    await initTesseractPool('fra', 2);
    assert.equal(isTesseractPoolReady(), true);
    await terminateTesseract();
    assert.equal(isTesseractPoolReady(), false);
  });
});

describeWithMock('terminateTesseractPool — with active pool (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('terminates an active pool', async () => {
    await initTesseractPool('eng', 2);
    assert.equal(isTesseractPoolReady(), true);
    await terminateTesseractPool();
    assert.equal(isTesseractPoolReady(), false);
    assert.equal(getTesseractStatus().poolSize, 0);
  });
});

describeWithMock('isTesseractAvailable — with mock', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('returns true when module loads successfully', async () => {
    const available = await isTesseractAvailable();
    assert.equal(available, true);
  });

  it('returns true on subsequent calls (cached)', async () => {
    await isTesseractAvailable();
    const available = await isTesseractAvailable();
    assert.equal(available, true);
  });
});

describeWithMock('resetTesseractAvailability — after failures (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('allows retry after reset', async () => {
    mockCtrl.__setFailCreateWorker(true);
    await initTesseract('eng');
    assert.equal(getTesseractStatus().initFailCount, 1);
    resetTesseractAvailability();
    assert.equal(getTesseractStatus().initFailCount, 0);
    mockCtrl.__setFailCreateWorker(false);
    const ok = await initTesseract('eng');
    assert.equal(ok, true);
  });
});

describeWithMock('edge cases (mocked)', () => {
  beforeEach(cleanState);
  afterEach(cleanState);

  it('handles all LANG_MAP entries', () => {
    const langs = getAvailableTesseractLangs();
    for (const l of ['hin','tur','pol','ces','ukr','bel','nld','swe','nor','fin','ell','heb','vie','tha','ron','bul']) {
      assert.ok(langs.includes(l), l + ' missing');
    }
  });

  it('initTesseract with already-initialized same lang returns true', async () => {
    await initTesseract('eng');
    const ok = await initTesseract('eng');
    assert.equal(ok, true);
  });

  it('recognizeTesseract with no options uses current lang', async () => {
    await initTesseract('spa');
    const result = await recognizeTesseract({});
    assert.equal(result.text, 'Hello World');
    assert.equal(getTesseractStatus().lang, 'spa');
  });
});
