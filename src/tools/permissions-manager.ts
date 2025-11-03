import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default function registerPermissionsManagerTool(server: McpServer) {
  server.registerTool(
    'permissions-manager',
    {
      title: 'Permissions Manager',
      description: 'Manages file and directory permissions on the system.',
      inputSchema: {
        action: z.enum(['get', 'set', 'chmod', 'chown', 'recursive']).describe('Action to perform'),
        target_path: z.string().describe('File or directory path to manage'),
        permissions: z.string().optional().describe('Permissions (e.g., "755", "rwxr-xr-x") - required for set/chmod'),
        owner: z.string().optional().describe('Owner (user:group) - required for chown'),
        recursive: z.boolean().optional().default(false).describe('Apply recursively to directories'),
      },
    },
    async (params: {
      action: 'get' | 'set' | 'chmod' | 'chown' | 'recursive';
      target_path: string;
      permissions?: string;
      owner?: string;
      recursive?: boolean;
    }) => {
      try {
        const { action, target_path, permissions, owner, recursive = false } = params;

        if (!(await fs.pathExists(target_path))) {
          return {
            content: [{ type: 'text', text: `Error: Target path does not exist: ${target_path}` }],
            isError: true,
          };
        }

        let output = `# Permissions Manager - ${action.toUpperCase()}\n\n`;
        output += `**Target**: ${target_path}\n\n`;

        switch (action) {
          case 'get':
            const stats = await fs.stat(target_path);
            const mode = (stats.mode & 0o777).toString(8).padStart(3, '0');

            // Get symbolic permissions
            const permissionsMap: { [key: number]: string } = {
              0: '---', 1: '--x', 2: '-w-', 3: '-wx',
              4: 'r--', 5: 'r-x', 6: 'rw-', 7: 'rwx'
            };

            const user = permissionsMap[(stats.mode >> 6) & 0o7];
            const group = permissionsMap[(stats.mode >> 3) & 0o7];
            const other = permissionsMap[stats.mode & 0o7];

            output += `## Current Permissions\n`;
            output += `- **Octal**: ${mode}\n`;
            output += `- **Symbolic**: ${user}${group}${other}\n`;
            output += `- **Owner**: ${stats.uid}\n`;
            output += `- **Group**: ${stats.gid}\n`;
            break;

          case 'set':
          case 'chmod':
            if (!permissions) {
              return {
                content: [{ type: 'text', text: 'Error: permissions parameter is required for set/chmod action' }],
                isError: true,
              };
            }

            // Validate permissions format
            const validPermissions = /^(0?[0-7]{3}|[r-][w-][x-][r-][w-][x-][r-][w-][x-]|[ugoa]+[+-=][rwx]+)$|^[0-7]{3,4}$/;
            if (!validPermissions.test(permissions)) {
              return {
                content: [{ type: 'text', text: `Error: Invalid permissions format: ${permissions}` }],
                isError: true,
              };
            }

            const chmodCommand = `chmod ${recursive ? '-R ' : ''}${permissions} "${target_path}"`;
            const { stdout: chmodOutput } = await execPromise(chmodCommand);

            output += `## Permissions Updated\n`;
            output += `- **Command**: ${chmodCommand}\n`;
            output += `- **Result**: ${chmodOutput || 'Success'}\n`;

            // Show new permissions
            const newStats = await fs.stat(target_path);
            const newMode = (newStats.mode & 0o777).toString(8).padStart(3, '0');
            output += `- **New Octal**: ${newMode}\n`;
            break;

          case 'chown':
            if (!owner) {
              return {
                content: [{ type: 'text', text: 'Error: owner parameter is required for chown action' }],
                isError: true,
              };
            }

            // Validate owner format (user:group)
            const ownerRegex = /^[^:]+(:[^:]+)?$/;
            if (!ownerRegex.test(owner)) {
              return {
                content: [{ type: 'text', text: `Error: Invalid owner format: ${owner}. Use "user:group" format.` }],
                isError: true,
              };
            }

            const chownCommand = `chown ${recursive ? '-R ' : ''}${owner} "${target_path}"`;
            const { stdout: chownOutput } = await execPromise(chownCommand);

            output += `## Ownership Updated\n`;
            output += `- **Command**: ${chownCommand}\n`;
            output += `- **Result**: ${chownOutput || 'Success'}\n`;

            // Show new ownership
            const newStats2 = await fs.stat(target_path);
            output += `- **New Owner**: ${newStats2.uid}\n`;
            output += `- **New Group**: ${newStats2.gid}\n`;
            break;

          case 'recursive':
            // Show permissions recursively
            const recursiveCommand = `find "${target_path}" -type f -exec ls -la {} \\; | head -20`;
            const { stdout: recursiveOutput } = await execPromise(recursiveCommand);

            output += `## Recursive Permissions (First 20 files)\n`;
            output += `\`\`\`\n${recursiveOutput}\n\`\`\`\n`;
            break;
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error managing permissions: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
