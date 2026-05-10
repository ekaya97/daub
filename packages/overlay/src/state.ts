import type { ElementContext } from '@daub/core';

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type DaubState = 'IDLE' | 'PICKING' | 'CAPTURED' | 'PANEL_OPEN';

const VALID_TRANSITIONS: Record<DaubState, DaubState[]> = {
  IDLE: ['PICKING'],
  PICKING: ['CAPTURED', 'IDLE'],
  CAPTURED: ['PANEL_OPEN'],
  PANEL_OPEN: ['IDLE'],
};

// ---------------------------------------------------------------------------
// Event emitter types
// ---------------------------------------------------------------------------

export interface DaubEventMap {
  stateChange: [from: DaubState, to: DaubState];
  elementSelected: [el: HTMLElement];
  cancel: [];
}

type EventHandler<T extends unknown[]> = (...args: T) => void;

// ---------------------------------------------------------------------------
// DaubStore
// ---------------------------------------------------------------------------

export class DaubStore {
  state: DaubState = 'IDLE';
  element: HTMLElement | null = null;
  screenshotBefore: string | null = null;
  croppedScreenshot: string | null = null;
  elementContext: ElementContext | null = null;

  private listeners: Map<string, Set<Function>> = new Map();

  // -- State transitions ----------------------------------------------------

  transition(to: DaubState): void {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(to)) {
      throw new Error(
        `[DaubStore] Illegal transition: ${this.state} → ${to}. ` +
          `Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const from = this.state;
    this.state = to;
    this.emit('stateChange', from, to);
  }

  reset(): void {
    this.state = 'IDLE';
    this.element = null;
    this.screenshotBefore = null;
    this.croppedScreenshot = null;
    this.elementContext = null;
  }

  // -- Typed event emitter --------------------------------------------------

  on<K extends keyof DaubEventMap>(
    event: K,
    handler: EventHandler<DaubEventMap[K]>,
  ): void;
  on(event: string, handler: Function): void;
  on(event: string, handler: Function): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  off<K extends keyof DaubEventMap>(
    event: K,
    handler: EventHandler<DaubEventMap[K]>,
  ): void;
  off(event: string, handler: Function): void;
  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof DaubEventMap>(
    event: K,
    ...args: DaubEventMap[K]
  ): void;
  emit(event: string, ...args: unknown[]): void;
  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(...args);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStore(): DaubStore {
  return new DaubStore();
}
