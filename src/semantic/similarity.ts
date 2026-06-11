// ============================================================
// auk — AI Context Engineering Platform
// Similarity provider — pluggable interface; tfidf-v1 today,
// API embeddings could implement the same interface later.
// Persisted to .auk/semantic.json for reuse by `auk review`.
// ============================================================

import type { ParsedFile } from '../types/analysis.js';
import { tokenizeFile } from './tokenizer.js';
import { buildVectors, cosine, topTerms, type SparseVector, type VectorIndex } from './tfidf.js';
import { clusterFiles, type FileCluster } from './clusterer.js';

export type { FileCluster } from './clusterer.js';

export interface SimilarityProvider {
  readonly id: string;
  index(files: ParsedFile[]): void;
  similar(file: string, topK: number): Array<{ file: string; score: number }>;
  clusters(minSize?: number): FileCluster[];
  /** Serializable state for .auk/semantic.json */
  serialize(): SemanticIndexFile;
}

export interface SemanticIndexFile {
  version: 1;
  provider: string;
  threshold: number;
  vocab: string[];
  vectors: Record<string, Array<[number, number]>>;
  clusters: FileCluster[];
}

const MIN_FILES = 20;

export class TfidfProvider implements SimilarityProvider {
  readonly id = 'tfidf-v1';
  private idx: VectorIndex = { vocab: [], vectors: new Map() };
  private threshold = 0;
  private cachedClusters: FileCluster[] = [];

  index(files: ParsedFile[]): void {
    const docs = new Map<string, string[]>();
    for (const pf of [...files].sort((a, b) => a.entry.path.localeCompare(b.entry.path))) {
      docs.set(pf.entry.path, tokenizeFile(pf));
    }
    this.idx = buildVectors(docs);
    if (docs.size >= MIN_FILES) {
      const result = clusterFiles(this.idx);
      this.threshold = result.threshold;
      this.cachedClusters = result.clusters;
    } else {
      this.threshold = 0;
      this.cachedClusters = [];
    }
  }

  similar(file: string, topK: number): Array<{ file: string; score: number }> {
    const vec = this.idx.vectors.get(file);
    if (!vec) return [];
    const scores: Array<{ file: string; score: number }> = [];
    for (const [other, otherVec] of this.idx.vectors) {
      if (other === file) continue;
      const score = cosine(vec, otherVec);
      if (score > 0) scores.push({ file: other, score: Math.round(score * 1000) / 1000 });
    }
    return scores
      .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
      .slice(0, topK);
  }

  clusters(minSize = 4): FileCluster[] {
    return this.cachedClusters.filter(c => c.files.length >= minSize);
  }

  serialize(): SemanticIndexFile {
    const vectors: Record<string, Array<[number, number]>> = {};
    for (const file of [...this.idx.vectors.keys()].sort()) {
      vectors[file] = [...this.idx.vectors.get(file)!.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, w]) => [i, Math.round(w * 10000) / 10000]);
    }
    return {
      version: 1,
      provider: this.id,
      threshold: this.threshold,
      vocab: this.idx.vocab,
      vectors,
      clusters: this.cachedClusters,
    };
  }

  /** Rebuild a provider from a persisted semantic.json */
  static deserialize(data: SemanticIndexFile): TfidfProvider {
    const p = new TfidfProvider();
    const vectors = new Map<string, SparseVector>();
    for (const [file, entries] of Object.entries(data.vectors)) {
      vectors.set(file, new Map(entries));
    }
    p.idx = { vocab: data.vocab, vectors };
    p.threshold = data.threshold;
    p.cachedClusters = data.clusters;
    return p;
  }

  /** Similarity of an unindexed token bag (e.g. a new file in a diff) against the index.
      Query uses log-tf without idf — fine for ranking against stored ltc vectors. */
  similarToTokens(tokens: string[], topK: number): Array<{ file: string; score: number }> {
    const termIndex = new Map(this.idx.vocab.map((t, i) => [t, i]));
    const counts = new Map<number, number>();
    for (const t of tokens) {
      const idx = termIndex.get(t);
      if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    const query: SparseVector = new Map();
    let norm = 0;
    for (const [idx, c] of counts) {
      const w = 1 + Math.log(c);
      query.set(idx, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (const [idx, w] of query) query.set(idx, w / norm);

    const scores: Array<{ file: string; score: number }> = [];
    for (const [file, vec] of this.idx.vectors) {
      const score = cosine(query, vec);
      if (score > 0) scores.push({ file, score: Math.round(score * 1000) / 1000 });
    }
    return scores
      .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
      .slice(0, topK);
  }

  /** Top descriptive terms for a file (used in cluster labels and review hints) */
  describeFile(file: string): string[] {
    const vec = this.idx.vectors.get(file);
    return vec ? topTerms(vec, this.idx.vocab) : [];
  }
}
