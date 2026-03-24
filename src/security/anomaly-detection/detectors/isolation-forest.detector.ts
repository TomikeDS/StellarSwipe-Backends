import { Injectable, Logger } from '@nestjs/common';
import { IsolationForestConfig, DEFAULT_CONFIG } from '../interfaces/anomaly-config.interface';
import { FEATURE_NAMES, FEATURE_COUNT } from '../utils/behavior-profiler';

interface IsolationTreeNode {
  featureIndex: number;
  splitValue: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
  size: number;        // Number of samples in this leaf
  isLeaf: boolean;
}

interface IsolationTree {
  root: IsolationTreeNode;
  heightLimit: number;
}

/**
 * Isolation Forest for unsupervised anomaly detection.
 *
 * Each tree isolates samples by randomly selecting a feature and a split
 * value. Anomalies require fewer splits to isolate (shorter path length).
 *
 * Score: 0 = normal, 1 = highly anomalous.
 */
@Injectable()
export class IsolationForestDetector {
  private readonly logger = new Logger(IsolationForestDetector.name);
  private trees: IsolationTree[] = [];
  private config: IsolationForestConfig;
  private _isFitted = false;

  constructor(config: Partial<IsolationForestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG.isolationForest, ...config };
  }

  isFitted(): boolean {
    return this._isFitted;
  }

  /**
   * Fits the forest on a matrix of feature vectors (rows = samples, cols = features).
   */
  fit(data: number[][]): void {
    if (data.length < 2) {
      this.logger.warn('Isolation Forest requires at least 2 samples');
      return;
    }

    const heightLimit = Math.ceil(Math.log2(this.config.subsampleSize));
    this.trees = [];

    for (let t = 0; t < this.config.nTrees; t++) {
      const sample = this.subsample(data, this.config.subsampleSize);
      const tree = this.buildTree(sample, 0, heightLimit);
      this.trees.push({ root: tree, heightLimit });
    }

    this._isFitted = true;
    this.logger.log(
      `Isolation Forest fitted on ${data.length} samples with ${this.trees.length} trees`,
    );
  }

  /**
   * Returns anomaly score 0-1 for a single sample.
   * Score > contamination threshold → anomaly.
   */
  score(sample: number[]): number {
    if (!this._isFitted || this.trees.length === 0) return 0.5;

    const avgPathLength =
      this.trees.reduce((sum, tree) => sum + this.pathLength(sample, tree.root, 0), 0) /
      this.trees.length;

    const n = this.config.subsampleSize;
    const cn = this.avgPathLengthOfUnsuccessfulBST(n);

    // Isolation Forest score formula: 2^(-avgPathLength / cn)
    const rawScore = Math.pow(2, -avgPathLength / cn);
    return Math.max(0, Math.min(1, rawScore));
  }

  /**
   * Scores a batch of samples and returns scores sorted by anomaly level.
   */
  scoreBatch(samples: number[][]): Array<{ index: number; score: number }> {
    return samples
      .map((s, i) => ({ index: i, score: this.score(s) }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Returns feature importance as contribution per feature (higher = more anomalous split).
   * Computed via the fraction of splits made on each feature across all trees.
   */
  featureImportance(): Record<string, number> {
    const counts = new Array(FEATURE_COUNT).fill(0);
    let total = 0;

    const countSplits = (node: IsolationTreeNode): void => {
      if (node.isLeaf) return;
      counts[node.featureIndex]++;
      total++;
      if (node.left) countSplits(node.left);
      if (node.right) countSplits(node.right);
    };

    for (const tree of this.trees) countSplits(tree.root);

    const importance: Record<string, number> = {};
    for (let i = 0; i < FEATURE_COUNT; i++) {
      importance[FEATURE_NAMES[i]] = total > 0 ? counts[i] / total : 0;
    }
    return importance;
  }

  serialize(): Record<string, any> {
    return { config: this.config, trees: this.trees, isFitted: this._isFitted };
  }

  deserialize(data: Record<string, any>): void {
    this.config = data.config;
    this.trees = data.trees;
    this._isFitted = data.isFitted;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildTree(
    data: number[][],
    currentHeight: number,
    heightLimit: number,
  ): IsolationTreeNode {
    if (currentHeight >= heightLimit || data.length <= 1) {
      return { featureIndex: 0, splitValue: 0, size: data.length, isLeaf: true };
    }

    // Pick a random feature
    const featureIndex = Math.floor(Math.random() * (this.config.maxFeatures ?? FEATURE_COUNT));
    const values = data.map((row) => row[featureIndex]);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return { featureIndex, splitValue: min, size: data.length, isLeaf: true };
    }

    const splitValue = min + Math.random() * (max - min);

    const left = data.filter((row) => row[featureIndex] < splitValue);
    const right = data.filter((row) => row[featureIndex] >= splitValue);

    return {
      featureIndex,
      splitValue,
      size: data.length,
      isLeaf: false,
      left: this.buildTree(left, currentHeight + 1, heightLimit),
      right: this.buildTree(right, currentHeight + 1, heightLimit),
    };
  }

  private pathLength(
    sample: number[],
    node: IsolationTreeNode,
    currentDepth: number,
  ): number {
    if (node.isLeaf) {
      return currentDepth + this.avgPathLengthOfUnsuccessfulBST(node.size);
    }

    if (sample[node.featureIndex] < node.splitValue) {
      return this.pathLength(sample, node.left!, currentDepth + 1);
    }
    return this.pathLength(sample, node.right!, currentDepth + 1);
  }

  /** Expected path length in a random BST with n nodes */
  private avgPathLengthOfUnsuccessfulBST(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  private subsample(data: number[][], size: number): number[][] {
    const n = Math.min(size, data.length);
    const indices = new Set<number>();
    while (indices.size < n) {
      indices.add(Math.floor(Math.random() * data.length));
    }
    return [...indices].map((i) => data[i]);
  }
}
