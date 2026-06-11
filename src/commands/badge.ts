// ============================================================
// auk — AI Context Engineering Platform
// `auk badge` — generate a context-health badge
//
// Writes .auk/badge.json (shields.io endpoint schema) and an
// optional self-contained SVG, so repos can show context health
// the way they show test coverage.
// ============================================================

import * as path from 'path';
import { Command } from '../utils/cli.js';
import { loadJson, saveJson, getAukDir } from '../utils/config.js';
import { writeFileWithDir } from '../utils/file-utils.js';
import type { HealthReport } from '../types/rules.js';
import { logger } from '../utils/logger.js';

function badgeColor(score: number): string {
  if (score >= 90) return 'brightgreen';
  if (score >= 75) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

const SVG_COLORS: Record<string, string> = {
  brightgreen: '#4c1',
  green: '#97ca00',
  yellow: '#dfb317',
  orange: '#fe7d37',
  red: '#e05d44',
};

function renderSvg(label: string, message: string, color: string): string {
  const labelWidth = 6 * label.length + 14;
  const messageWidth = 6 * message.length + 14;
  const total = labelWidth + messageWidth;
  const fill = SVG_COLORS[color] || color;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}: ${message}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${fill}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>
`;
}

export const badgeCommand = new Command('badge')
  .description('Generate a context-health badge (shields.io endpoint JSON + SVG)')
  .option('--svg', 'Also write a standalone SVG badge to .auk/badge.svg')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const report = loadJson<HealthReport>('health.json', projectRoot);

    if (!report) {
      logger.warn('No health report found. Run `auk verify` first.');
      process.exit(1);
    }

    const score = report.overallScore;
    const color = badgeColor(score);

    // shields.io endpoint schema — point shields at the raw file URL:
    // https://img.shields.io/endpoint?url=<raw-url-to-.auk/badge.json>
    const endpoint = {
      schemaVersion: 1,
      label: 'context health',
      message: `${score}%`,
      color,
    };
    saveJson('badge.json', endpoint, projectRoot);
    logger.success(`Badge endpoint → ${path.join(getAukDir(projectRoot), 'badge.json')}`);

    if (options.svg) {
      const svgPath = path.join(getAukDir(projectRoot), 'badge.svg');
      writeFileWithDir(svgPath, renderSvg('context health', `${score}%`, color));
      logger.success(`Badge SVG → ${svgPath}`);
    }

    console.log();
    logger.info('Add to your README:');
    console.log();
    console.log('  Static (updates when you commit a re-verified badge.json):');
    console.log('  ![Context Health](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/<owner>/<repo>/main/.auk/badge.json)');
    console.log();
    console.log(`  Quick static badge for the current score:`);
    console.log(`  ![Context Health](https://img.shields.io/badge/context--health-${score}%25-${color})`);
    console.log();
  });
