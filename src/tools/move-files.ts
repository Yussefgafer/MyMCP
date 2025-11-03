import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * Tool: Move Files
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'move-files',
    {
      title: 'Move Files',
      description:
        'Moves a file or folder to a target location. Parameters: sourcePath - Source file/folder path (required); targetPath - Target path (required); overwrite - Whether to overwrite existing files (optional, default is false)',
      inputSchema: {
        sourcePath: z.string(),
        targetPath: z.string(),
        overwrite: z.boolean().optional()
      }
    },
    async ({ sourcePath, targetPath, overwrite = false }) => {
      try {
        // Check if the source file exists
        if (!(await fs.pathExists(sourcePath))) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Source file or folder ${sourcePath} does not exist`
              }
            ],
            isError: true
          };
        }

        // Check if the source and target paths are the same
        const absoluteSource = path.resolve(sourcePath);
        const absoluteTarget = path.resolve(targetPath);
        if (absoluteSource === absoluteTarget) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Source and target paths cannot be the same'
              }
            ],
            isError: true
          };
        }

        // Check if the target path exists
        const targetExists = await fs.pathExists(targetPath);
        if (targetExists && !overwrite) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Target path ${targetPath} already exists. Set overwrite=true to overwrite.`
              }
            ],
            isError: true
          };
        }

        // Get source file information (before moving)
        const sourceStats = await fs.stat(sourcePath);
        const isDirectory = sourceStats.isDirectory();
        const sourceSize = isDirectory
          ? await calculateDirectorySize(sourcePath)
          : sourceStats.size;

        // Count the number of files (if it's a directory)
        let fileCount = 1;
        if (isDirectory) {
          fileCount = await countFilesInDirectory(sourcePath);
        }

        // Ensure the target directory exists
        const targetDir = isDirectory
          ? path.dirname(targetPath)
          : path.dirname(targetPath);
        await fs.ensureDir(targetDir);

        // Perform the move operation
        await fs.move(sourcePath, targetPath, { overwrite: overwrite });

        // Verify that the move was successful
        if (!(await fs.pathExists(targetPath))) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Move operation completed but target file not found'
              }
            ],
            isError: true
          };
        }

        // Verify that the source file has been removed
        if (await fs.pathExists(sourcePath)) {
          return {
            content: [
              {
                type: 'text',
                text: 'Warning: Move operation completed but source file still exists'
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Move complete!\nSource path: ${sourcePath}\nTarget path: ${targetPath}\nType: ${isDirectory ? 'Folder' : 'File'}\nSize: ${Math.round(sourceSize / 1024)}KB\n${isDirectory ? `Files included: ${fileCount}` : ''}\nOperation: ${targetExists && overwrite ? 'Overwrite' : 'New'}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error moving file: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

/**
 * Calculates the size of a directory.
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  const calculateSize = async (itemPath: string): Promise<void> => {
    try {
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        const items = await fs.readdir(itemPath);
        for (const item of items) {
          await calculateSize(path.join(itemPath, item));
        }
      } else {
        totalSize += stats.size;
      }
    } catch {
      // Ignore files that cannot be accessed
    }
  };

  await calculateSize(dirPath);
  return totalSize;
}

/**
 * Counts the number of files in a directory.
 */
async function countFilesInDirectory(dirPath: string): Promise<number> {
  let fileCount = 0;

  const countFiles = async (itemPath: string): Promise<void> => {
    try {
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        const items = await fs.readdir(itemPath);
        for (const item of items) {
          await countFiles(path.join(itemPath, item));
        }
      } else {
        fileCount++;
      }
    } catch {
      // Ignore files that cannot be accessed
    }
  };

  await countFiles(dirPath);
  return fileCount;
}

export default registerTool;
