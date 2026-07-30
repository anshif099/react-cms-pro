export interface HistorySnapshot<T> {
  id: string;
  timestamp: number;
  label: string;
  value: T;
}

export interface HistoryBranch<T> {
  id: string;
  name: string;
  createdAt: number;
  entries: HistorySnapshot<T>[];
  index: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function snapshotId() {
  return `history_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class HistoryEngine<T> {
  private entries: HistorySnapshot<T>[] = [];
  private index = -1;
  private maxEntries: number;
  private branches = new Map<string, HistoryBranch<T>>();
  private activeBranch = 'main';

  constructor(initialValue?: T, options: { maxEntries?: number; label?: string } = {}) {
    this.maxEntries = options.maxEntries || 100;
    if (initialValue !== undefined) this.reset(initialValue, options.label || 'Initial state');
  }

  reset(value: T, label = 'Initial state') {
    this.entries = [{
      id: snapshotId(),
      timestamp: Date.now(),
      label,
      value: clone(value),
    }];
    this.index = 0;
    this.branches.clear();
    this.activeBranch = 'main';
    return clone(value);
  }

  push(value: T, label = 'Edit') {
    const current = this.current();
    if (current && JSON.stringify(current) === JSON.stringify(value)) return clone(value);
    this.entries = [
      ...this.entries.slice(0, this.index + 1),
      {
        id: snapshotId(),
        timestamp: Date.now(),
        label,
        value: clone(value),
      },
    ].slice(-this.maxEntries);
    this.index = this.entries.length - 1;
    return clone(value);
  }

  current(): T | null {
    const entry = this.entries[this.index];
    return entry ? clone(entry.value) : null;
  }

  undo(): T | null {
    if (!this.canUndo()) return this.current();
    this.index -= 1;
    return this.current();
  }

  redo(): T | null {
    if (!this.canRedo()) return this.current();
    this.index += 1;
    return this.current();
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index >= 0 && this.index < this.entries.length - 1;
  }

  restore(snapshotIdToRestore: string): T | null {
    const index = this.entries.findIndex((entry) => entry.id === snapshotIdToRestore);
    if (index < 0) return null;
    this.index = index;
    return this.current();
  }

  list(): HistorySnapshot<T>[] {
    return this.entries.map((entry) => ({ ...entry, value: clone(entry.value) }));
  }

  createBranch(name: string): HistoryBranch<T> {
    const id = `branch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const branch = {
      id,
      name,
      createdAt: Date.now(),
      entries: this.entries.map((entry) => ({ ...entry, value: clone(entry.value) })),
      index: this.index,
    };
    this.branches.set(id, branch);
    return branch;
  }

  checkoutBranch(branchId: string): T | null {
    if (branchId === 'main') {
      this.activeBranch = 'main';
      return this.current();
    }
    const branch = this.branches.get(branchId);
    if (!branch) return null;
    this.entries = branch.entries.map((entry) => ({ ...entry, value: clone(entry.value) }));
    this.index = branch.index;
    this.activeBranch = branchId;
    return this.current();
  }

  listBranches() {
    return [
      { id: 'main', name: 'Main', createdAt: this.entries[0]?.timestamp || Date.now() },
      ...Array.from(this.branches.values()).map(({ id, name, createdAt }) => ({ id, name, createdAt })),
    ];
  }

  getState() {
    return {
      index: this.index,
      length: this.entries.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      activeBranch: this.activeBranch,
    };
  }
}

export default HistoryEngine;
