import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * Tool: Delete File
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'delete-file',
    {
      title: 'Delete File',
      description:
        'Deletes a file. Parameters: filePath - The path of the file to delete (required);',
      inputSchema: {
        filePath: z.string(),
      }
    },
    async ({
      filePath,
    }) => {
      try {
        // Check if the file exists
        if (!(await fs.pathExists(filePath))) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: File ${filePath} does not exist.`
              }
            ],
            isError: true
          };
        }

        // Check if it's a file
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${filePath} is a directory, not a file.`
              }
            ],
            isError: true
          };
        }

        await fs.remove(filePath);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted file: ${filePath}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting file: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
