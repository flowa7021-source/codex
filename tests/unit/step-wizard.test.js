// ─── Unit Tests: StepWizard ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { StepWizard } from '../../app/modules/step-wizard.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a basic wizard with N steps. */
function makeWizard(count = 3) {
  const steps = Array.from({ length: count }, (_, i) => ({
    id: `step-${i}`,
    label: `Step ${i + 1}`,
  }));
  return new StepWizard(steps);
}

// ─── constructor ─────────────────────────────────────────────────────────────

describe('StepWizard – constructor', () => {
  it('starts at index 0', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.currentIndex, 0);
  });

  it('throws when constructed with empty steps', () => {
    assert.throws(() => new StepWizard([]), /at least one step/);
  });

  it('works with a single step', () => {
    const wiz = new StepWizard([{ id: 'only', label: 'Only Step' }]);
    assert.equal(wiz.stepCount, 1);
    assert.equal(wiz.currentIndex, 0);
  });
});

// ─── currentStep / currentIndex ──────────────────────────────────────────────

describe('StepWizard – currentStep / currentIndex', () => {
  it('currentStep returns the correct step at index 0', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.currentStep.id, 'step-0');
    assert.equal(wiz.currentStep.label, 'Step 1');
  });

  it('currentIndex reflects position after next', () => {
    const wiz = makeWizard(3);
    wiz.next();
    assert.equal(wiz.currentIndex, 1);
    assert.equal(wiz.currentStep.id, 'step-1');
  });

  it('currentStep returns a copy (mutation does not affect internal state)', () => {
    const wiz = makeWizard(3);
    const step = wiz.currentStep;
    step.label = 'Mutated';
    assert.equal(wiz.currentStep.label, 'Step 1');
  });
});

// ─── isFirst / isLast ────────────────────────────────────────────────────────

describe('StepWizard – isFirst / isLast', () => {
  it('isFirst is true at index 0', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.isFirst, true);
  });

  it('isFirst is false after advancing', () => {
    const wiz = makeWizard(3);
    wiz.next();
    assert.equal(wiz.isFirst, false);
  });

  it('isLast is false at the start', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.isLast, false);
  });

  it('isLast is true at the final step', () => {
    const wiz = makeWizard(3);
    wiz.next();
    wiz.next();
    assert.equal(wiz.isLast, true);
  });

  it('single-step wizard is both first and last', () => {
    const wiz = new StepWizard([{ id: 'only', label: 'Only' }]);
    assert.equal(wiz.isFirst, true);
    assert.equal(wiz.isLast, true);
  });
});

// ─── next ────────────────────────────────────────────────────────────────────

describe('StepWizard – next', () => {
  it('advances to the next step and returns true', () => {
    const wiz = makeWizard(3);
    const result = wiz.next();
    assert.equal(result, true);
    assert.equal(wiz.currentIndex, 1);
  });

  it('returns false when already on the last step', () => {
    const wiz = makeWizard(2);
    wiz.next();
    const result = wiz.next();
    assert.equal(result, false);
    assert.equal(wiz.currentIndex, 1);
  });

  it('returns false when canGoNext is false (valid=false)', () => {
    const wiz = makeWizard(3);
    wiz.setValid(false);
    const result = wiz.next();
    assert.equal(result, false);
    assert.equal(wiz.currentIndex, 0);
  });
});

// ─── prev ────────────────────────────────────────────────────────────────────

describe('StepWizard – prev', () => {
  it('goes back to the previous step and returns true', () => {
    const wiz = makeWizard(3);
    wiz.next();
    const result = wiz.prev();
    assert.equal(result, true);
    assert.equal(wiz.currentIndex, 0);
  });

  it('returns false when already at the first step', () => {
    const wiz = makeWizard(3);
    const result = wiz.prev();
    assert.equal(result, false);
    assert.equal(wiz.currentIndex, 0);
  });
});

// ─── goto ────────────────────────────────────────────────────────────────────

describe('StepWizard – goto', () => {
  it('jumps to a valid index and returns true', () => {
    const wiz = makeWizard(5);
    const result = wiz.goto(3);
    assert.equal(result, true);
    assert.equal(wiz.currentIndex, 3);
  });

  it('returns false for a negative index', () => {
    const wiz = makeWizard(3);
    const result = wiz.goto(-1);
    assert.equal(result, false);
    assert.equal(wiz.currentIndex, 0);
  });

  it('returns false for an index beyond the last step', () => {
    const wiz = makeWizard(3);
    const result = wiz.goto(10);
    assert.equal(result, false);
    assert.equal(wiz.currentIndex, 0);
  });

  it('can jump to index 0 (first step)', () => {
    const wiz = makeWizard(3);
    wiz.next();
    wiz.next();
    assert.equal(wiz.goto(0), true);
    assert.equal(wiz.currentIndex, 0);
  });

  it('can jump to the last valid index', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.goto(2), true);
    assert.equal(wiz.currentIndex, 2);
  });
});

// ─── canGoNext ───────────────────────────────────────────────────────────────

describe('StepWizard – canGoNext', () => {
  it('is true by default (no valid property)', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.canGoNext, true);
  });

  it('is false when current step valid=false', () => {
    const wiz = makeWizard(3);
    wiz.setValid(false);
    assert.equal(wiz.canGoNext, false);
  });

  it('is true when current step valid=true', () => {
    const wiz = makeWizard(3);
    wiz.setValid(true);
    assert.equal(wiz.canGoNext, true);
  });
});

// ─── canGoPrev ───────────────────────────────────────────────────────────────

describe('StepWizard – canGoPrev', () => {
  it('is false at the first step', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.canGoPrev, false);
  });

  it('is true after advancing one step', () => {
    const wiz = makeWizard(3);
    wiz.next();
    assert.equal(wiz.canGoPrev, true);
  });
});

