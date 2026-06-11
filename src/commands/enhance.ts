// ============================================================
// auk — AI Context Engineering Platform
// `auk enhance` — host-agent LLM enhancement workflow.
//   --emit   write prompt batches to .auk/prompts/
//   --apply  validate + merge an agent-written response JSON
// ============================================================

import * as fs from 'fs';
import { Command } from '../utils/cli.js';
import { loadYaml, saveYaml } from '../utils/config.js';
import { emitPrompts, rulesNeedingEnhancement } from '../generator/prompt-emitter.js';
import { parseEnhancementResponse, applyEnhancements } from '../generator/enhancement-validator.js';
import type { RulesFile } from '../types/rules.js';
import { logger } from '../utils/logger.js';

export const enhanceCommand = new Command('enhance')
  .description('LLM-enhance rule descriptions via your AI agent (no API key needed)')
  .option('--emit', 'Write enhancement prompt files to .auk/prompts/')
  .option('--apply <file>', 'Validate and merge an agent-written response JSON')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const rulesFile = await loadYaml<RulesFile>('rules.yaml', projectRoot);
    if (!rulesFile) {
      logger.error('No rules found. Run `auk generate` first.');
      process.exit(1);
    }

    if (options.apply) {
      const responsePath = String(options.apply);
      if (!fs.existsSync(responsePath)) {
        logger.error(`Response file not found: ${responsePath}`);
        process.exit(1);
      }
      let response;
      try {
        response = parseEnhancementResponse(fs.readFileSync(responsePath, 'utf-8'));
      } catch (err) {
        logger.error(`Invalid enhancement response: ${(err as Error).message}`);
        process.exit(1);
      }
      const result = applyEnhancements(response, rulesFile, projectRoot);
      await saveYaml('rules.yaml', rulesFile, projectRoot);
      logger.success(`Enhanced ${result.applied.length} rules → .auk/rules.yaml`);
      for (const s of result.skipped) {
        logger.warn(`Skipped ${s.ruleId}: ${s.reason}`);
      }
      if (result.applied.length > 0) {
        logger.info('Run `auk compile` to refresh agent context files.');
      }
      return;
    }

    // default / --emit: write prompt batches
    const pending = rulesNeedingEnhancement(rulesFile);
    if (pending.length === 0) {
      logger.success('All rules are already enhanced and up to date.');
      return;
    }
    const files = emitPrompts(rulesFile, projectRoot);
    logger.success(`Wrote ${files.length} prompt batch${files.length > 1 ? 'es' : ''} for ${pending.length} rules → .auk/prompts/`);
    logger.info('Have your AI agent process each prompt file, then run `auk enhance --apply <response.json>`.');
  });
