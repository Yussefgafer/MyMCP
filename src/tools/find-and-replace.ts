import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';

export default function findAndReplace(server: McpServer) {
  server.registerTool(
    'find-and-replace',
    {
      title: 'Find and Replace in File',
      description: 'Finds and replaces text in a file using a string or a regular expression.',
      inputSchema: {
        path: z.string().describe('The path to the file to modify.'),
        search: z.string().describe('The text or regex pattern to search for.'),
        replace: z.string().describe('The text to replace the search term with.'),
        isRegex: z.boolean().optional().default(false).describe('Set to true if the search term is a regular expression.'),
        replaceAll: z.boolean().optional().default(true).describe('Set to false to replace only the first occurrence.'),
      },
    },
    async (params: { path: string; search: string; replace: string; isRegex?: boolean; replaceAll?: boolean }) => {
      try {
        if (!(await fs.pathExists(params.path))) {
          return { content: [{ type: 'text', text: `Error: File does not exist: ${params.path}` }], isError: true };
        }

        const fileContent = await fs.readFile(params.path, 'utf-8');
        let newContent: string;

        if (params.isRegex) {
          const regex = new RegExp(params.search, params.replaceAll ? 'g' : '');
          newContent = fileContent.replace(regex, params.replace);
        } else {
          if (params.replaceAll) {
            newContent = fileContent.split(params.search).join(params.replace);
          } else {
            newContent = fileContent.replace(params.search, params.replace);
          }
        }

        if (newContent === fileContent) {
          return { content: [{ type: 'text', text: 'No changes were made. The search term was not found.' }] };
        }

        await fs.writeFile(params.path, newContent, 'utf-8');
        return { content: [{ type: 'text', text: `Successfully replaced content in ${params.path}.` }] };

      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `An error occurred: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
