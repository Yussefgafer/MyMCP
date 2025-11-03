
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec as execPromise } from 'child_process';
import { quote } from 'shell-quote';

export default function registerManageSystemServiceTool(server: McpServer) {
  server.registerTool(
    'manage-system-service',
    {
      description: 'Manages systemd services on Linux (e.g., start, stop, check status). Requires sudo privileges for most actions.',
      inputSchema: {
        action: z.enum(['start', 'stop', 'restart', 'status', 'enable', 'disable'])
            .describe("The action to perform on the service."),
        serviceName: z.string().describe("The name of the systemd service (e.g., 'nginx', 'sshd', 'docker')."),
      },
    },
    async (params: { 
      action: 'start' | 'stop' | 'restart' | 'status' | 'enable' | 'disable'; 
      serviceName: string; 
    }) => {
      const { action, serviceName } = params;

      // The 'status' action does not typically require sudo. All others do.
      const needsSudo = action !== 'status';
      const sudoPrefix = needsSudo ? 'sudo ' : '';
      
      // Sanitize the service name to prevent command injection
      const safeServiceName = quote([serviceName]);
      const command = `${sudoPrefix}systemctl ${action} ${safeServiceName}`;

      try {
        const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          execPromise(command, (error, stdout, stderr) => {
            // systemctl status returns a non-zero exit code for inactive services, 
            // which execPromise treats as an error. We handle this as a valid case.
            if (error && action !== 'status') {
              reject({ error, stdout, stderr });
              return;
            }
            // For the 'status' command, we resolve even if there's an "error" (non-zero exit code)
            // because the output itself is the information we want.
            resolve({ stdout, stderr });
          });
        });
        
        const successMessage = `Action '${action}' on service '${serviceName}' executed.\n\nSTDOUT:\n${result.stdout || 'None'}\n\nSTDERR:\n${result.stderr || 'None'}`;
        return {
          content: [{ type: 'text', text: successMessage }],
        };

      } catch (e: any) {
        const errorDetails = `Failed to execute command: ${command}\n\nError: ${e.error?.message || 'Unknown error'}\n\nSTDOUT:\n${e.stdout || 'None'}\n\nSTDERR:\n${e.stderr || 'None'}`;
        return {
          content: [{ type: 'text', text: errorDetails }],
          isError: true,
        };
      }
    }
  );
}
