import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import { quote } from 'shell-quote';

const execPromise = promisify(exec);

/**
 * Tool: Format Code
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'format-code',
    {
      title: 'Format Code',
      description:
        "Formats one or more code files using Prettier, with options for a configuration path and a dry run.",
      inputSchema: {
        filePaths: z.string().describe("A space-separated string of file paths to format."),
        config_path: z.string().optional().describe("Path to a custom Prettier configuration file."),
        dry_run: z.boolean().optional().default(false).describe("If true, checks if files are formatted without making changes."),
      }
    },
    async ({
      filePaths,
      config_path,
      dry_run,
    }) => {
      const action = dry_run ? '--check' : '--write';
      const fileList = filePaths.split(' ');
      const quotedFiles = fileList.map(f => quote([f])).join(' ');
      const command = `npx prettier ${action} ${quotedFiles} ${config_path ? `--config ${quote([config_path])}` : ''}`;

      try {
        const { stdout, stderr } = await execPromise(command);
        
        if (dry_run) {
            return { content: [{ type: 'text', text: 'All checked files are formatted.' }] };
        }

        // In write mode, stdout lists the files that were formatted.
        return {
          content: [{ type: 'text', text: `Successfully formatted files:\n${stdout}` }]
        };

      } catch (error: any) {
        // Prettier's --check exits with code 1 if files are unformatted.
        if (dry_run && error.code === 1 && error.stdout) {
          return {
            content: [{ type: 'text', text: `The following files need formatting:\n${error.stdout}` }],
            isError: true // Technically not an execution error, but indicates a failed check.
          };
        }
        
        let errorMessage = `Error formatting files: ${error.message}\n`;
        if (error.stdout) errorMessage += `STDOUT:\n${error.stdout}\n`;
        if (error.stderr) errorMessage += `STDERR:\n${error.stderr}\n`;

        return {
          content: [{ type: 'text', text: errorMessage }],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
