// @ts-check
// ─── Plugin System ────────────────────────────────────────────────────────────
// Lightweight plugin/extension system with dependency resolution,
// service registry, and cross-plugin event bus.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Plugin {
  id: string;
  name: string;
  version?: string;
  dependencies?: string[];  // ids of required plugins
  install(api: PluginAPI): void;
  uninstall?(): void;
}

export interface PluginAPI {
  /** Register a named service. */
  register(name: string, impl: unknown): void;
  /** Get a registered service. */
  get(name: string): unknown;
  /** Emit an event to all plugins. */
  emit(event: string, data?: unknown): void;
  /** Subscribe to events from other plugins. */
  on(event: string, handler: (data: unknown) => void): () => void;
}

// ─── PluginSystem ─────────────────────────────────────────────────────────────

export class PluginSystem {
  #plugins: Map<string, Plugin> = new Map();
  #installOrder: string[] = [];
  #services: Map<string, unknown> = new Map();
  #eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

  /** Install a plugin (respects dependency order). */
  install(plugin: Plugin): void {
    // Idempotent: skip if already installed
    if (this.#plugins.has(plugin.id)) return;

    // Install dependencies first
    for (const depId of plugin.dependencies ?? []) {
      if (!this.#plugins.has(depId)) {
        throw new Error(
          `Plugin "${plugin.id}" depends on "${depId}" which is not installed. ` +
          `Install "${depId}" first, or provide it as a dependency object.`,
        );
      }
    }

    this.#plugins.set(plugin.id, plugin);
    this.#installOrder.push(plugin.id);

    const api = this.#makeApi();
    plugin.install(api);
  }

  /** Uninstall a plugin by id. */
  uninstall(id: string): void {
    const plugin = this.#plugins.get(id);
    if (!plugin) return;

    plugin.uninstall?.();
    this.#plugins.delete(id);
    const idx = this.#installOrder.indexOf(id);
    if (idx !== -1) this.#installOrder.splice(idx, 1);
  }

  /** Check if plugin is installed. */
  has(id: string): boolean {
    return this.#plugins.has(id);
  }

  /** Get installed plugin ids in install order. */
  installedIds(): string[] {
    return this.#installOrder.slice();
  }

  /** Get a service registered by any plugin. */
  getService(name: string): unknown {
    return this.#services.get(name);
  }

  /** Emit event to all plugin handlers. */
  emit(event: string, data?: unknown): void {
    const handlers = this.#eventHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(data);
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  #makeApi(): PluginAPI {
    const system = this;
    return {
      register(name: string, impl: unknown): void {
        system.#services.set(name, impl);
      },
      get(name: string): unknown {
        return system.#services.get(name);
      },
      emit(event: string, data?: unknown): void {
        system.emit(event, data);
      },
      on(event: string, handler: (data: unknown) => void): () => void {
        let handlers = system.#eventHandlers.get(event);
        if (!handlers) {
          handlers = new Set();
          system.#eventHandlers.set(event, handlers);
        }
        handlers.add(handler);
        return () => {
          system.#eventHandlers.get(event)?.delete(handler);
        };
      },
    };
  }
}
