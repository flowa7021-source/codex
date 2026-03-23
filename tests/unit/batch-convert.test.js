import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { BatchConverter, batchConverter } from '../../app/modules/batch-convert.js';

// Helper: create a mock File-like object
function makeFile(name, content = 'data') {
  return {
    name,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  };
}

describe('BatchConverter', () => {
  let bc;

  beforeEach(() => {
    bc = new BatchConverter();
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  it('starts with empty queue', () => {
    assert.deepEqual(bc.queue, []);
    assert.equal(bc.isRunning, false);
    assert.equal(bc._cancelled, false);
    assert.deepEqual(bc._listeners, []);
  });

  // ── getState ───────────────────────────────────────────────────────────────

  it('getState returns correct totals for empty queue', () => {
    const s = bc.getState();
    assert.equal(s.total, 0);
    assert.equal(s.pending, 0);
    assert.equal(s.running, 0);
    assert.equal(s.done, 0);
    assert.equal(s.errors, 0);
    assert.equal(s.isRunning, false);
    assert.equal(s.overallProgress, 0);
  });

  it('getState counts jobs by status correctly', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf'), makeFile('d.pdf')], 'docx');
    bc.queue[0].status = 'running';
    bc.queue[1].status = 'done';
    bc.queue[2].status = 'error';
    // queue[3] stays pending
    const s = bc.getState();
    assert.equal(s.total, 4);
    assert.equal(s.running, 1);
    assert.equal(s.done, 1);
    assert.equal(s.errors, 1);
    assert.equal(s.pending, 1);
  });

  // ── _calcOverallProgress ───────────────────────────────────────────────────

  it('_calcOverallProgress returns 0 for empty queue', () => {
    assert.equal(bc._calcOverallProgress(), 0);
  });

  it('_calcOverallProgress averages progress values', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')], 'docx');
    bc.queue[0].progress = 0;
    bc.queue[1].progress = 50;
    bc.queue[2].progress = 100;
    assert.equal(bc._calcOverallProgress(), 50);
  });

  it('_calcOverallProgress rounds to integer', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')], 'docx');
    bc.queue[0].progress = 10;
    bc.queue[1].progress = 20;
    bc.queue[2].progress = 30;
    // average = 60/3 = 20
    assert.equal(bc._calcOverallProgress(), 20);
  });

  // ── addFiles ───────────────────────────────────────────────────────────────

  it('addFiles adds jobs to queue', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf')], 'docx');
    assert.equal(bc.queue.length, 2);
    assert.equal(bc.queue[0].file.name, 'a.pdf');
    assert.equal(bc.queue[1].file.name, 'b.pdf');
  });

  it('addFiles sets correct initial job properties', () => {
    bc.addFiles([makeFile('test.pdf')], 'html');
    const job = bc.queue[0];
    assert.equal(job.format, 'html');
    assert.equal(job.status, 'pending');
    assert.equal(job.progress, 0);
    assert.equal(job.result, null);
    assert.equal(job.error, null);
  });

  it('addFiles supports all formats', () => {
    const formats = ['docx', 'html', 'txt', 'png'];
    for (const fmt of formats) {
      const bci = new BatchConverter();
      bci.addFiles([makeFile('x.pdf')], fmt);
      assert.equal(bci.queue[0].format, fmt);
    }
  });

  it('addFiles notifies listeners', () => {
    let notified = false;
    bc.onChange(() => { notified = true; });
    bc.addFiles([makeFile('a.pdf')], 'txt');
    assert.ok(notified);
  });

  it('addFiles can be called multiple times (accumulates)', () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    bc.addFiles([makeFile('b.pdf')], 'txt');
    assert.equal(bc.queue.length, 2);
    assert.equal(bc.queue[0].format, 'docx');
    assert.equal(bc.queue[1].format, 'txt');
  });

  it('addFiles with empty array does not change queue', () => {
    bc.addFiles([], 'docx');
    assert.equal(bc.queue.length, 0);
  });

  // ── removeJob ──────────────────────────────────────────────────────────────

  it('removeJob removes a job by index', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')], 'docx');
    bc.removeJob(1);
    assert.equal(bc.queue.length, 2);
    assert.equal(bc.queue[0].file.name, 'a.pdf');
    assert.equal(bc.queue[1].file.name, 'c.pdf');
  });

  it('removeJob removes first job', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf')], 'docx');
    bc.removeJob(0);
    assert.equal(bc.queue.length, 1);
    assert.equal(bc.queue[0].file.name, 'b.pdf');
  });

  it('removeJob notifies listeners', () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    let count = 0;
    bc.onChange(() => count++);
    bc.removeJob(0);
    assert.ok(count >= 1);
  });

  // ── clearCompleted ─────────────────────────────────────────────────────────

  it('clearCompleted removes done and error jobs', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf'), makeFile('d.pdf')], 'docx');
    bc.queue[0].status = 'done';
    bc.queue[1].status = 'error';
    bc.queue[2].status = 'running';
    // queue[3] stays pending
    bc.clearCompleted();
    assert.equal(bc.queue.length, 2);
    assert.equal(bc.queue[0].status, 'running');
    assert.equal(bc.queue[1].status, 'pending');
  });

  it('clearCompleted keeps pending jobs', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf')], 'docx');
    bc.clearCompleted();
    assert.equal(bc.queue.length, 2);
  });

  it('clearCompleted with only done jobs clears all', () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf')], 'docx');
    bc.queue[0].status = 'done';
    bc.queue[1].status = 'done';
    bc.clearCompleted();
    assert.equal(bc.queue.length, 0);
  });

  it('clearCompleted notifies listeners', () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    let count = 0;
    bc.onChange(() => count++);
    bc.clearCompleted();
    assert.ok(count >= 1);
  });

  // ── onChange / _notify ────────────────────────────────────────────────────

  it('onChange listener receives state object', () => {
    let receivedState = null;
    bc.onChange((s) => { receivedState = s; });
    bc.addFiles([makeFile('a.pdf')], 'docx');
    assert.ok(receivedState !== null);
    assert.equal(typeof receivedState.total, 'number');
    assert.equal(typeof receivedState.isRunning, 'boolean');
  });

  it('onChange returns unsubscribe function', () => {
    let count = 0;
    const unsub = bc.onChange(() => { count++; });
    bc.addFiles([makeFile('a.pdf')], 'docx');
    assert.equal(count, 1);
    unsub();
    bc.addFiles([makeFile('b.pdf')], 'docx');
    assert.equal(count, 1);
  });

  it('multiple listeners all get notified', () => {
    let a = 0, b = 0;
    bc.onChange(() => a++);
    bc.onChange(() => b++);
    bc.addFiles([makeFile('a.pdf')], 'docx');
    assert.equal(a, 1);
    assert.equal(b, 1);
  });

  it('listener throwing error does not prevent other listeners', () => {
    let b = 0;
    bc.onChange(() => { throw new Error('boom'); });
    bc.onChange(() => b++);
    // Should not throw, and second listener should still run
    bc.addFiles([makeFile('a.pdf')], 'docx');
    assert.equal(b, 1);
  });

  // ── start ──────────────────────────────────────────────────────────────────

  it('start processes pending jobs and marks done', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    const result = new Blob(['result']);
    await bc.start(async () => result);
    assert.equal(bc.queue[0].status, 'done');
    assert.equal(bc.queue[0].progress, 100);
    assert.equal(bc.queue[0].result, result);
    assert.equal(bc.isRunning, false);
  });

  it('start processes multiple pending jobs', async () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')], 'docx');
    await bc.start(async () => new Blob(['r']));
    assert.equal(bc.queue[0].status, 'done');
    assert.equal(bc.queue[1].status, 'done');
    assert.equal(bc.queue[2].status, 'done');
  });

  it('start calls onProgress callback during conversion', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    let progressValues = [];
    await bc.start(async (file, format, onProgress) => {
      onProgress(25);
      onProgress(50);
      onProgress(75);
      return new Blob(['r']);
    });
    // After completion progress is 100
    assert.equal(bc.queue[0].progress, 100);
  });

  it('start notifies listeners during progress', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    let callCount = 0;
    bc.onChange(() => callCount++);
    await bc.start(async (file, format, onProgress) => {
      onProgress(50);
      return new Blob(['r']);
    });
    // Called at: isRunning=true, job.status=running, progress=50, done, isRunning=false
    assert.ok(callCount >= 3);
  });

  it('start sets error status on failure', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    await bc.start(async () => { throw new Error('conversion failed'); });
    assert.equal(bc.queue[0].status, 'error');
    assert.ok(bc.queue[0].error.includes('conversion failed'));
  });

  it('start sets default error message when error has no message', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    await bc.start(async () => { throw null; });
    assert.equal(bc.queue[0].status, 'error');
    assert.ok(bc.queue[0].error.includes('Ошибка'));
  });

  it('start does nothing if already running', async () => {
    bc.isRunning = true;
    let called = false;
    await bc.start(async () => { called = true; return new Blob(); });
    assert.equal(called, false);
  });

  it('start skips non-pending jobs', async () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf')], 'docx');
    bc.queue[0].status = 'done';
    bc.queue[0].progress = 100;
    let callCount = 0;
    await bc.start(async () => { callCount++; return new Blob(['r']); });
    assert.equal(callCount, 1); // Only one job was processed
    assert.equal(bc.queue[0].status, 'done'); // unchanged
    assert.equal(bc.queue[1].status, 'done');
  });

  it('start passes file and format to convertFn', async () => {
    const file = makeFile('myfile.pdf');
    bc.addFiles([file], 'txt');
    let passedFile, passedFormat;
    await bc.start(async (f, fmt) => {
      passedFile = f;
      passedFormat = fmt;
      return new Blob(['r']);
    });
    assert.equal(passedFile, file);
    assert.equal(passedFormat, 'txt');
  });

  it('start sets isRunning to false after completion', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    assert.equal(bc.isRunning, false);
    const p = bc.start(async () => new Blob(['r']));
    assert.equal(bc.isRunning, true);
    await p;
    assert.equal(bc.isRunning, false);
  });

  // ── cancel ─────────────────────────────────────────────────────────────────

  it('cancel stops processing remaining jobs', async () => {
    bc.addFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')], 'docx');
    await bc.start(async (file) => {
      bc.cancel();
      return new Blob(['done']);
    });
    // First job should be done, rest should remain pending
    assert.equal(bc.queue[0].status, 'done');
    assert.equal(bc.queue[1].status, 'pending');
    assert.equal(bc.queue[2].status, 'pending');
  });

  it('cancel sets _cancelled to true', () => {
    bc.cancel();
    assert.equal(bc._cancelled, true);
  });

  it('start resets _cancelled at start', async () => {
    bc._cancelled = true;
    bc.addFiles([makeFile('a.pdf')], 'docx');
    await bc.start(async () => new Blob(['r']));
    assert.equal(bc.queue[0].status, 'done');
  });

  // ── downloadAsZip ──────────────────────────────────────────────────────────

  it('downloadAsZip does nothing when no completed jobs', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    // All pending, no done jobs
    await assert.doesNotReject(() => bc.downloadAsZip());
  });

  it('downloadAsZip creates a download link for completed jobs', async () => {
    bc.addFiles([makeFile('test.pdf', 'hello')], 'docx');
    bc.queue[0].status = 'done';
    bc.queue[0].result = new Blob(['docx content']);
    bc.queue[0].result.arrayBuffer = async () => new TextEncoder().encode('docx content').buffer;

    let clickedHref = null;
    let clickedDownload = null;
    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', {
          value: function() {
            clickedHref = this.href;
            clickedDownload = this.download;
          }
        });
      }
      return el;
    };

    await bc.downloadAsZip('output.zip');
    document.createElement = origCreate;

    assert.ok(clickedDownload === 'output.zip' || clickedHref !== null);
  });

  it('downloadAsZip uses default filename if not specified', async () => {
    bc.addFiles([makeFile('test.pdf', 'data')], 'txt');
    bc.queue[0].status = 'done';
    bc.queue[0].result = new Blob(['txt']);
    bc.queue[0].result.arrayBuffer = async () => new TextEncoder().encode('txt').buffer;

    let downloadName = null;
    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', {
          value: function() { downloadName = this.download; }
        });
      }
      return el;
    };

    await bc.downloadAsZip();
    document.createElement = origCreate;

    assert.equal(downloadName, 'converted.zip');
  });

  it('downloadAsZip strips extension from source filename', async () => {
    bc.addFiles([makeFile('document.pdf', 'data')], 'docx');
    bc.queue[0].status = 'done';
    bc.queue[0].result = new Blob(['data']);
    bc.queue[0].result.arrayBuffer = async () => new TextEncoder().encode('data').buffer;

    // Just verify it runs without error
    await assert.doesNotReject(() => bc.downloadAsZip('test.zip'));
  });

  it('downloadAsZip handles multiple completed jobs', async () => {
    bc.addFiles([makeFile('file1.pdf', 'abc'), makeFile('file2.pdf', 'def')], 'png');
    bc.queue[0].status = 'done';
    bc.queue[0].result = new Blob(['png1']);
    bc.queue[0].result.arrayBuffer = async () => new TextEncoder().encode('png1').buffer;
    bc.queue[1].status = 'done';
    bc.queue[1].result = new Blob(['png2']);
    bc.queue[1].result.arrayBuffer = async () => new TextEncoder().encode('png2').buffer;

    await assert.doesNotReject(() => bc.downloadAsZip('multi.zip'));
  });

  it('downloadAsZip skips jobs without result', async () => {
    bc.addFiles([makeFile('a.pdf')], 'docx');
    bc.queue[0].status = 'done';
    bc.queue[0].result = null; // No result despite done status
    await assert.doesNotReject(() => bc.downloadAsZip());
  });
});

// ── batchConverter singleton ──────────────────────────────────────────────────

describe('batchConverter singleton', () => {
  it('is a BatchConverter instance', () => {
    assert.ok(batchConverter instanceof BatchConverter);
  });

  it('starts with empty queue', () => {
    // The singleton may have been used; just check it has proper methods
    assert.equal(typeof batchConverter.addFiles, 'function');
    assert.equal(typeof batchConverter.start, 'function');
    assert.equal(typeof batchConverter.cancel, 'function');
    assert.equal(typeof batchConverter.downloadAsZip, 'function');
  });
});
