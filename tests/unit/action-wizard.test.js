// ─── Unit Tests: ActionWizard ────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { ActionWizard } from '../../app/modules/action-wizard.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a fake File-like object with an arrayBuffer() method. */
function fakeFile(name, content = new Uint8Array([1, 2, 3])) {
  return {
    name,
    arrayBuffer: async () => content.buffer,
  };
}

// ─── addStep ────────────────────────────────────────────────────────────────

describe('ActionWizard – addStep', () => {
  it('adds valid operations to the steps array', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr').addStep('compress').addStep('watermark');
    assert.equal(wiz.steps.length, 3);
    assert.equal(wiz.steps[0].operation, 'ocr');
    assert.equal(wiz.steps[1].operation, 'compress');
    assert.equal(wiz.steps[2].operation, 'watermark');
  });

  it('throws on invalid operation', () => {
    const wiz = new ActionWizard();
    assert.throws(() => wiz.addStep('invalid-op'), { message: /Unknown operation/ });
  });

  it('stores options alongside the operation', () => {
    const wiz = new ActionWizard();
    wiz.addStep('compress', { profile: 'screen' });
    assert.deepEqual(wiz.steps[0].options, { profile: 'screen' });
  });
});

// ─── removeStep ─────────────────────────────────────────────────────────────

describe('ActionWizard – removeStep', () => {
  it('removes the step at the given index', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr').addStep('compress').addStep('watermark');
    wiz.removeStep(1);
    assert.equal(wiz.steps.length, 2);
    assert.equal(wiz.steps[0].operation, 'ocr');
    assert.equal(wiz.steps[1].operation, 'watermark');
  });

  it('ignores out-of-bounds index', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr');
    wiz.removeStep(5);
    assert.equal(wiz.steps.length, 1);
  });

  it('ignores negative index', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr');
    wiz.removeStep(-1);
    assert.equal(wiz.steps.length, 1);
  });
});

// ─── reorderSteps ───────────────────────────────────────────────────────────

describe('ActionWizard – reorderSteps', () => {
  it('reorders steps according to the given indices', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr').addStep('compress').addStep('watermark');
    wiz.reorderSteps([2, 0, 1]);
    assert.equal(wiz.steps[0].operation, 'watermark');
    assert.equal(wiz.steps[1].operation, 'ocr');
    assert.equal(wiz.steps[2].operation, 'compress');
  });

  it('filters out invalid indices', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr').addStep('compress');
    wiz.reorderSteps([1, 99]);
    assert.equal(wiz.steps.length, 1);
    assert.equal(wiz.steps[0].operation, 'compress');
  });
});

// ─── Templates ──────────────────────────────────────────────────────────────

describe('ActionWizard – templates', () => {
  it('saveTemplate/loadTemplate round-trip preserves steps', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr', { lang: 'deu' }).addStep('compress', { profile: 'screen' });
    wiz.saveTemplate('my-pipeline');

    // Modify current steps
    wiz.addStep('watermark');
    assert.equal(wiz.steps.length, 3);

    // Restore from template
    wiz.loadTemplate('my-pipeline');
    assert.equal(wiz.steps.length, 2);
    assert.equal(wiz.steps[0].operation, 'ocr');
    assert.deepEqual(wiz.steps[0].options, { lang: 'deu' });
  });

  it('loadTemplate throws for unknown template', () => {
    const wiz = new ActionWizard();
    assert.throws(() => wiz.loadTemplate('nonexistent'), { message: /Template not found/ });
  });

  it('listTemplates returns saved names', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr');
    wiz.saveTemplate('alpha');
    wiz.saveTemplate('beta');
    assert.deepEqual(wiz.listTemplates(), ['alpha', 'beta']);
  });

  it('deleteTemplate removes a template', () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr');
    wiz.saveTemplate('temp');
    wiz.deleteTemplate('temp');
    assert.deepEqual(wiz.listTemplates(), []);
  });

  it('saved template is a deep copy (mutations do not affect saved)', () => {
    const wiz = new ActionWizard();
    wiz.addStep('compress', { profile: 'ebook' });
    wiz.saveTemplate('snap');
    wiz.steps[0].options.profile = 'screen';
    wiz.loadTemplate('snap');
    assert.equal(wiz.steps[0].options.profile, 'ebook');
  });
});

// ─── execute ────────────────────────────────────────────────────────────────

describe('ActionWizard – execute', () => {
  it('throws when no steps are defined', async () => {
    const wiz = new ActionWizard();
    await assert.rejects(() => wiz.execute([fakeFile('a.pdf')], '/out'), { message: /No steps defined/ });
  });

  it('chains multiple steps (pass-through for unimplemented ops)', async () => {
    const wiz = new ActionWizard();
    // These ops use the default pass-through in _executeStep
    wiz.addStep('ocr').addStep('split').addStep('merge');

    const results = await wiz.execute([fakeFile('test.pdf')], '/out');
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'ok');
    assert.equal(results[0].filename, 'test.pdf');
    assert.equal(results[0].log.length, 3);
    assert.ok(results[0].outputBlob instanceof Blob);
  });

  it('reports error when a step fails', async () => {
    const wiz = new ActionWizard();
    wiz.addStep('flatten'); // flatten tries to load pdf-lib on invalid bytes → error

    const results = await wiz.execute([fakeFile('bad.pdf')], '/out');
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'error');
    assert.ok(results[0].error);
    assert.ok(results[0].log.some(l => l.startsWith('✗')));
    assert.equal(results[0].outputBlob, undefined);
  });

  it('calls onProgress for each file/step', async () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr').addStep('split');

    const calls = [];
    const onProgress = (fi, ft, si, st, status) => calls.push({ fi, ft, si, st, status });

    await wiz.execute([fakeFile('a.pdf'), fakeFile('b.pdf')], '/out', onProgress);
    // 2 files × 2 steps = 4 progress calls
    assert.equal(calls.length, 4);
    assert.equal(calls[0].fi, 1);
    assert.equal(calls[0].ft, 2);
    assert.equal(calls[0].si, 1);
    assert.equal(calls[0].st, 2);
  });

  it('returns results for each input file', async () => {
    const wiz = new ActionWizard();
    wiz.addStep('ocr');

    const files = [fakeFile('one.pdf'), fakeFile('two.pdf'), fakeFile('three.pdf')];
    const results = await wiz.execute(files, '/out');
    assert.equal(results.length, 3);
    assert.deepEqual(results.map(r => r.filename), ['one.pdf', 'two.pdf', 'three.pdf']);
  });
});

// ─── cancel ─────────────────────────────────────────────────────────────────

describe('ActionWizard – cancel', () => {
  it('marks remaining files as cancelled', async () => {
    const wiz = new ActionWizard();
    // Use a step that allows us to cancel mid-execution
    wiz.addStep('ocr');

    const files = [];
    for (let i = 0; i < 5; i++) files.push(fakeFile(`file${i}.pdf`));

    let callCount = 0;
    const onProgress = () => {
      callCount++;
      // Cancel after the 2nd file starts processing
      if (callCount === 2) wiz.cancel();
    };

    const results = await wiz.execute(files, '/out', onProgress);
    assert.equal(results.length, 5);

    // First two files should have been processed (ok)
    assert.equal(results[0].status, 'ok');
    assert.equal(results[1].status, 'ok');

    // Remaining files should be cancelled
    const cancelledCount = results.filter(r => r.status === 'cancelled').length;
    assert.ok(cancelledCount >= 1, `Expected at least 1 cancelled, got ${cancelledCount}`);
  });
});
