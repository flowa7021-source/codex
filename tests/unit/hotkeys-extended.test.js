import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getBindings } from '../../app/modules/hotkeys.js';

describe('hotkeys-extended', () => {
  it('ctrl+shift+x binding exists for exportXlsx', () => {
    const bindings = getBindings();
    const match = bindings.find(b => b.key === 'ctrl+shift+x' && b.action === 'exportXlsx');
    assert.ok(match, 'Should have ctrl+shift+x bound to exportXlsx');
  });

  it('ctrl+shift+b binding exists for batchConvert', () => {
    const bindings = getBindings();
    const match = bindings.find(b => b.key === 'ctrl+shift+b' && b.action === 'batchConvert');
    assert.ok(match, 'Should have ctrl+shift+b bound to batchConvert');
  });

  it('DEFAULT_BINDINGS includes the new entries', () => {
    const bindings = getBindings();
    const actions = bindings.map(b => b.action);
    assert.ok(actions.includes('exportXlsx'), 'bindings should include exportXlsx action');
    assert.ok(actions.includes('batchConvert'), 'bindings should include batchConvert action');
  });

  it('exportXlsx binding has a description', () => {
    const bindings = getBindings();
    const match = bindings.find(b => b.action === 'exportXlsx');
    assert.ok(match, 'exportXlsx binding should exist');
    assert.ok(match.description && match.description.length > 0, 'description should not be empty');
  });

  it('batchConvert binding has a description', () => {
    const bindings = getBindings();
    const match = bindings.find(b => b.action === 'batchConvert');
    assert.ok(match, 'batchConvert binding should exist');
    assert.ok(match.description && match.description.length > 0, 'description should not be empty');
  });
});