// ─── progress ────────────────────────────────────────────────────────────────

describe('StepWizard – progress', () => {
  it('is 0 at the first step', () => {
    const wiz = makeWizard(3);
    assert.equal(wiz.progress, 0);
  });

  it('is 100 at the last step', () => {
    const wiz = makeWizard(3);
    wiz.goto(2);
    assert.equal(wiz.progress, 100);
  });

  it('is 50 at the middle step of a 3-step wizard', () => {
    const wiz = makeWizard(3);
    wiz.goto(1);
    assert.equal(wiz.progress, 50);
  });

  it('is 0 for a single-step wizard', () => {
    const wiz = new StepWizard([{ id: 'only', label: 'Only' }]);
    assert.equal(wiz.progress, 0);
  });
});

// ─── updateData ──────────────────────────────────────────────────────────────

describe('StepWizard – updateData', () => {
  it('stores data on the current step', () => {
    const wiz = makeWizard(3);
    wiz.updateData({ name: 'Alice' });
    assert.deepEqual(wiz.currentStep.data, { name: 'Alice' });
  });

  it('data is visible via getSteps', () => {
    const wiz = makeWizard(3);
    wiz.updateData(42);
    const steps = wiz.getSteps();
    assert.equal(steps[0].data, 42);
  });

  it('data persists after moving forward and back', () => {
    const wiz = makeWizard(3);
    wiz.updateData('hello');
    wiz.next();
    wiz.prev();
    assert.equal(wiz.currentStep.data, 'hello');
  });
});

// ─── setValid ────────────────────────────────────────────────────────────────

describe('StepWizard – setValid', () => {
  it('setValid(false) blocks next', () => {
    const wiz = makeWizard(3);
    wiz.setValid(false);
    assert.equal(wiz.canGoNext, false);
    assert.equal(wiz.next(), false);
  });

  it('setValid(true) allows next', () => {
    const wiz = makeWizard(3);
    wiz.setValid(false);
    wiz.setValid(true);
    assert.equal(wiz.canGoNext, true);
    assert.equal(wiz.next(), true);
  });

  it('validity is stored on the step', () => {
    const wiz = makeWizard(3);
    wiz.setValid(false);
    assert.equal(wiz.getSteps()[0].valid, false);
  });
});

// ─── getSteps ────────────────────────────────────────────────────────────────

describe('StepWizard – getSteps', () => {
  it('returns all steps', () => {
    const wiz = makeWizard(4);
    const steps = wiz.getSteps();
    assert.equal(steps.length, 4);
    assert.equal(steps[0].id, 'step-0');
    assert.equal(steps[3].id, 'step-3');
  });

  it('returns copies (mutation does not affect internal state)', () => {
    const wiz = makeWizard(3);
    const steps = wiz.getSteps();
    steps[0].label = 'Changed';
    assert.equal(wiz.getSteps()[0].label, 'Step 1');
  });
});

// ─── reset ───────────────────────────────────────────────────────────────────

describe('StepWizard – reset', () => {
  it('returns to step 0', () => {
    const wiz = makeWizard(3);
    wiz.next();
    wiz.next();
    wiz.reset();
    assert.equal(wiz.currentIndex, 0);
  });

  it('isFirst is true after reset', () => {
    const wiz = makeWizard(3);
    wiz.goto(2);
    wiz.reset();
    assert.equal(wiz.isFirst, true);
  });
});

// ─── subscribe ───────────────────────────────────────────────────────────────

describe('StepWizard – subscribe', () => {
  it('is called on next', () => {
    const wiz = makeWizard(3);
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.next();
    assert.equal(calls, 1);
  });

  it('is called on prev', () => {
    const wiz = makeWizard(3);
    wiz.next();
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.prev();
    assert.equal(calls, 1);
  });

  it('is called on goto', () => {
    const wiz = makeWizard(3);
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.goto(2);
    assert.equal(calls, 1);
  });

  it('is called on updateData', () => {
    const wiz = makeWizard(3);
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.updateData('x');
    assert.equal(calls, 1);
  });

  it('is called on setValid', () => {
    const wiz = makeWizard(3);
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.setValid(false);
    assert.equal(calls, 1);
  });

  it('is called on reset', () => {
    const wiz = makeWizard(3);
    wiz.next();
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.reset();
    assert.equal(calls, 1);
  });

  it('callback receives the wizard instance', () => {
    const wiz = makeWizard(3);
    let received = null;
    wiz.subscribe((w) => { received = w; });
    wiz.next();
    assert.equal(received, wiz);
  });

  it('unsubscribe stops further callbacks', () => {
    const wiz = makeWizard(3);
    let calls = 0;
    const unsub = wiz.subscribe(() => calls++);
    wiz.next();
    assert.equal(calls, 1);
    unsub();
    wiz.prev();
    assert.equal(calls, 1);
  });

  it('multiple subscribers all receive the callback', () => {
    const wiz = makeWizard(3);
    let a = 0;
    let b = 0;
    wiz.subscribe(() => a++);
    wiz.subscribe(() => b++);
    wiz.next();
    assert.equal(a, 1);
    assert.equal(b, 1);
  });

  it('is not called when next returns false', () => {
    const wiz = makeWizard(2);
    wiz.goto(1); // at last step
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.next(); // should fail
    assert.equal(calls, 0);
  });

  it('is not called when prev returns false', () => {
    const wiz = makeWizard(3);
    // already at first step
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.prev(); // should fail
    assert.equal(calls, 0);
  });

  it('is not called when goto returns false', () => {
    const wiz = makeWizard(3);
    let calls = 0;
    wiz.subscribe(() => calls++);
    wiz.goto(99); // invalid
    assert.equal(calls, 0);
  });
});
