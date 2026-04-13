// @ts-check
// ─── Decision Tree Classifier (ID3) ────────────────────────────────────────
// A simple ID3-style decision tree that splits on the attribute with the
// highest information gain at each node. Supports categorical and numeric
// attributes (numeric attributes are discretised with a median split).

// ─── Types ────────────────────────────────────────────────────────────────────

/** A training or prediction sample: attribute names map to string or number values. */
export type Sample = Record<string, string | number>;

/** Internal tree node: either a leaf or an attribute split. */
interface TreeNode {
  /** If this is a leaf, the predicted label value. */
  label?: string | number;
  /** The attribute this node splits on (undefined for leaves). */
  attribute?: string;
  /** For categorical splits: maps attribute value → child node. */
  children?: Map<string, TreeNode>;
  /** For numeric splits: threshold (median), with ≤ going left and > going right. */
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

// ─── Entropy ─────────────────────────────────────────────────────────────────

/**
 * Compute the Shannon entropy of `data` with respect to `labelKey`.
 * Returns 0 for empty datasets.
 */
export function entropy(data: Sample[], labelKey: string): number {
  if (data.length === 0) return 0;

  const counts = new Map<string | number, number>();
  for (const sample of data) {
    const v = sample[labelKey];
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  let h = 0;
  const total = data.length;
  for (const count of counts.values()) {
    const p = count / total;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

// ─── Information Gain ────────────────────────────────────────────────────────

/**
 * Compute the information gain of splitting `data` on `attribute` with
 * respect to `labelKey`. Numeric attributes use a median-based binary split.
 */
export function informationGain(
  data: Sample[],
  attribute: string,
  labelKey: string,
): number {
  if (data.length === 0) return 0;

  const parentEntropy = entropy(data, labelKey);

  // Determine if the attribute is numeric by inspecting the first value.
  const isNumeric = typeof data[0]?.[attribute] === 'number';

  if (isNumeric) {
    const sorted = data
      .map((s) => s[attribute] as number)
      .sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const left = data.filter((s) => (s[attribute] as number) <= median);
    const right = data.filter((s) => (s[attribute] as number) > median);

    const weightedEntropy =
      (left.length / data.length) * entropy(left, labelKey) +
      (right.length / data.length) * entropy(right, labelKey);

    return parentEntropy - weightedEntropy;
  }

  // Categorical attribute: one branch per unique value.
  const subsets = new Map<string | number, Sample[]>();
  for (const sample of data) {
    const v = sample[attribute];
    if (!subsets.has(v)) subsets.set(v, []);
    subsets.get(v)!.push(sample);
  }

  let weightedEntropy = 0;
  for (const subset of subsets.values()) {
    weightedEntropy += (subset.length / data.length) * entropy(subset, labelKey);
  }

  return parentEntropy - weightedEntropy;
}

// ─── Tree Building ───────────────────────────────────────────────────────────

function majorityLabel(data: Sample[], labelKey: string): string | number {
  const counts = new Map<string | number, number>();
  for (const sample of data) {
    const v = sample[labelKey];
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | number = data[0][labelKey];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function buildTree(
  data: Sample[],
  labelKey: string,
  attributes: string[],
): TreeNode {
  // All samples have the same label → leaf.
  const labels = new Set(data.map((s) => s[labelKey]));
  if (labels.size === 1) {
    return { label: data[0][labelKey] };
  }

  // No attributes left → majority vote.
  if (attributes.length === 0) {
    return { label: majorityLabel(data, labelKey) };
  }

  // Pick the attribute with the highest information gain.
  let bestAttr = attributes[0];
  let bestGain = -Infinity;
  for (const attr of attributes) {
    const gain = informationGain(data, attr, labelKey);
    if (gain > bestGain) {
      bestGain = gain;
      bestAttr = attr;
    }
  }

  const remainingAttrs = attributes.filter((a) => a !== bestAttr);
  const isNumeric = typeof data[0]?.[bestAttr] === 'number';

  if (isNumeric) {
    const sorted = data
      .map((s) => s[bestAttr] as number)
      .sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length / 2)];

    const leftData = data.filter((s) => (s[bestAttr] as number) <= threshold);
    const rightData = data.filter((s) => (s[bestAttr] as number) > threshold);

    // If one side is empty, we cannot split further.
    if (leftData.length === 0 || rightData.length === 0) {
      return { label: majorityLabel(data, labelKey) };
    }

    return {
      attribute: bestAttr,
      threshold,
      left: buildTree(leftData, labelKey, remainingAttrs),
      right: buildTree(rightData, labelKey, remainingAttrs),
    };
  }

  // Categorical split.
  const children = new Map<string, TreeNode>();
  const subsets = new Map<string, Sample[]>();
  for (const sample of data) {
    const v = String(sample[bestAttr]);
    if (!subsets.has(v)) subsets.set(v, []);
    subsets.get(v)!.push(sample);
  }

  for (const [value, subset] of subsets) {
    children.set(value, buildTree(subset, labelKey, remainingAttrs));
  }

  return { attribute: bestAttr, children };
}

function predictNode(node: TreeNode, sample: Sample): string | number | null {
  // Leaf node.
  if (node.label !== undefined) return node.label;

  const attr = node.attribute!;

  // Numeric split.
  if (node.threshold !== undefined) {
    const v = sample[attr];
    if (v === undefined) return null;
    return (v as number) <= node.threshold
      ? predictNode(node.left!, sample)
      : predictNode(node.right!, sample);
  }

  // Categorical split.
  const v = String(sample[attr]);
  const child = node.children?.get(v);
  if (!child) return null;
  return predictNode(child, sample);
}

// ─── DecisionTree Class ──────────────────────────────────────────────────────

export class DecisionTree {
  private root: TreeNode | null = null;

  constructor() {
    // intentionally empty
  }

  /** Whether the tree has been trained. */
  get isTrained(): boolean {
    return this.root !== null;
  }

  /**
   * Train the decision tree on the given data using ID3.
   * `labelKey` is the name of the attribute that contains the class label.
   */
  train(data: Sample[], labelKey: string): void {
    if (data.length === 0) {
      throw new Error('Cannot train on empty dataset');
    }

    const attributes = Object.keys(data[0]).filter((k) => k !== labelKey);
    this.root = buildTree(data, labelKey, attributes);
  }

  /**
   * Predict the label for `sample`. Returns `null` if the tree has not been
   * trained or if the sample leads to an unknown branch.
   */
  predict(sample: Sample): string | number | null {
    if (!this.root) return null;
    return predictNode(this.root, sample);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new DecisionTree instance. */
export function createDecisionTree(): DecisionTree {
  return new DecisionTree();
}
