import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';

// In-memory store for active watchers
const activeWatchers = new Map<string, fs.FSWatcher>();

function log(message: string) {
  console.log(`[watch-file-changes] ${message}`);
}

export default function watchFileChanges(server: McpServer) {
  server.registerTool(
    'watch-file-changes',
    {
      title: 'Watch File/Directory Changes',
      description: 'Starts or stops watching a file or directory for changes and executes a command upon detection.',
      inputSchema: {
        action: z.enum(['start', 'stop']).describe('The action to perform: start or stop watching.'),
        target_path: z.string().describe('The file or directory path to watch.'),
        command: z.string().optional().describe('The shell command to execute when a change is detected (required for "start").'),
        recursive: z.boolean().optional().default(false).describe('Watch subdirectories recursively (for "start").'),
      },
    },
    async (params: { action: 'start' | 'stop'; target_path: string; command?: string; recursive?: boolean }) => {
      const { action, target_path, command, recursive } = params;
      const normalizedPath = path.resolve(target_path);

      if (action === 'start') {
        if (!command) {
          return { content: [{ type: 'text', text: 'Error: A command must be provided to start watching.' }], isError: true };
        }
        if (activeWatchers.has(normalizedPath)) {
          return { content: [{ type: 'text', text: `Already watching path: ${normalizedPath}. Stop it first.` }], isError: true };
        }
        if (!fs.existsSync(normalizedPath)) {
            return { content: [{ type: 'text', text: `Error: Path does not exist: ${normalizedPath}` }], isError: true };
        }

        try {
          const watcher = fs.watch(normalizedPath, { recursive }, (eventType, filename) => {
            if (filename) {
              log(`Change detected (${eventType}) in ${filename}. Executing command: ${command}`);
              exec(command, (error, stdout, stderr) => {
                if (error) {
                  log(`Error executing command: ${error.message}`);
                  return;
                }
                if (stderr) {
                  log(`Command stderr: ${stderr}`);
                }
                log(`Command stdout: ${stdout}`);
              });
            }
          });

          watcher.on('error', (error) => {
            log(`Watcher error for ${normalizedPath}: ${error.message}`);
            activeWatchers.delete(normalizedPath);
          });

          activeWatchers.set(normalizedPath, watcher);
          log(`Started watching ${normalizedPath}`);
          return { content: [{ type: 'text', text: `Started watching for changes in ${normalizedPath}.` }] };
        } catch (error: any) {
            return { content: [{ type: 'text', text: `Failed to start watcher: ${error.message}` }], isError: true };
        }
      }

      if (action === 'stop') {
        const watcher = activeWatchers.get(normalizedPath);
        if (!watcher) {
          return { content: [{ type: 'text', text: `No active watcher found for path: ${normalizedPath}` }], isError: true };
        }

        watcher.close();
        activeWatchers.delete(normalizedPath);
        log(`Stopped watching ${normalizedPath}`);
        return { content: [{ type: 'text', text: `Stopped watching for changes in ${normalizedPath}.` }] };
      }

      return { content: [{ type: 'text', text: 'Invalid action specified.' }], isError: true };
    }
  );
}
