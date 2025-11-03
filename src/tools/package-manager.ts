
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec as execPromise } from 'child_process';
import { quote } from 'shell-quote';

export default function registerPackageManagerTool(server: McpServer) {
  server.registerTool(
    'package-manager',
    {
      description: 'Manages system packages using apt on Debian-based Linux (like Linux Mint). Requires sudo privileges for install, remove, and update operations.',
      // Define the input schema directly as a plain object, following the project's pattern.
      inputSchema: {
        action: z.enum(['install', 'remove', 'update', 'upgrade_system', 'search'])
            .describe("The action to perform: 'install', 'remove', 'update' package lists, 'upgrade_system' all packages, or 'search' for a package."),
        packageName: z.string().optional().describe("The name of the package. Required for 'install', 'remove', and 'search' actions."),
      },
    },
    // Manually define the types for the handler's parameters, matching the schema.
    async (params: { 
      action: 'install' | 'remove' | 'update' | 'upgrade_system' | 'search'; 
      packageName?: string; 
    }) => {
      const { action, packageName } = params;

      if ((action === 'install' || action === 'remove' || action === 'search') && !packageName) {
        const errorMessage = `'packageName' is required for the '${action}' action.`;
        return {
          content: [{ type: 'text', text: errorMessage }],
          isError: true,
        };
      }

      let command: string;
      const needsSudo = ['install', 'remove', 'update', 'upgrade_system'].includes(action);
      const env = needsSudo ? 'DEBIAN_FRONTEND=noninteractive ' : '';
      const sudoPrefix = needsSudo ? 'sudo ' : '';
      const safePackageName = packageName ? quote([packageName]) : '';

      switch (action) {
        case 'install':
          command = `${env}${sudoPrefix}apt-get install -y ${safePackageName}`;
          break;
        case 'remove':
          command = `${env}${sudoPrefix}apt-get remove -y ${safePackageName}`;
          break;
        case 'update':
          command = `${env}${sudoPrefix}apt-get update`;
          break;
        case 'upgrade_system':
          command = `${env}${sudoPrefix}apt-get upgrade -y`;
          break;
        case 'search':
          command = `apt-cache search ${safePackageName}`;
          break;
      }

      try {
        const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          execPromise(command, (error, stdout, stderr) => {
            if (error) {
              reject({ error, stdout, stderr });
              return;
            }
            resolve({ stdout, stderr });
          });
        });
        
        const successMessage = `Action '${action}' completed successfully.\nSTDOUT:\n${result.stdout || 'None'}\n\nSTDERR:\n${result.stderr || 'None'}`;
        return {
          content: [{ type: 'text', text: successMessage }],
        };

      } catch (e: any) {
        const errorDetails = `Failed to execute command: ${command}\nError: ${e.error?.message || 'Unknown error'}\nSTDOUT:\n${e.stdout || 'None'}\n\nSTDERR:\n${e.stderr || 'None'}`;
        return {
          content: [{ type: 'text', text: errorDetails }],
          isError: true,
        };
      }
    }
  );
}
