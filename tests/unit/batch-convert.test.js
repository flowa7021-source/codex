import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { BatchConverter } from '../../app/modules/batch-convert.js';

describe('BatchConverter', () => {
  let bc;

  beforeEach(() => {
    bc = new BatchConverter();
  });

  it('starts with empty queue', () => {
    const state = bc.getState();
    assert.equal(state.total, 0);
    assert.equal(state.isRunning, false);
    assert.equal(state.overallProgress, 0);
  });

  it('addFiles adds jobs to queue', () => {
    bc.addFiles([{ name: 'a.pdf' }, { name: 'b.pdf' }], 'docx');
    const state = bc.getState();
    assert.equal(state.total, 2);
    assert.equal(state.pending, 2);
  });

  it('removeJob removes a job by index', () => {
    bc.addFiles([{ name: 'a.pdf' }, { name: 'b.pdf' }], 'docx');
    bc.removeJob(0);
    assert.equal(bc.getState().total, 1);
    assert.equal(bc.queue[0].file.name, 'b.pdf');
  });

  it('clearCompleted removes done and error jobs', () => {
    bc.addFiles([{ name: 'a.pdf' }], 'docx');
    bc.queue[0].status = 'done';
    bc.addFiles([{ name: 'b.pdf' }], 'docx');
    bc.queue[1].status = 'error';
    bc.addFiles([{ name: 'c.pdf' }], 'docx');
    bc.clearCompleted();
    assert.equal(bc.getState().total, 1);
    assert.equal(bc.queue[0].file.name, 'c.pdf');
  });

  it('onChange listener is called on addFiles', () => {
    let called = false;
    bc.onChange(() => { called = true; });
    bc.addFiles([{ name: 'a.pdf' }], 'docx');
    assert.ok(called);
  });

  it('onChange returns unsubscribe function', () => {
    let count = 0;
    const unsub = bc.onChange(() => { count++; });
    bc.addFiles([{ name: 'a.pdf' }], 'docx');
    assert.equal(count, 1);
    unsub();
    bc.addFiles([{ name: 'b.pdf' }], 'docx');
    assert.equal(count, 1);
  });

  it('start processes pending jobs', async () => {
    bc.addFiles([{ name: 'a.pdf' }], 'docx');
    const convertFn = async () => new Blob(['result']);
    await bc.start(convertFn);
    assert.equal(bc.queue[0].status, 'done');
    assert.equal(bc.queue[0].progress, 100);
    assert.equal(bc.isRunning, false);
  });

  it('start sets error status on failure', async () => {
    bc.addFiles([{ name: 'a.pdf' }], 'docx');
    const convertFn = async () => { throw new Error('fail'); };
    await bc.start(convertFn);
    assert.equal(bc.queue[0].status, 'error');
    assert.ok(bc.queue[0].error.includes('fail'));
  });

  it('cancel stops processing', async () => {
    bc.addFiles([{ name: 'a.pdf' }, { name: 'b.pdf' }], 'docx');
    const convertFn = async () => {
      bc.cancel();
      return new Blob(['done']);
    };
    await bc.start(convertFn);
    // First job should be done, second should stay pending
    assert.equal(bc.queue[0].status, 'done');
    assert.equal(bc.queue[1].status, 'pending');
  });

  it('does not start if already running', async () => {
    bc.isRunning = true;
    let called = false;
    await bc.start(async () => { called = true; return new Blob(); });
    assert.ok(!called);
  });

  it('skips non-pending jobs', async () => {
    bc.addFiles([{ name: 'a.pdf' }], 'docx');
    bc.queue[0].status = 'done';
    const convertFn = mock.fn(async () => new Blob());
    await bc.start(convertFn);
    assert.equal(convertFn.mock.calls.length, 0);
  });

  it('calculates overall progress', () => {
    bc.addFiles([{ name: 'a.pdf' }, { name: 'b.pdf' }], 'docx');
    bc.queue[0].progress = 100;
    bc.queue[1].progress = 50;
    const state = bc.getState();
    assert.equal(state.overallProgress, 75);
  });
});
