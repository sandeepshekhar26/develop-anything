// ============================================================
// auk — AI Context Engineering Platform
// Configuration management
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONFIG } from '../types/config.js';
import type { AukConfig } from '../types/config.js';
import * as yamlLib from './yaml.js';
import { logger } from './logger.js';

const AUK_DIR = '.auk';
const CONFIG_FILE = 'config.yaml';

/** Get the .auk directory path */
export function getAukDir(projectRoot: string = process.cwd()): string {
  return path.join(projectRoot, AUK_DIR);
}

/** Ensure the .auk directory exists */
export function ensureAukDir(projectRoot: string = process.cwd()): string {
  const aukDir = getAukDir(projectRoot);
  if (!fs.existsSync(aukDir)) {
    fs.mkdirSync(aukDir, { recursive: true });
  }
  return aukDir;
}

/** Check if auk is initialized in the given directory */
export function isInitialized(projectRoot: string = process.cwd()): boolean {
  return fs.existsSync(path.join(getAukDir(projectRoot), CONFIG_FILE));
}

/** Load configuration from .auk/config.yaml */
export async function loadConfig(projectRoot: string = process.cwd()): Promise<AukConfig> {
  const configPath = path.join(getAukDir(projectRoot), CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    logger.debug('No config found, using defaults');
    const config = { ...DEFAULT_CONFIG };
    config.project.root = projectRoot;
    config.project.name = path.basename(projectRoot);
    return config;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const loaded = yamlLib.load(content) as Partial<AukConfig>;
    return { ...DEFAULT_CONFIG, ...loaded, project: { ...DEFAULT_CONFIG.project, ...loaded?.project } };
  } catch (err) {
    logger.warn(`Failed to parse config: ${err}. Using defaults.`);
    return { ...DEFAULT_CONFIG };
  }
}

/** Save configuration to .auk/config.yaml */
export async function saveConfig(config: AukConfig, projectRoot: string = process.cwd()): Promise<void> {
  const aukDir = ensureAukDir(projectRoot);
  const configPath = path.join(aukDir, CONFIG_FILE);

  try {
    const content = yamlLib.dump(config);
    fs.writeFileSync(configPath, content, 'utf-8');
    logger.debug(`Config saved to ${configPath}`);
  } catch (err) {
    logger.error(`Failed to save config: ${err}`);
    throw err;
  }
}

/** Load a YAML file from .auk/ */
export async function loadYaml<T>(filename: string, projectRoot: string = process.cwd()): Promise<T | null> {
  const filePath = path.join(getAukDir(projectRoot), filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return yamlLib.load(content) as T;
  } catch (err) {
    logger.warn(`Failed to parse ${filename}: ${err}`);
    return null;
  }
}

/** Save a YAML file to .auk/ */
export async function saveYaml<T>(filename: string, data: T, projectRoot: string = process.cwd()): Promise<void> {
  const aukDir = ensureAukDir(projectRoot);
  const filePath = path.join(aukDir, filename);

  try {
    const content = yamlLib.dump(data);
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    logger.error(`Failed to save ${filename}: ${err}`);
    throw err;
  }
}

/** Load JSON file from .auk/ */
export function loadJson<T>(filename: string, projectRoot: string = process.cwd()): T | null {
  const filePath = path.join(getAukDir(projectRoot), filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/** Save JSON file to .auk/ */
export function saveJson<T>(filename: string, data: T, projectRoot: string = process.cwd()): void {
  const aukDir = ensureAukDir(projectRoot);
  fs.writeFileSync(path.join(aukDir, filename), JSON.stringify(data, null, 2), 'utf-8');
}
