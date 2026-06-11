// ============================================================
// auk — AI Context Engineering Platform
// Hand-rolled TF-IDF — sparse L2-normalized vectors + cosine.
// Deterministic: vocabulary is sorted, ties broken by term.
// ============================================================

/** Sparse vector: termIndex → weight (L2-normalized) */
export type SparseVector = Map<number, number>;

export interface VectorIndex {
  vocab: string[];                       // index → term (sorted)
  vectors: Map<string, SparseVector>;    // docId → vector
}

const MAX_VOCAB = 5000;

export function buildVectors(docs: Map<string, string[]>): VectorIndex {
  // Document frequency
  const df = new Map<string, number>();
  for (const tokens of docs.values()) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  // Cap vocabulary: keep highest-df terms, ties broken lexicographically
  const vocab = [...df.keys()]
    .sort((a, b) => (df.get(b)! - df.get(a)!) || a.localeCompare(b))
    .slice(0, MAX_VOCAB)
    .sort();
  const termIndex = new Map(vocab.map((t, i) => [t, i]));

  const n = docs.size;
  const vectors = new Map<string, SparseVector>();
  for (const [docId, tokens] of docs) {
    const counts = new Map<number, number>();
    for (const term of tokens) {
      const idx = termIndex.get(term);
      if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    const vec: SparseVector = new Map();
    let norm = 0;
    for (const [idx, count] of counts) {
      const term = vocab[idx];
      // smoothed idf: shared terms keep some weight even in small corpora
      const idf = 1 + Math.log(n / (df.get(term) ?? 1));
      const w = (1 + Math.log(count)) * idf;
      vec.set(idx, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (const [idx, w] of vec) vec.set(idx, w / norm);
    vectors.set(docId, vec);
  }

  return { vocab, vectors };
}

/** Cosine similarity of two L2-normalized sparse vectors */
export function cosine(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [idx, w] of small) {
    const w2 = large.get(idx);
    if (w2 !== undefined) dot += w * w2;
  }
  return dot;
}

/** Top weighted terms of a vector */
export function topTerms(vec: SparseVector, vocab: string[], k = 3): string[] {
  return [...vec.entries()]
    .sort((x, y) => y[1] - x[1] || vocab[x[0]].localeCompare(vocab[y[0]]))
    .slice(0, k)
    .map(([idx]) => vocab[idx]);
}
