// ============================================================
// auk — AI Context Engineering Platform
// Architectural layer detector
// ============================================================

import * as path from 'path';
import type { ParsedFile, ArchLayer, LayerClassification } from '../types/analysis.js';

/** Layer detection rules based on directory names */
const LAYER_DIR_PATTERNS: Record<string, ArchLayer> = {
  'controllers': 'controller',
  'controller': 'controller',
  'routes': 'api',
  'api': 'api',
  'endpoints': 'api',
  'handlers': 'api',
  'services': 'service',
  'service': 'service',
  'usecases': 'service',
  'use-cases': 'service',
  'models': 'model',
  'model': 'model',
  'entities': 'model',
  'schemas': 'model',
  'repositories': 'data',
  'repository': 'data',
  'data': 'data',
  'db': 'data',
  'database': 'data',
  'dal': 'data',
  'components': 'ui',
  'views': 'ui',
  'pages': 'ui',
  'ui': 'ui',
  'screens': 'ui',
  'layouts': 'ui',
  'widgets': 'ui',
  'utils': 'utility',
  'util': 'utility',
  'helpers': 'utility',
  'lib': 'utility',
  'shared': 'utility',
  'common': 'utility',
  'config': 'config',
  'configs': 'config',
  'configuration': 'config',
  'settings': 'config',
  'constants': 'config',
  'tests': 'test',
  'test': 'test',
  '__tests__': 'test',
  'spec': 'test',
  'middleware': 'api',
  'interceptors': 'api',
  'guards': 'api',
  'pipes': 'api',
  'decorators': 'utility',
  'hooks': 'ui',
  'store': 'data',
  'stores': 'data',
  'state': 'data',
  'reducers': 'data',
  'actions': 'data',
  'types': 'model',
  'interfaces': 'model',
  'dtos': 'model',
};

/** Classify a file into an architectural layer */
export function classifyFile(parsedFile: ParsedFile): LayerClassification {
  const filePath = parsedFile.entry.path;
  const parts = filePath.split('/');
  const signals: string[] = [];
  let detectedLayer: ArchLayer = 'unknown';
  let confidence = 0;

  // 1. Check directory name signals
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (LAYER_DIR_PATTERNS[lower]) {
      detectedLayer = LAYER_DIR_PATTERNS[lower];
      signals.push(`directory "${part}" → ${detectedLayer}`);
      confidence = 0.8;
      break;
    }
  }

  // 2. Check filename patterns
  const basename = path.basename(filePath, path.extname(filePath)).toLowerCase();

  if (basename.includes('.test') || basename.includes('.spec') || basename.includes('_test')) {
    detectedLayer = 'test';
    signals.push(`filename contains test pattern`);
    confidence = Math.max(confidence, 0.9);
  }

  if (basename.includes('.controller') || basename.includes('controller')) {
    detectedLayer = 'controller';
    signals.push(`filename contains "controller"`);
    confidence = Math.max(confidence, 0.85);
  }

  if (basename.includes('.service') || basename.includes('service')) {
    detectedLayer = 'service';
    signals.push(`filename contains "service"`);
    confidence = Math.max(confidence, 0.85);
  }

  if (basename.includes('.model') || basename.includes('.entity') || basename.includes('.schema')) {
    detectedLayer = 'model';
    signals.push(`filename contains model pattern`);
    confidence = Math.max(confidence, 0.85);
  }

  if (basename.includes('.repo') || basename.includes('repository')) {
    detectedLayer = 'data';
    signals.push(`filename contains repository pattern`);
    confidence = Math.max(confidence, 0.85);
  }

  // 3. Check import patterns for layer hints
  const importsFromLayers = new Map<ArchLayer, number>();
  for (const imp of parsedFile.imports) {
    for (const [dir, layer] of Object.entries(LAYER_DIR_PATTERNS)) {
      if (imp.source.includes(dir)) {
        importsFromLayers.set(layer, (importsFromLayers.get(layer) || 0) + 1);
      }
    }
  }

  if (detectedLayer === 'unknown' && importsFromLayers.size > 0) {
    // If a file imports from data layer, it's likely service or higher
    if (importsFromLayers.has('data') || importsFromLayers.has('model')) {
      detectedLayer = 'service';
      signals.push('imports from data/model layer suggest service layer');
      confidence = 0.5;
    }
  }

  // 4. Check export patterns
  const hasExportedClass = parsedFile.symbols.some(s => s.exported && s.type === 'class');
  const hasExportedFunctions = parsedFile.symbols.some(s => s.exported && s.type === 'function');

  if (detectedLayer === 'unknown') {
    // Config files typically export constants
    if (basename === 'config' || basename === 'constants' || basename === 'env') {
      detectedLayer = 'config';
      signals.push('filename suggests configuration');
      confidence = 0.7;
    }

    // Utility files typically export many small functions
    if (hasExportedFunctions && parsedFile.symbols.filter(s => s.exported && s.type === 'function').length > 3) {
      detectedLayer = 'utility';
      signals.push('many exported functions suggest utility module');
      confidence = 0.4;
    }
  }

  return {
    file: filePath,
    layer: detectedLayer,
    confidence,
    signals,
  };
}

/** Classify all files */
export function classifyFiles(parsedFiles: ParsedFile[]): LayerClassification[] {
  return parsedFiles.map(classifyFile);
}

/** Build layer map from classifications */
export function buildLayerMap(classifications: LayerClassification[]): Map<string, ArchLayer> {
  const map = new Map<string, ArchLayer>();
  for (const c of classifications) {
    map.set(c.file, c.layer);
  }
  return map;
}
