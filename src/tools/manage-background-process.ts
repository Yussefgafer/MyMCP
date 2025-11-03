import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default function manageBackgroundProcess(server: McpServer) {
  server.registerTool(
    'manage-background-process',
    {
      title: 'Manage Background Process',
      description: 'Checks the status of or stops a process running in the background using its PID.',
      inputSchema: {
        pid: z.number().int().positive().describe('The Process ID (PID) of the process to manage.'),
        action: z.enum(['status', 'stop']).describe('The action to perform: "status" to check if it is running, "stop" to terminate it.'),
      },
    },
    async (params: { pid: number; action: 'status' | 'stop' }) => {
      const { pid, action } = params;
      const platform = os.platform();

      try {
        if (action === 'status') {
          if (platform === 'win32') {
            const { stdout } = await execPromise(`tasklist /FI "PID eq ${pid}"`);
            if (stdout.includes(pid.toString())) {
              return { content: [{ type: 'text', text: `Process with PID ${pid} is running.` }] };
            } else {
              return { content: [{ type: 'text', text: `Process with PID ${pid} is not found.` }] };
            }
          } else {
            // On POSIX systems, sending signal 0 tests for process existence.
            process.kill(pid, 0);
            return { content: [{ type: 'text', text: `Process with PID ${pid} is running.` }] };
          }
        }

        if (action === 'stop') {
          if (platform === 'win32') {
            await execPromise(`taskkill /PID ${pid} /F`);
          } else {
            process.kill(pid, 'SIGTERM');
          }
          return { content: [{ type: 'text', text: `Termination signal sent to process with PID ${pid}.` }] };
        }
        
        // This part should not be reached due to the enum validation
        return { content: [{ type: 'text', text: 'Invalid action.' }], isError: true };

      } catch (error: any) {
        if (error.code === 'ESRCH') {
          return { content: [{ type: 'text', text: `Process with PID ${pid} is not found.` }] };
        }
        return {
          content: [{ type: 'text', text: `An error occurred while managing PID ${pid}: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
