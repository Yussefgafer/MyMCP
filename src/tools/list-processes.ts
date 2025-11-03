import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default function listProcesses(server: McpServer) {
  server.registerTool(
    'list-processes',
    {
      title: 'List Running Processes',
      description: 'Lists all running processes on the host system.',
      inputSchema: {},
    },
    async () => {
      try {
        let command: string;
        const platform = os.platform();

        if (platform === 'win32') {
          command = 'tasklist';
        } else if (platform === 'darwin' || platform === 'linux') {
          command = 'ps -e -o pid,ppid,command';
        } else {
          return {
            content: [{ type: 'text', text: `Error: Unsupported platform: ${platform}` }],
            isError: true,
          };
        }

        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
          return {
            content: [{ type: 'text', text: `Error listing processes: ${stderr}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: stdout }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `An error occurred: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
