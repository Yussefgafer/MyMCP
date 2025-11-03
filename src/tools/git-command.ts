import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import { quote } from 'shell-quote';

const execPromise = promisify(exec);

/**
 * Tool: Git Command
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'git-command',
    {
      title: 'Git Command',
      description:
        "Executes a git command with options for repository path, proxy, and output format. Provides improved error handling and JSON output.",
      inputSchema: {
        command: z.string().describe("The git command to execute (e.g., 'status', 'log --oneline')."),
        repo_path: z.string().optional().default('.').describe("Path to the git repository."),
        proxy: z.string().optional().describe("Proxy server to use for the command."),
        output_format: z.enum(['text', 'json']).optional().default('text').describe("Format for the output."),
        force: z.boolean().optional().default(false).describe("Use the --force flag if applicable."),
      }
    },
    async ({
      command,
      repo_path,
      proxy,
      output_format,
      force,
    }) => {
      try {
        const gitCommand = `git -C ${quote([repo_path])} ${command} ${force ? '--force' : ''}`;
        
        const options: ExecOptions = {
            env: {
                ...process.env,
                ...(proxy ? { https_proxy: proxy, http_proxy: proxy } : {})
            }
        };
        
        const { stdout, stderr } = await execPromise(gitCommand, options);

        if (stderr && !(typeof stdout === 'string' && stdout.trim())) {
          return {
            content: [{ type: 'text', text: `Git command executed with warnings or errors:\n${stderr}` }],
            isError: true
          };
        }

        if (output_format === 'json') {
            const outputString = String(stdout);
            const jsonOutput = parseGitOutput(command, outputString);
            return { content: [{ type: 'text', text: JSON.stringify(jsonOutput, null, 2) }] };
        }

        return {
          content: [{ type: 'text', text: `Git command executed successfully:\n${stdout || stderr}` }]
        };
      } catch (error: any) {
        let errorMessage = `Error executing git command: ${error.message}\n`;
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

function parseGitOutput(command: string, output: string): any {
    const lines = output.trim().split('\n').filter(Boolean);
    if (command.startsWith('log')) {
        return lines.map(line => {
            const match = line.match(/^([a-f0-9]+)\s(.*)$/);
            return match ? { commit: match[1], message: match[2] } : { raw: line };
        });
    }
    if (command.startsWith('status')) {
        return { status: lines };
    }
    // Generic fallback
    return lines.map(line => ({ raw: line }));
}

export default registerTool;
