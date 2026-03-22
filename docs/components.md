# NovaReader UI Components Reference

## Toast Notifications (`toast.js`)

```js
import { toast, toastSuccess, toastError, toastWarning, toastInfo, toastProgress } from './modules/toast.js';

// Basic usage
toast('Message', { type: 'info', duration: 4000 });

// Shortcuts
toastSuccess('Saved!');
toastError('Failed to load', 6000);
toastWarning('Low memory');
toastInfo('File opened');

// Progress toast (manual dismiss)
const t = toastProgress('Loading...', { progress: 0 });
t.update('Loading...', { progress: 50 });
t.update('Done!', { type: 'success', duration: 2000 });
t.dismiss();

// Dismiss all
dismissAllToasts();
```

**Types:** `success`, `error`, `warning`, `info`, `progress`
**Auto-dismiss:** 4s default (6s for errors, manual for progress)
**Stacking:** Max 5 toasts, oldest evicted

---

## Tooltip (`tooltip.js`)

```js
import { initTooltips, destroyTooltips } from './modules/tooltip.js';

// Initialize once at app startup
initTooltips();

// Cleanup (for testing or shutdown)
destroyTooltips();
```

**Usage in HTML:**
```html
<button data-tooltip="Click to save" data-shortcut="Ctrl+S">Save</button>
```

**Features:** Auto-converts `title` to `data-tooltip`, shows keyboard shortcuts, 500ms show delay, 100ms hide delay, auto-positions above/below.

---

## Command Palette (`command-palette.js`)

```js
import { initCommandPalette, showCommandPalette, hideCommandPalette, registerCommand } from './modules/command-palette.js';

// Register commands
registerCommand({
  id: 'file.open',
  label: 'Open File',
  shortcut: 'Ctrl+O',
  category: 'File',
  action: () => document.getElementById('fileInput').click(),
});

// Show palette (Ctrl+Shift+P)
showCommandPalette();
```

**Features:** Fuzzy search, keyboard navigation, categories, shortcut display.

---

## Quick Actions (`quick-actions.js`)

```js
import { initQuickActions, addQuickAction } from './modules/quick-actions.js';

initQuickActions({ container: document.getElementById('quickActionsBar') });

addQuickAction({
  id: 'highlight',
  icon: '🖍',
  label: 'Highlight',
  action: () => setToolMode('text-highlight'),
});
```

**Features:** Appears on text selection, context-aware actions.

---

## Modal Prompt (`modal-prompt.js`)

```js
import { nrPrompt, nrConfirm } from './modules/modal-prompt.js';

// Text input prompt
const value = await nrPrompt('Enter page number:', { defaultValue: '1' });

// Yes/No confirmation
const confirmed = await nrConfirm('Delete all annotations?');
```

---

## Settings UI (`settings-ui.js`)

```js
import { openSettingsModal, closeSettingsModal, saveSettingsFromModal, resetUiSizeToDefaults } from './modules/settings-ui.js';

openSettingsModal();  // Opens with live-preview
// User adjusts settings...
saveSettingsFromModal(); // Saves and applies
resetUiSizeToDefaults(); // Resets sizes only
```

**Features:** Live-preview of size changes, reset to defaults, focus management (WCAG).

---

## Layout Controller (`layout-controller.js`)

```js
import { setupResizableLayout, applyLayoutState, applyLayoutWithTransition, toggleLayoutState } from './modules/layout-controller.js';

setupResizableLayout(); // Drag handles for sidebar + canvas area
applyLayoutWithTransition(); // Smooth CSS transitions
toggleLayoutState('sidebarHidden'); // Toggle panel visibility
```

**Resize handles:** Visual feedback with pixel tooltips during drag.
**Persistence:** All sizes saved to localStorage with debounce.

---

## Presentation Mode (`presentation-mode.js`)

```js
import { PresentationMode } from './modules/presentation-mode.js';

const pm = new PresentationMode({ adapter: state.adapter, pageCount: state.pageCount });
pm.start(currentPage); // Enter fullscreen
pm.stop(); // Exit
```

**Features:** Fullscreen, auto-hide cursor, slide transitions, keyboard navigation.

---

## Virtual Scroll (`virtual-scroll.js`)

```js
import { VirtualScroll } from './modules/virtual-scroll.js';

const vs = new VirtualScroll({
  container: scrollElement,
  pageCount: 100,
  getPageHeight: (n) => 1100,
  renderPage: async (n, el) => { /* render into el */ },
  overscan: 2,
});

vs.scrollToPage(42);
vs.getCurrentPage(); // Returns most-visible page
vs.destroy(); // Cleanup
```

---

## Event Bus (`event-bus.js`)

```js
import { emit, on, once, subscribe, removeAllListeners } from './modules/event-bus.js';

// Subscribe
const unsub = on('file:opened', (detail) => console.log(detail.name));

// Emit
emit('file:opened', { name: 'document.pdf', pages: 42 });

// One-time listener
once('ocr:done', (result) => console.log(result.text));

// Cleanup
unsub();
removeAllListeners(); // Nuclear option
```

---

## Safe Timers (`safe-timers.js`)

```js
import { safeTimeout, safeInterval, clearSafeTimeout, clearSafeInterval, clearAllTimers } from './modules/safe-timers.js';

// Tracked timeout (auto-cleared on document change)
const id = safeTimeout(() => doSomething(), 1000);
clearSafeTimeout(id);

// App-scoped timer (persists across documents)
safeInterval(() => autoSave(), 30000, { scope: 'app' });

// Clear all document-scoped timers (called on file open)
clearAllTimers();
clearAllTimers('all'); // Clear everything including app-scoped
```

---

## Table Conversion Plugins (`table-conversion-plugins.js`)

```js
import { tablePluginRegistry, convertTable } from './modules/table-conversion-plugins.js';

// Auto-detect and convert
const result = convertTable(blocks, { pageWidth: 595, pageHeight: 842 });

// Available plugins:
// - InvoiceTablePlugin (invoices, receipts)
// - FinancialTablePlugin (balance sheets)
// - ScientificTablePlugin (research tables)
// - TimetablePlugin (schedules)
```

---

## Architecture Notes

### Module Communication
- **Direct imports** for tightly coupled modules (render-controller → tile-renderer)
- **Event bus** for loosely coupled notifications (file:opened, ocr:done)
- **Dependency injection** via `initXxxDeps()` to avoid circular imports

### State Management
- **state.js** — Proxy-based reactive state with batch updates
- **localStorage** — UI layout, settings, recent files
- **IndexedDB** — OCR cache, workspace data, large blobs

### Cleanup Lifecycle
- `clearAllTimers()` on file open
- `destroyMinimap()`, `destroyTooltips()` on app shutdown
- AbortController for event listener cleanup
- Blob URL tracking and revocation
