// @ts-check
// ─── Singly and Doubly Linked Lists ─────────────────────────────────────────
// Generic linked list implementations with full iteration support and
// in-place reversal. Both classes use private class fields (#) throughout.

// ─── Internal Node Types ─────────────────────────────────────────────────────

interface SinglyNode<T> {
  value: T;
  next: SinglyNode<T> | null;
}

interface DoublyNode<T> {
  value: T;
  next: DoublyNode<T> | null;
  prev: DoublyNode<T> | null;
}

// ─── LinkedList (singly-linked) ──────────────────────────────────────────────

export class LinkedList<T> {
  #head: SinglyNode<T> | null = null;
  #tail: SinglyNode<T> | null = null;
  #size: number = 0;

  // ── Accessors ───────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  get head(): T | undefined {
    return this.#head?.value;
  }

  get tail(): T | undefined {
    return this.#tail?.value;
  }

  // ── Insertion ───────────────────────────────────────────────────────────────

  /** Add a value to the front of the list. */
  prepend(value: T): void {
    const node: SinglyNode<T> = { value, next: this.#head };
    this.#head = node;
    if (this.#tail === null) this.#tail = node;
    this.#size++;
  }

  /** Add a value to the end of the list. */
  append(value: T): void {
    const node: SinglyNode<T> = { value, next: null };
    if (this.#tail === null) {
      this.#head = node;
      this.#tail = node;
    } else {
      this.#tail.next = node;
      this.#tail = node;
    }
    this.#size++;
  }

  /**
   * Insert a value at the given index (0-based).
   * Throws RangeError if index < 0 or index > size.
   */
  insertAt(index: number, value: T): void {
    if (index < 0 || index > this.#size) {
      throw new RangeError(`Index ${index} is out of bounds for size ${this.#size}`);
    }
    if (index === 0) {
      this.prepend(value);
      return;
    }
    if (index === this.#size) {
      this.append(value);
      return;
    }
    let prev = this.#head!;
    for (let i = 0; i < index - 1; i++) {
      prev = prev.next!;
    }
    const node: SinglyNode<T> = { value, next: prev.next };
    prev.next = node;
    this.#size++;
  }

  // ── Removal ─────────────────────────────────────────────────────────────────

  /** Remove and return the head value, or undefined if empty. */
  removeHead(): T | undefined {
    if (this.#head === null) return undefined;
    const value = this.#head.value;
    this.#head = this.#head.next;
    if (this.#head === null) this.#tail = null;
    this.#size--;
    return value;
  }

  /** Remove and return the tail value, or undefined if empty. */
  removeTail(): T | undefined {
    if (this.#tail === null) return undefined;
    const value = this.#tail.value;
    if (this.#head === this.#tail) {
      // Single element
      this.#head = null;
      this.#tail = null;
      this.#size--;
      return value;
    }
    // Walk to the second-to-last node
    let prev = this.#head!;
    while (prev.next !== this.#tail) {
      prev = prev.next!;
    }
    prev.next = null;
    this.#tail = prev;
    this.#size--;
    return value;
  }

  /** Remove and return the value at the given index, or undefined if out of bounds. */
  removeAt(index: number): T | undefined {
    if (index < 0 || index >= this.#size) return undefined;
    if (index === 0) return this.removeHead();
    if (index === this.#size - 1) return this.removeTail();
    let prev = this.#head!;
    for (let i = 0; i < index - 1; i++) {
      prev = prev.next!;
    }
    const target = prev.next!;
    prev.next = target.next;
    this.#size--;
    return target.value;
  }

  /**
   * Remove the first occurrence of value from the list.
   * Returns true if found and removed, false otherwise.
   */
  removeValue(value: T): boolean {
    if (this.#head === null) return false;
    if (this.#head.value === value) {
      this.removeHead();
      return true;
    }
    let prev = this.#head;
    let current = this.#head.next;
    while (current !== null) {
      if (current.value === value) {
        prev.next = current.next;
        if (current === this.#tail) this.#tail = prev;
        this.#size--;
        return true;
      }
      prev = current;
      current = current.next;
    }
    return false;
  }

  // ── Access ───────────────────────────────────────────────────────────────────

  /** Return the value at the given index, or undefined if out of bounds. */
  getAt(index: number): T | undefined {
    if (index < 0 || index >= this.#size) return undefined;
    let current = this.#head!;
    for (let i = 0; i < index; i++) {
      current = current.next!;
    }
    return current.value;
  }

  /** Return the index of the first occurrence of value, or -1 if not found. */
  indexOf(value: T): number {
    let current = this.#head;
    let index = 0;
    while (current !== null) {
      if (current.value === value) return index;
      current = current.next;
      index++;
    }
    return -1;
  }

  /** Return true if the list contains value. */
  contains(value: T): boolean {
    return this.indexOf(value) !== -1;
  }

  // ── Conversion ───────────────────────────────────────────────────────────────

  /** Return all values as an array from head to tail. */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.#head;
    while (current !== null) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  /** Replace the list contents with the values in arr. */
  fromArray(arr: T[]): void {
    this.clear();
    for (const item of arr) {
      this.append(item);
    }
  }

  /** Remove all elements from the list. */
  clear(): void {
    this.#head = null;
    this.#tail = null;
    this.#size = 0;
  }

  // ── Transformation ───────────────────────────────────────────────────────────

  /** Reverse the list in place. */
  reverse(): void {
    if (this.#size <= 1) return;
    this.#tail = this.#head;
    let prev: SinglyNode<T> | null = null;
    let current: SinglyNode<T> | null = this.#head;
    while (current !== null) {
      const next = current.next;
      current.next = prev;
      prev = current;
      current = next;
    }
    this.#head = prev;
  }

  // ── Iteration ────────────────────────────────────────────────────────────────

  [Symbol.iterator](): Iterator<T> {
    let current = this.#head;
    return {
      next(): IteratorResult<T> {
        if (current === null) return { value: undefined as unknown as T, done: true };
        const value = current.value;
        current = current.next;
        return { value, done: false };
      },
    };
  }
}

// ─── DoublyLinkedList ────────────────────────────────────────────────────────

export class DoublyLinkedList<T> {
  #head: DoublyNode<T> | null = null;
  #tail: DoublyNode<T> | null = null;
  #size: number = 0;

  // ── Accessors ───────────────────────────────────────────────────────────────

  get size(): number {
    return this.#size;
  }

  get head(): T | undefined {
    return this.#head?.value;
  }

  get tail(): T | undefined {
    return this.#tail?.value;
  }

  // ── Insertion ───────────────────────────────────────────────────────────────

  /** Add a value to the front of the list. */
  prepend(value: T): void {
    const node: DoublyNode<T> = { value, next: this.#head, prev: null };
    if (this.#head !== null) this.#head.prev = node;
    this.#head = node;
    if (this.#tail === null) this.#tail = node;
    this.#size++;
  }

  /** Add a value to the end of the list. */
  append(value: T): void {
    const node: DoublyNode<T> = { value, next: null, prev: this.#tail };
    if (this.#tail !== null) {
      this.#tail.next = node;
    } else {
      this.#head = node;
    }
    this.#tail = node;
    this.#size++;
  }

  /**
   * Insert a value at the given index (0-based).
   * Throws RangeError if index < 0 or index > size.
   */
  insertAt(index: number, value: T): void {
    if (index < 0 || index > this.#size) {
      throw new RangeError(`Index ${index} is out of bounds for size ${this.#size}`);
    }
    if (index === 0) {
      this.prepend(value);
      return;
    }
    if (index === this.#size) {
      this.append(value);
      return;
    }
    // Walk from the closer end
    let current: DoublyNode<T>;
    if (index <= this.#size / 2) {
      current = this.#head!;
      for (let i = 0; i < index; i++) current = current.next!;
    } else {
      current = this.#tail!;
      for (let i = this.#size - 1; i > index; i--) current = current.prev!;
    }
    const node: DoublyNode<T> = { value, next: current, prev: current.prev };
    if (current.prev !== null) current.prev.next = node;
    current.prev = node;
    this.#size++;
  }

  // ── Removal ─────────────────────────────────────────────────────────────────

  /** Remove and return the head value, or undefined if empty. */
  removeHead(): T | undefined {
    if (this.#head === null) return undefined;
    const value = this.#head.value;
    this.#head = this.#head.next;
    if (this.#head !== null) {
      this.#head.prev = null;
    } else {
      this.#tail = null;
    }
    this.#size--;
    return value;
  }

  /** Remove and return the tail value, or undefined if empty. */
  removeTail(): T | undefined {
    if (this.#tail === null) return undefined;
    const value = this.#tail.value;
    this.#tail = this.#tail.prev;
    if (this.#tail !== null) {
      this.#tail.next = null;
    } else {
      this.#head = null;
    }
    this.#size--;
    return value;
  }

  /** Remove and return the value at the given index, or undefined if out of bounds. */
  removeAt(index: number): T | undefined {
    if (index < 0 || index >= this.#size) return undefined;
    if (index === 0) return this.removeHead();
    if (index === this.#size - 1) return this.removeTail();
    let current: DoublyNode<T>;
    if (index <= this.#size / 2) {
      current = this.#head!;
      for (let i = 0; i < index; i++) current = current.next!;
    } else {
      current = this.#tail!;
      for (let i = this.#size - 1; i > index; i--) current = current.prev!;
    }
    if (current.prev !== null) current.prev.next = current.next;
    if (current.next !== null) current.next.prev = current.prev;
    this.#size--;
    return current.value;
  }

  /**
   * Remove the first occurrence of value from the list.
   * Returns true if found and removed, false otherwise.
   */
  removeValue(value: T): boolean {
    let current = this.#head;
    while (current !== null) {
      if (current.value === value) {
        if (current === this.#head) {
          this.removeHead();
        } else if (current === this.#tail) {
          this.removeTail();
        } else {
          if (current.prev !== null) current.prev.next = current.next;
          if (current.next !== null) current.next.prev = current.prev;
          this.#size--;
        }
        return true;
      }
      current = current.next;
    }
    return false;
  }

  // ── Access ───────────────────────────────────────────────────────────────────

  /** Return the value at the given index, or undefined if out of bounds. */
  getAt(index: number): T | undefined {
    if (index < 0 || index >= this.#size) return undefined;
    let current: DoublyNode<T>;
    if (index <= this.#size / 2) {
      current = this.#head!;
      for (let i = 0; i < index; i++) current = current.next!;
    } else {
      current = this.#tail!;
      for (let i = this.#size - 1; i > index; i--) current = current.prev!;
    }
    return current.value;
  }

  /** Return the index of the first occurrence of value, or -1 if not found. */
  indexOf(value: T): number {
    let current = this.#head;
    let index = 0;
    while (current !== null) {
      if (current.value === value) return index;
      current = current.next;
      index++;
    }
    return -1;
  }

  /** Return true if the list contains value. */
  contains(value: T): boolean {
    return this.indexOf(value) !== -1;
  }

  // ── Conversion ───────────────────────────────────────────────────────────────

  /** Return all values as an array from head to tail. */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.#head;
    while (current !== null) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  /** Return all values as an array from tail to head. */
  toArrayReverse(): T[] {
    const result: T[] = [];
    let current = this.#tail;
    while (current !== null) {
      result.push(current.value);
      current = current.prev;
    }
    return result;
  }

  /** Replace the list contents with the values in arr. */
  fromArray(arr: T[]): void {
    this.clear();
    for (const item of arr) {
      this.append(item);
    }
  }

  /** Remove all elements from the list. */
  clear(): void {
    this.#head = null;
    this.#tail = null;
    this.#size = 0;
  }

  /** Reverse the list in place. */
  reverse(): void {
    if (this.#size <= 1) return;
    let current: DoublyNode<T> | null = this.#head;
    while (current !== null) {
      const next = current.next;
      current.next = current.prev;
      current.prev = next;
      current = next;
    }
    const oldHead = this.#head;
    this.#head = this.#tail;
    this.#tail = oldHead;
  }

  // ── Iteration ────────────────────────────────────────────────────────────────

  [Symbol.iterator](): Iterator<T> {
    let current = this.#head;
    return {
      next(): IteratorResult<T> {
        if (current === null) return { value: undefined as unknown as T, done: true };
        const value = current.value;
        current = current.next;
        return { value, done: false };
      },
    };
  }
}

// ─── Factories ───────────────────────────────────────────────────────────────

/** Create a new LinkedList, optionally pre-populated with items. */
export function createLinkedList<T>(items?: T[]): LinkedList<T> {
  const list = new LinkedList<T>();
  if (items) list.fromArray(items);
  return list;
}

/** Create a new DoublyLinkedList, optionally pre-populated with items. */
export function createDoublyLinkedList<T>(items?: T[]): DoublyLinkedList<T> {
  const list = new DoublyLinkedList<T>();
  if (items) list.fromArray(items);
  return list;
}
