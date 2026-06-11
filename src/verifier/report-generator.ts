// ============================================================
// auk — AI Context Engineering Platform
// Verification report generator
// ============================================================

import type { HealthReport } from '../types/rules.js';
import { logger } from '../utils/logger.js';
import { generateBadgeUrl } from './health-scorer.js';

/** Print a colored verification report to the terminal */
export function printHealthReport(report: HealthReport): void {
  logger.header('Context Health Report');
  console.log();

  // Score display
  const scoreColor = report.overallScore >= 90 ? '🟢' : report.overallScore >= 60 ? '🟡' : '🔴';
  console.log(`  ${scoreColor} Overall Health Score: ${report.overallScore}/100`);
  console.log();

  // Summary
  logger.keyValue('Total Rules', report.totalRules);
  if (report.valid > 0)    logger.ruleStatus('valid', `${report.valid} rules are valid`);
  if (report.degraded > 0) logger.ruleStatus('degraded', `${report.degraded} rules are degraded`);
  if (report.violated > 0) logger.ruleStatus('violated', `${report.violated} rules are violated`);
  if (report.obsolete > 0) logger.ruleStatus('obsolete', `${report.obsolete} rules are obsolete`);
  console.log();

  // Details for non-valid rules
  const issues = report.results.filter(r => r.status !== 'valid');
  if (issues.length > 0) {
    logger.header('Issues Found');
    for (const issue of issues) {
      const icon = issue.status === 'degraded' ? '⚠️' : issue.status === 'violated' ? '❌' : '💀';
      console.log(`  ${icon} ${issue.ruleId}`);
      console.log(`     ${issue.details}`);
      console.log(`     Score: ${Math.round(issue.score * 100)}%`);
      console.log();
    }
  }

  // Badge suggestion
  console.log(`  📛 Badge: ${generateBadgeUrl(report.overallScore)}`);
  console.log();
}

/** Generate a markdown report */
export function generateMarkdownReport(report: HealthReport): string {
  const lines: string[] = [];

  lines.push(`# Context Health Report`);
  lines.push('');
  lines.push(`**Score:** ${report.overallScore}/100`);
  lines.push(`**Generated:** ${report.timestamp}`);
  lines.push('');
  lines.push(`| Status | Count |`);
  lines.push(`|:--|:--|`);
  lines.push(`| ✅ Valid | ${report.valid} |`);
  lines.push(`| ⚠️ Degraded | ${report.degraded} |`);
  lines.push(`| ❌ Violated | ${report.violated} |`);
  lines.push(`| 💀 Obsolete | ${report.obsolete} |`);
  lines.push('');

  const issues = report.results.filter(r => r.status !== 'valid');
  if (issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const issue of issues) {
      const icon = issue.status === 'degraded' ? '⚠️' : issue.status === 'violated' ? '❌' : '💀';
      lines.push(`### ${icon} ${issue.ruleId}`);
      lines.push(`- **Status:** ${issue.status}`);
      lines.push(`- **Score:** ${Math.round(issue.score * 100)}%`);
      lines.push(`- **Details:** ${issue.details}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
