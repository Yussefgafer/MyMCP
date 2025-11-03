import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * Tool: Delete Directory
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'delete-dir',
    {
      title: 'Delete Directory',
      description:
        'Deletes a directory. Parameters: dirPath - The path of the directory to delete (required); recursive - Whether to delete the directory and its contents recursively (optional, default: true);',
      inputSchema: {
        dirPath: z.string(),
        recursive: z.boolean().optional(),
      }
    },
    async ({
      dirPath,
      recursive = true,
    }) => {
      try {
        // Check if the directory exists
        if (!(await fs.pathExists(dirPath))) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Directory ${dirPath} does not exist.`
              }
            ],
            isError: true
          };
        }

        if (!recursive) {
          const files = await fs.readdir(dirPath);
          if (files.length > 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Directory ${dirPath} is not empty. Use recursive: true to delete it.`
                }
              ],
              isError: true
            };
          }
        }

        await fs.remove(dirPath);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted directory: ${dirPath}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting directory: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
