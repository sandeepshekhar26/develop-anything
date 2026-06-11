// ============================================================
// auk — AI Context Engineering Platform
// Complexity tracker — tracks centrality growth
// ============================================================

import type { ComplexityChange } from '../types/review.js';
import type { DependencyGraph } from '../types/analysis.js';
import { loadJson, saveJson } from '../utils/config.js';
import { logger } from '../utils/logger.js';

interface MetricsSnapshot {
  timestamp: string;
  metrics: Record<string, { degree: number; betweenness: number }>;
}

interface MetricsHistory {
  version: number;
  snapshots: MetricsSnapshot[];
}

/** Save current metrics snapshot */
export function saveMetricsSnapshot(graph: DependencyGraph, projectRoot: string): void {
  const history = loadJson<MetricsHistory>('metrics.json', projectRoot) || {
    version: 1,
    snapshots: [],
  };

  const metrics: Record<string, { degree: number; betweenness: number }> = {};
  for (const node of graph.nodes) {
    metrics[node.id] = { ...node.centrality };
  }

  history.snapshots.push({
    timestamp: new Date().toISOString(),
    metrics,
  });

  // Keep last 50 snapshots
  if (history.snapshots.length > 50) {
    history.snapshots = history.snapshots.slice(-50);
  }

  saveJson('metrics.json', history, projectRoot);
  logger.debug(`Saved metrics snapshot (${Object.keys(metrics).length} nodes)`);
}

/** Get complexity trend for a file */
export function getComplexityTrend(file: string, projectRoot: string): Array<{ timestamp: string; degree: number }> {
  const history = loadJson<MetricsHistory>('metrics.json', projectRoot);
  if (!history) return [];

  return history.snapshots
    .map(s => ({
      timestamp: s.timestamp,
      degree: s.metrics[file]?.degree || 0,
    }))
    .filter(s => s.degree > 0);
}
