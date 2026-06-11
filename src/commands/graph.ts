// ============================================================
// auk — AI Context Engineering Platform
// `auk graph` — self-contained interactive graph viewer.
//   default        write .auk/graph.html
//   --open         also open it in the default browser
//   --serve [port] serve it over http (node:http, no deps)
// ============================================================

import * as http from 'http';
import * as path from 'path';
import { execFile } from 'child_process';
import { Command } from '../utils/cli.js';
import { loadConfig, loadJson } from '../utils/config.js';
import { renderGraphHtml } from '../viewer/template.js';
import { writeFileWithDir } from '../utils/file-utils.js';
import type { DependencyGraph } from '../types/analysis.js';
import { logger } from '../utils/logger.js';

export const graphCommand = new Command('graph')
  .description('Render the dependency/call graph as an interactive HTML viewer')
  .option('--open', 'Open the viewer in your browser')
  .option('--serve [port]', 'Serve the viewer over http')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);
    const graph = loadJson<DependencyGraph>('graph.json', projectRoot);
    if (!graph) {
      logger.error('No dependency graph found. Run `auk generate` first.');
      process.exit(1);
    }

    const html = renderGraphHtml(graph, config.project.name || 'project');
    const outPath = path.join(projectRoot, '.auk', 'graph.html');
    writeFileWithDir(outPath, html);
    logger.success(`Graph viewer written to .auk/graph.html (${graph.nodes.length} files, ${(graph.symbols ?? []).length} symbols)`);

    if (options.serve) {
      const port = typeof options.serve === 'string' ? parseInt(options.serve, 10) || 4242 : 4242;
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      server.listen(port, () => {
        logger.success(`Serving graph at http://localhost:${port} — Ctrl-C to stop`);
        if (options.open) openInBrowser(`http://localhost:${port}`);
      });
      return;
    }

    if (options.open) openInBrowser(outPath);
  });

function openInBrowser(target: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', target] : [target];
  execFile(cmd, args, () => { /* best effort */ });
}
