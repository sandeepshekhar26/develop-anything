// ============================================================
// auk — AI Context Engineering Platform
// Deterministic file clustering — connected components over a
// cosine-similarity graph, with an adaptive threshold so output
// is neither one giant blob nor all singletons. The chosen
// threshold is recorded for reproducibility.
// ============================================================

import { cosine, topTerms, type VectorIndex } from './tfidf.js';

export interface FileCluster {
  id: string;
  label: string;            // top shared terms, e.g. "auth-handler"
  files: string[];
  topTerms: string[];
  cohesion: number;         // mean pairwise similarity
}

const START_THRESHOLD = 0.45;
const MIN_THRESHOLD = 0.3;
const MAX_THRESHOLD = 0.7;

export function clusterFiles(idx: VectorIndex): { threshold: number; clusters: FileCluster[] } {
  const files = [...idx.vectors.keys()].sort();
  const n = files.length;

  // Pairwise similarities once; thresholds reuse this matrix
  const sims: Array<{ a: number; b: number; score: number }> = [];
  for (let i = 0; i < n; i++) {
    const vi = idx.vectors.get(files[i])!;
    for (let j = i + 1; j < n; j++) {
      const score = cosine(vi, idx.vectors.get(files[j])!);
      if (score >= MIN_THRESHOLD) sims.push({ a: i, b: j, score });
    }
  }

  // Adaptive threshold: raise while one component swallows the repo,
  // then lower while almost nothing clusters. Both walks are bounded,
  // so the result is deterministic for a given corpus.
  const stats = (t: number) => {
    const comps = components(n, sims, t);
    return {
      largest: Math.max(0, ...comps.map(c => c.length)),
      clustered: comps.filter(c => c.length >= 2).reduce((s, c) => s + c.length, 0),
    };
  };
  let threshold = START_THRESHOLD;
  while (threshold < MAX_THRESHOLD && stats(threshold).largest > n * 0.6) {
    threshold = Math.round((threshold + 0.05) * 100) / 100;
  }
  while (threshold > MIN_THRESHOLD && stats(threshold).clustered < n * 0.1) {
    threshold = Math.round((threshold - 0.05) * 100) / 100;
  }

  const comps = components(n, sims, threshold)
    .filter(c => c.length >= 2)
    .map(c => c.sort((a, b) => a - b));
  comps.sort((a, b) => b.length - a.length || a[0] - b[0]);

  const clusters: FileCluster[] = comps.map((comp, i) => {
    const memberFiles = comp.map(idx2 => files[idx2]);
    // mean pairwise similarity inside the component
    let total = 0, pairs = 0;
    for (let x = 0; x < comp.length; x++) {
      for (let y = x + 1; y < comp.length; y++) {
        total += cosine(idx.vectors.get(memberFiles[x])!, idx.vectors.get(memberFiles[y])!);
        pairs++;
      }
    }
    // shared terms: sum member vectors, take the top
    const summed = new Map<number, number>();
    for (const f of memberFiles) {
      for (const [t, w] of idx.vectors.get(f)!) summed.set(t, (summed.get(t) ?? 0) + w);
    }
    const terms = topTerms(summed, idx.vocab, 3);
    return {
      id: `cluster-${i + 1}`,
      label: terms.slice(0, 2).join('-') || `cluster-${i + 1}`,
      files: memberFiles,
      topTerms: terms,
      cohesion: pairs ? Math.round((total / pairs) * 1000) / 1000 : 0,
    };
  });

  return { threshold, clusters };
}

/** Connected components of the similarity graph at a threshold (union-find) */
function components(n: number, sims: Array<{ a: number; b: number; score: number }>, threshold: number): number[][] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const { a, b, score } of sims) {
    if (score >= threshold) parent[find(a)] = find(b);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }
  return [...groups.values()];
}
