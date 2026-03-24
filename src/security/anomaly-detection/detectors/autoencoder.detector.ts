import { Injectable, Logger } from '@nestjs/common';
import { AutoencoderConfig, DEFAULT_CONFIG } from '../interfaces/anomaly-config.interface';
import { FEATURE_COUNT } from '../utils/behavior-profiler';

/**
 * Autoencoder for unsupervised anomaly detection.
 *
 * Architecture: encoder → bottleneck → decoder (symmetric).
 * Trained only on "normal" data; high reconstruction error indicates anomaly.
 *
 * Score: reconstruction error percentile relative to training errors (0-1).
 */
@Injectable()
export class AutoencoderDetector {
  private readonly logger = new Logger(AutoencoderDetector.name);

  private config: AutoencoderConfig;
  private weights: number[][][];   // [layer][neuron][input]
  private biases: number[][];      // [layer][neuron]
  private trainErrors: number[] = [];
  private _isFitted = false;

  constructor(config: Partial<AutoencoderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG.autoencoder, ...config };
    this.weights = [];
    this.biases = [];
  }

  isFitted(): boolean {
    return this._isFitted;
  }

  /**
   * Trains the autoencoder on normal-behaviour feature vectors.
   * @param data Matrix [samples × FEATURE_COUNT], values should be in [0,1].
   */
  fit(data: number[][]): void {
    if (data.length < this.config.batchSize) {
      this.logger.warn(`Autoencoder requires at least ${this.config.batchSize} samples`);
      return;
    }

    const layerSizes = this.buildLayerSizes();
    this.initWeights(layerSizes);

    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      const shuffled = this.shuffle(data);
      let epochLoss = 0;

      for (let b = 0; b < shuffled.length; b += this.config.batchSize) {
        const batch = shuffled.slice(b, b + this.config.batchSize);
        epochLoss += this.trainBatch(batch, layerSizes);
      }

      if (epoch % 10 === 0) {
        this.logger.debug(`Epoch ${epoch}: loss=${(epochLoss / data.length).toFixed(6)}`);
      }
    }

    // Capture reconstruction error distribution on training data
    this.trainErrors = data.map((x) => this.reconstructionError(x)).sort((a, b) => a - b);

    this._isFitted = true;
    this.logger.log(
      `Autoencoder fitted on ${data.length} samples, ` +
        `p95 error=${this.percentile(this.trainErrors, 0.95).toFixed(4)}`,
    );
  }

  /**
   * Returns anomaly score 0-1 for a single sample.
   * Score is the percentile of the sample's reconstruction error within training errors.
   */
  score(sample: number[]): number {
    if (!this._isFitted) return 0.5;
    const err = this.reconstructionError(sample);
    return this.errorToScore(err);
  }

  /**
   * Returns per-feature reconstruction contributions (higher = more anomalous).
   */
  featureContributions(sample: number[]): number[] {
    const reconstruction = this.forward(sample);
    return sample.map((v, i) => Math.abs(v - reconstruction[i]));
  }

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      weights: this.weights,
      biases: this.biases,
      trainErrors: this.trainErrors,
      isFitted: this._isFitted,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = data.config as AutoencoderConfig;
    this.weights = data.weights as number[][][];
    this.biases = data.biases as number[][];
    this.trainErrors = data.trainErrors as number[];
    this._isFitted = data.isFitted as boolean;
  }

  // ── Architecture helpers ───────────────────────────────────────────────────

  /**
   * Full encoder + decoder layer sizes.
   * Encoder: [input, ...encoderDims]
   * Decoder: [...encoderDims reversed, input]
   */
  private buildLayerSizes(): number[] {
    const encoder = [FEATURE_COUNT, ...this.config.encoderDims];
    const decoder = [...[...this.config.encoderDims].reverse(), FEATURE_COUNT];
    // Share middle dim — encoder last = decoder first
    return [...encoder, ...decoder.slice(1)];
  }

  private initWeights(layerSizes: number[]): void {
    this.weights = [];
    this.biases = [];

    for (let l = 1; l < layerSizes.length; l++) {
      const fanIn = layerSizes[l - 1];
      const fanOut = layerSizes[l];
      // Xavier / Glorot initialisation
      const limit = Math.sqrt(6 / (fanIn + fanOut));

      const w: number[][] = [];
      for (let j = 0; j < fanOut; j++) {
        w.push(Array.from({ length: fanIn }, () => (Math.random() * 2 - 1) * limit));
      }
      this.weights.push(w);
      this.biases.push(new Array(fanOut).fill(0));
    }
  }

  // ── Forward / backward pass ────────────────────────────────────────────────

  private forward(input: number[]): number[] {
    let activation = [...input];

    for (let l = 0; l < this.weights.length; l++) {
      const isLastLayer = l === this.weights.length - 1;
      const next: number[] = [];

      for (let j = 0; j < this.weights[l].length; j++) {
        let z = this.biases[l][j];
        for (let i = 0; i < activation.length; i++) {
          z += this.weights[l][j][i] * activation[i];
        }
        next.push(isLastLayer ? this.sigmoid(z) : this.relu(z));
      }

      activation = next;
    }

    return activation;
  }

  /** Full forward pass with stored activations for backprop. */
  private forwardWithCache(input: number[]): { activations: number[][] } {
    const activations: number[][] = [input];
    let current = [...input];

    for (let l = 0; l < this.weights.length; l++) {
      const isLastLayer = l === this.weights.length - 1;
      const next: number[] = [];

      for (let j = 0; j < this.weights[l].length; j++) {
        let z = this.biases[l][j];
        for (let i = 0; i < current.length; i++) {
          z += this.weights[l][j][i] * current[i];
        }
        next.push(isLastLayer ? this.sigmoid(z) : this.relu(z));
      }

      current = next;
      activations.push(current);
    }

    return { activations };
  }

  private trainBatch(batch: number[][], layerSizes: number[]): number {
    const numLayers = this.weights.length;
    // Accumulate gradients
    const dW: number[][][] = this.weights.map((layer) =>
      layer.map((neuron) => new Array(neuron.length).fill(0)),
    );
    const dB: number[][] = this.biases.map((layer) => new Array(layer.length).fill(0));

    let totalLoss = 0;

    for (const x of batch) {
      const { activations } = this.forwardWithCache(x);
      const output = activations[activations.length - 1];

      // MSE loss
      const loss = output.reduce((s, o, i) => s + Math.pow(o - x[i], 2), 0) / x.length;
      totalLoss += loss;

      // Output layer delta (MSE + sigmoid)
      let delta: number[] = output.map((o, i) => {
        const dLoss = 2 * (o - x[i]) / x.length;
        return dLoss * this.sigmoidDeriv(o);
      });

      // Backpropagate through layers
      for (let l = numLayers - 1; l >= 0; l--) {
        const prevActivation = activations[l];

        for (let j = 0; j < this.weights[l].length; j++) {
          dB[l][j] += delta[j];
          for (let i = 0; i < prevActivation.length; i++) {
            dW[l][j][i] += delta[j] * prevActivation[i];
          }
        }

        // Propagate delta to previous layer (skip for input layer)
        if (l > 0) {
          const prevAct = activations[l]; // post-activation of layer l-1
          const newDelta: number[] = new Array(this.weights[l][0].length).fill(0);
          for (let i = 0; i < newDelta.length; i++) {
            for (let j = 0; j < delta.length; j++) {
              newDelta[i] += delta[j] * this.weights[l][j][i];
            }
            newDelta[i] *= this.reluDeriv(activations[l][i] ?? 0);
          }
          delta = newDelta;
        }
      }
    }

    // Apply averaged gradients
    const batchSize = batch.length;
    const lr = this.config.learningRate;

    for (let l = 0; l < numLayers; l++) {
      for (let j = 0; j < this.weights[l].length; j++) {
        this.biases[l][j] -= lr * dB[l][j] / batchSize;
        for (let i = 0; i < this.weights[l][j].length; i++) {
          this.weights[l][j][i] -= lr * dW[l][j][i] / batchSize;
        }
      }
    }

    return totalLoss;
  }

  // ── Scoring helpers ────────────────────────────────────────────────────────

  private reconstructionError(sample: number[]): number {
    const reconstruction = this.forward(sample);
    return reconstruction.reduce((s, v, i) => s + Math.pow(v - sample[i], 2), 0) / sample.length;
  }

  /**
   * Maps a reconstruction error to a 0-1 anomaly score
   * using empirical CDF of training errors.
   */
  private errorToScore(err: number): number {
    if (this.trainErrors.length === 0) return 0.5;
    let lo = 0;
    let hi = this.trainErrors.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.trainErrors[mid] <= err) lo = mid + 1;
      else hi = mid;
    }
    return Math.min(1, lo / this.trainErrors.length);
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
    return sorted[idx];
  }

  // ── Activation functions ───────────────────────────────────────────────────

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private reluDeriv(x: number): number {
    return x > 0 ? 1 : 0;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-88, Math.min(88, x))));
  }

  private sigmoidDeriv(sigOut: number): number {
    return sigOut * (1 - sigOut);
  }

  // ── Misc ───────────────────────────────────────────────────────────────────

  private shuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
