import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import { quote } from 'shell-quote';

const execPromise = promisify(exec);

/**
 * Tool: Search Code
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'search-code',
    {
      title: 'Search Code',
      description:
        "Searches for a pattern in a project with advanced options for regex, filtering, and output format.",
      inputSchema: {
        pattern: z.string().describe("The pattern to search for."),
        project_path: z.string().describe("The directory to search in."),
        case_sensitive: z.boolean().optional().default(false).describe("Perform a case-sensitive search."),
        regex: z.boolean().optional().default(false).describe("Treat the pattern as a regular expression."),
        exclude_patterns: z.string().optional().describe("A space-separated string of glob patterns for files/directories to exclude."),
        include_patterns: z.string().optional().describe("A space-separated string of glob patterns for files to include."),
        max_results: z.number().int().min(1).optional().describe("Maximum number of matches to return."),
        context_lines: z.number().int().min(0).optional().default(0).describe("Number of context lines to show around each match."),
        output_format: z.enum(['text', 'json']).optional().default('text').describe("Output format."),
      }
    },
    async (params) => {
      const { pattern, project_path, case_sensitive, regex, exclude_patterns, include_patterns, max_results, context_lines, output_format } = params;
      
      try {
        let commandParts = ['grep', '--line-number', '--recursive'];
        if (!case_sensitive) commandParts.push('-i');
        if (regex) commandParts.push('-E'); else commandParts.push('-F');
        if (context_lines > 0) commandParts.push(`--context=${context_lines}`);
        if (max_results) commandParts.push(`--max-count=${max_results}`);
        include_patterns?.split(' ').forEach(p => commandParts.push(`--include=${p}`));
        exclude_patterns?.split(' ').forEach(p => commandParts.push(`--exclude=${p}`));
        
        commandParts.push(pattern);
        commandParts.push(project_path);

        const command = quote(commandParts);
        
        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
          return { content: [{ type: 'text', text: `Search completed with warnings:\n${stderr}` }] };
        }
        if (!stdout) {
          return { content: [{ type: 'text', text: `No results found for pattern "${pattern}" in ${project_path}` }] };
        }

        if (output_format === 'json') {
            const results = stdout.split('\n').filter(Boolean).map(line => {
                const match = line.match(/^([^:]+):(\d+):(.*)$/);
                if (!match) return { raw: line };
                return { file: match[1], line: parseInt(match[2]), text: match[3] };
            });
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }

        return { content: [{ type: 'text', text: `Search results for "${pattern}":\n${stdout}` }] };
      } catch (error: any) {
        if (error.code === 1 && !error.stderr) { // Grep exits 1 for no matches
          return { content: [{ type: 'text', text: `No results found for pattern "${pattern}" in ${project_path}` }] };
        }
        
        let errorMessage = `Error searching code: ${error.message}\n`;
        if (error.stdout) errorMessage += `STDOUT:\n${error.stdout}\n`;
        if (error.stderr) errorMessage += `STDERR:\n${error.stderr}\n`;
        return { content: [{ type: 'text', text: errorMessage }], isError: true };
      }
    }
  );
};

export default registerTool;
