import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import { quote } from 'shell-quote';

const execPromise = promisify(exec);

/**
 * Tool: Lint Files
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'lint-files',
    {
      title: 'Lint Files',
      description:
        "Lints files using ESLint with options for configuration, automatic fixing, and output format.",
      inputSchema: {
        files: z.string().describe("A space-separated string of file paths to lint."),
        config_path: z.string().optional().describe("Path to a custom ESLint configuration file."),
        fix: z.boolean().optional().default(false).describe("Automatically fix linting errors."),
        output_format: z.enum(['text', 'json']).optional().default('text').describe("Specifies the output format."),
      }
    },
    async ({
      files,
      config_path,
      fix,
      output_format,
    }) => {
      const fileList = files.split(' ');
      const quotedFiles = fileList.map(f => quote([f])).join(' ');
      const command = `npx eslint ${quotedFiles} ${config_path ? `--config ${quote([config_path])}` : ''} ${fix ? '--fix' : ''} ${output_format === 'json' ? '--format json' : ''}`;
      
      try {
        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
          return {
            content: [{ type: 'text', text: `Linter completed with warnings:\n${stderr}` }],
          };
        }
        
        if (output_format === 'json') {
            return { content: [{ type: 'text', text: stdout || '[]' }] };
        }

        return {
          content: [{ type: 'text', text: stdout || 'No linting issues found.' }]
        };

      } catch (error: any) {
        // ESLint exits with a non-zero code for linting errors, which execPromise treats as an error.
        // The actual report is in stdout.
        if (error.stdout) {
          if (output_format === 'json') {
            return { content: [{ type: 'text', text: error.stdout }], isError: true };
          }
          return {
            content: [{ type: 'text', text: `Linter found issues:\n${error.stdout}` }],
            isError: true
          };
        }

        let errorMessage = `Error executing linter: ${error.message}\n`;
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
