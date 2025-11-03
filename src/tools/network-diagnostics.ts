import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { quote } from 'shell-quote';

const execPromise = promisify(exec);

export default function networkDiagnostics(server: McpServer) {
  server.registerTool(
    'network-diagnostics',
    {
      title: 'Network Diagnostics',
      description: 'Performs network diagnostic commands like ping, traceroute, and DNS lookup.',
      inputSchema: {
        action: z.enum(['ping', 'trace', 'lookup']).describe('The diagnostic action to perform.'),
        host: z.string().describe('The target hostname or IP address.'),
        options: z.string().optional().describe('A string of additional command-line options to pass to the command.'),
      },
    },
    async (params: { action: 'ping' | 'trace' | 'lookup'; host: string; options?: string }) => {
      const { action, host, options } = params;
      const platform = os.platform();
      let command: string;

      // Sanitize inputs
      const safeHost = quote([host]);
      const safeOptions = options ? options.split(' ').map(opt => quote([opt])).join(' ') : '';

      try {
        switch (action) {
          case 'ping':
            const pingCount = platform === 'win32' ? '-n 4' : '-c 4';
            command = `ping ${pingCount} ${safeOptions} ${safeHost}`;
            break;
          case 'trace':
            command = platform === 'win32' 
              ? `tracert ${safeOptions} ${safeHost}` 
              : `traceroute ${safeOptions} ${safeHost}`;
            break;
          case 'lookup':
            command = `nslookup ${safeOptions} ${safeHost}`;
            break;
          default:
            return { content: [{ type: 'text', text: 'Invalid action specified.' }], isError: true };
        }

        const { stdout, stderr } = await execPromise(command);
        let output = '';
        if (stdout) output += `STDOUT:\n${stdout}\n`;
        if (stderr) output += `STDERR:\n${stderr}\n`;

        return { content: [{ type: 'text', text: output || 'Command executed with no output.' }] };

      } catch (error: any) {
        let errorMessage = `Error during ${action}: ${error.message}\n`;
        if (error.stdout) errorMessage += `STDOUT:\n${error.stdout}\n`;
        if (error.stderr) errorMessage += `STDERR:\n${error.stderr}\n`;
        return {
          content: [{ type: 'text', text: errorMessage }],
          isError: true,
        };
      }
    }
  );
}
