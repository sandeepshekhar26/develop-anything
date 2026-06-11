// ============================================================
// auk — AI Context Engineering Platform
// Graph overlay — maps diff changes onto dependency graph
// ============================================================

import type { DiffFile } from '../types/review.js';
import type { DependencyGraph, ImportEdge } from '../types/analysis.js';
import type { NewEdge, ComplexityChange } from '../types/review.js';

/** Overlay diff changes onto the existing dependency graph */
export function overlayDiffOnGraph(
  diffFiles: DiffFile[],
  graph: DependencyGraph
): { newEdges: NewEdge[]; complexityChanges: ComplexityChange[] } {
  const newEdges: NewEdge[] = [];
  const complexityChanges: ComplexityChange[] = [];

  // Build adjacency lookup
  const existingEdges = new Set(graph.edges.map(e => `${e.source}->${e.target}`));
  const layerMap = new Map<string, string>();
  for (const node of graph.nodes) {
    layerMap.set(node.id, node.layer);
  }

  // Build boundary rules lookup
  const allowedBoundaries = new Map<string, boolean>();
  for (const boundary of graph.boundaries) {
    allowedBoundaries.set(`${boundary.from}->${boundary.to}`, boundary.allowed);
  }

  for (const file of diffFiles) {
    if (file.status === 'deleted') continue;

    // Parse added imports to detect new edges
    for (const importLine of file.addedImports) {
      const sourceMatch = importLine.match(/from\s+['"]([^'"]+)['"]/);
      const requireMatch = importLine.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      const target = sourceMatch?.[1] || requireMatch?.[1];

      if (!target || !target.startsWith('.')) continue;

      // Resolve relative import (simplified)
      const edgeKey = `${file.path}->${target}`;
      if (!existingEdges.has(edgeKey)) {
        const sourceLayer = layerMap.get(file.path) || 'unknown';
        const targetLayer = layerMap.get(target) || 'unknown';
        const boundaryKey = `${sourceLayer}->${targetLayer}`;
        const crossesBoundary = allowedBoundaries.has(boundaryKey) && !allowedBoundaries.get(boundaryKey);

        // Check for cycles (simplified — check if reverse edge exists)
        const reverseKey = `${target}->${file.path}`;
        const createsCycle = existingEdges.has(reverseKey);

        newEdges.push({
          source: file.path,
          target,
          symbols: [],
          crossesBoundary,
          createsCycle,
        });
      }
    }

    // Check complexity changes
    const existingNode = graph.nodes.find(n => n.id === file.path);
    if (existingNode) {
      const addedImportCount = file.addedImports.length;
      const removedImportCount = file.removedImports.length;
      const netChange = addedImportCount - removedImportCount;

      if (netChange !== 0) {
        const newDegree = existingNode.centrality.degree + netChange;
        complexityChanges.push({
          file: file.path,
          before: { ...existingNode.centrality },
          after: { degree: newDegree, betweenness: existingNode.centrality.betweenness },
          degreeChange: netChange,
          isGodObjectRisk: newDegree >= 8,
        });
      }
    }
  }

  return { newEdges, complexityChanges };
}
