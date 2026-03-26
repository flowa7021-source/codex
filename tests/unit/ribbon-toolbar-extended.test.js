import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { initRibbonToolbar } = await import('../../app/modules/ribbon-toolbar.js');

/**
 * Helper: initialize ribbon with defaults and extract tab/panel info
 * using the same child-traversal pattern as the passing ribbon-toolbar.test.js.
 */
function setupRibbon() {
  const container = document.createElement('div');
  initRibbonToolbar({ container });

  const contentArea = container.children.find(c => c.className?.includes('ribbon-content-area'));
  const tabBar = container.children.find(c => c.className?.includes('ribbon-tab-bar'));

  // Collect panels by dataset.ribbonPanel
  const panels = contentArea ? contentArea.children : [];

  function findPanel(id) {
    return panels.find(p => p.dataset?.ribbonPanel === id) ?? null;
  }

  function findTabBtn(id) {
    return tabBar ? tabBar.children.find(c => c.dataset?.ribbonTab === id) ?? null : null;
  }

  // Collect group labels from a panel
  function getGroupLabels(panel) {
    if (!panel) return [];
    const labels = [];
    for (const group of panel.children) {
      // Each group has children: [ribbon-group-content, ribbon-group-label]
      for (const child of (group.children || [])) {
        if (child.className?.includes('ribbon-group-label')) {
          labels.push(child.textContent);
        }
      }
    }
    return labels;
  }

  return { container, contentArea, tabBar, panels, findPanel, findTabBtn, getGroupLabels };
}

describe('ribbon-toolbar-extended', () => {
  it('export tab contains exportXlsx button ID in its groups', () => {
    const { findPanel, getGroupLabels } = setupRibbon();
    const exportPanel = findPanel('export');
    assert.ok(exportPanel, 'export panel should exist');
    const labels = getGroupLabels(exportPanel);
    const hasConverters = labels.includes('Конвертеры');
    assert.ok(hasConverters, 'export tab should contain a "Конвертеры" group');
  });

  it('export tab includes all new export button IDs', () => {
    const { findPanel, getGroupLabels } = setupRibbon();
    const exportPanel = findPanel('export');
    assert.ok(exportPanel, 'export panel should exist');
    const labels = getGroupLabels(exportPanel);
    assert.ok(labels.length >= 3, `Expected at least 3 groups, got ${labels.length}`);
    assert.ok(labels.includes('Конвертеры'), 'Should include Конвертеры group');
  });

  it('tools tab exists as a ribbon panel', () => {
    const { findPanel } = setupRibbon();
    const toolsPanel = findPanel('tools');
    assert.ok(toolsPanel, 'tools tab should be present');
  });

  it('tools tab contains form designer group', () => {
    const { findPanel, getGroupLabels } = setupRibbon();
    const toolsPanel = findPanel('tools');
    assert.ok(toolsPanel, 'tools panel should exist');
    const labels = getGroupLabels(toolsPanel);
    assert.ok(labels.includes('Формы'), 'tools tab should contain "Формы" group for form designer');
  });

  it('tools tab contains batch convert group (Автоматизация)', () => {
    const { findPanel, getGroupLabels } = setupRibbon();
    const toolsPanel = findPanel('tools');
    assert.ok(toolsPanel, 'tools panel should exist');
    const labels = getGroupLabels(toolsPanel);
    assert.ok(labels.includes('Автоматизация'), 'tools tab should contain "Автоматизация" group for batch convert');
  });

  it('tools tab contains all expected groups', () => {
    const { findPanel, getGroupLabels } = setupRibbon();
    const toolsPanel = findPanel('tools');
    assert.ok(toolsPanel, 'tools panel should exist');
    const labels = getGroupLabels(toolsPanel);
    const expectedGroups = ['Формы', 'Автоматизация', 'Разделение', 'Оптимизация', 'Безопасность'];
    for (const group of expectedGroups) {
      assert.ok(labels.includes(group), `tools tab should contain "${group}" group`);
    }
  });

  it('tools tab button exists and is not contextual', () => {
    const { findTabBtn } = setupRibbon();
    const toolsBtn = findTabBtn('tools');
    assert.ok(toolsBtn, 'tools tab button should exist');
    assert.ok(!toolsBtn.classList.contains('ribbon-tab-contextual'), 'tools tab should not be contextual');
  });

  it('i18n keys exist for all new buttons in en locale', async () => {
    const en = (await import('../../app/locales/en.json', { with: { type: 'json' } })).default;
    const requiredKeys = [
      'export_xlsx', 'export_pptx', 'export_rtf', 'export_svg', 'export_csv', 'export_tiff',
      'form_designer', 'action_wizard', 'batch_convert',
      'split_by_bookmarks', 'split_by_size', 'split_by_blank',
      'compress_screen', 'compress_ebook', 'compress_print', 'compress_prepress',
      'sanitize_document', 'validate_pdfa',
    ];
    for (const key of requiredKeys) {
      assert.ok(en[key], `en.json should contain key "${key}"`);
    }
  });

  it('i18n keys exist for all new buttons in ru locale', async () => {
    const ru = (await import('../../app/locales/ru.json', { with: { type: 'json' } })).default;
    const requiredKeys = [
      'export_xlsx', 'export_pptx', 'export_rtf', 'export_svg', 'export_csv', 'export_tiff',
      'form_designer', 'action_wizard', 'batch_convert',
      'split_by_bookmarks', 'split_by_size', 'split_by_blank',
      'compress_screen', 'compress_ebook', 'compress_print', 'compress_prepress',
      'sanitize_document', 'validate_pdfa',
    ];
    for (const key of requiredKeys) {
      assert.ok(ru[key], `ru.json should contain key "${key}"`);
    }
  });

  it('all new button IDs appear in some tab', () => {
    const { panels, getGroupLabels } = setupRibbon();
    const allGroupLabels = [];
    for (const p of panels) {
      allGroupLabels.push(...getGroupLabels(p));
    }
    assert.ok(allGroupLabels.includes('Конвертеры'), 'Конвертеры group should exist');
    assert.ok(allGroupLabels.includes('Формы'), 'Формы group should exist');
    assert.ok(allGroupLabels.includes('Автоматизация'), 'Автоматизация group should exist');
    assert.ok(allGroupLabels.includes('Разделение'), 'Разделение group should exist');
    assert.ok(allGroupLabels.includes('Оптимизация'), 'Оптимизация group should exist');
    assert.ok(allGroupLabels.includes('Безопасность'), 'Безопасность group should exist');
  });
});
