export enum DetectorType {
  ISOLATION_FOREST = 'ISOLATION_FOREST',
  AUTOENCODER = 'AUTOENCODER',
  STATISTICAL_OUTLIER = 'STATISTICAL_OUTLIER',
}

export enum AnomalyCategory {
  WASH_TRADING = 'WASH_TRADING',
  MARKET_MANIPULATION = 'MARKET_MANIPULATION',
  PUMP_AND_DUMP = 'PUMP_AND_DUMP',
  LAYERING = 'LAYERING',
  SPOOFING = 'SPOOFING',
  UNUSUAL_TRADING_PATTERN = 'UNUSUAL_TRADING_PATTERN',
  COORDINATED_ACTIVITY = 'COORDINATED_ACTIVITY',
  VOLUME_ANOMALY = 'VOLUME_ANOMALY',
}

export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface IsolationForestConfig {
  nTrees: number;           // Number of isolation trees (default 100)
  subsampleSize: number;    // Samples per tree (default 256)
  contamination: number;    // Expected fraction of outliers 0-0.5 (default 0.05)
  maxFeatures: number;      // Max features per tree split (default all)
}

export interface AutoencoderConfig {
  encoderDims: number[];    // Hidden layer sizes for encoder (default [32, 16, 8])
  learningRate: number;     // (default 0.001)
  epochs: number;           // Training epochs (default 50)
  batchSize: number;        // (default 32)
  reconstructionThreshold: number; // Error percentile above which = anomaly (default 0.95)
}

export interface StatisticalOutlierConfig {
  zScoreThreshold: number;  // Standard deviations from mean (default 3.0)
  madThreshold: number;     // Median Absolute Deviations (default 3.5) — more robust
  iqrMultiplier: number;    // IQR fence multiplier (default 1.5)
  minSamples: number;       // Minimum samples before detection (default 30)
  windowDays: number;       // Rolling window in days (default 30)
}

export interface AnomalyDetectionConfig {
  isolationForest: IsolationForestConfig;
  autoencoder: AutoencoderConfig;
  statisticalOutlier: StatisticalOutlierConfig;
  ensembleWeights: {
    isolationForest: number;  // default 0.4
    autoencoder: number;      // default 0.35
    statistical: number;      // default 0.25
  };
}

export const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  isolationForest: {
    nTrees: 100,
    subsampleSize: 256,
    contamination: 0.05,
    maxFeatures: 17,
  },
  autoencoder: {
    encoderDims: [32, 16, 8],
    learningRate: 0.001,
    epochs: 50,
    batchSize: 32,
    reconstructionThreshold: 0.95,
  },
  statisticalOutlier: {
    zScoreThreshold: 3.0,
    madThreshold: 3.5,
    iqrMultiplier: 1.5,
    minSamples: 30,
    windowDays: 30,
  },
  ensembleWeights: {
    isolationForest: 0.40,
    autoencoder: 0.35,
    statistical: 0.25,
  },
};
