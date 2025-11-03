import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { withTimeout, normalizeTimeout } from '../utils/timeout';

/**
 * Tool: Create Directory
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'create-dir',
    {
      title: 'Create Directory',
      description:
        'Creates a new directory. Parameters: dirPath - The path of the directory to create (required);',
      inputSchema: {
        dirPath: z.string().describe("The path of the directory to create"),
        timeout: z.number().optional().describe("Timeout in seconds for the operation (default: 120 seconds, max: 600 seconds)"),
      }
    },
    async ({
      dirPath,
      timeout
    }) => {
      try {
        // Normalize and apply timeout
        const timeoutMs = normalizeTimeout(timeout);

        if (!dirPath) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: dirPath is required for create-dir operation'
              }
            ],
            isError: true
          };
        }

        const targetPath = dirPath;

        // Wrap the entire operation with timeout
        const operation = async () => {
          // Check if the directory already exists
          if (await fs.pathExists(targetPath)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Directory already exists: ${targetPath}`
                }
              ]
            };
          }

          await fs.ensureDir(targetPath);

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created directory: ${targetPath}`
              }
            ]
          };
        };

        // Execute with timeout
        const operationResult = await withTimeout(operation(), timeoutMs, `Directory creation operation timed out after ${timeoutMs}ms`);

        return operationResult;
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating directory: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
