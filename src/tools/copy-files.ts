import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * Tool: Copy Files
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'copy-files',
    {
      title: 'Copy Files',
      description:
        'Copies a file or folder to a target location. Parameters: sourcePath - Source file/folder path (required); targetPath - Target path (required); overwrite - Whether to overwrite existing files (optional, default is false); preserveTimestamps - Whether to preserve timestamps (optional, default is true)',
      inputSchema: {
        sourcePath: z.string(),
        targetPath: z.string(),
        overwrite: z.boolean().optional(),
        preserveTimestamps: z.boolean().optional()
      }
    },
    async ({
      sourcePath,
      targetPath,
      overwrite = false,
      preserveTimestamps = true
    }) => {
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

        // Get source file information
        const sourceStats = await fs.stat(sourcePath);
        const isDirectory = sourceStats.isDirectory();
        const sourceSize = isDirectory
          ? await calculateDirectorySize(sourcePath)
          : sourceStats.size;

        // Ensure the target directory exists
        const targetDir = isDirectory ? targetPath : path.dirname(targetPath);
        await fs.ensureDir(targetDir);

        // Perform the copy operation
        const copyOptions: any = {
          overwrite: overwrite,
          preserveTimestamps: preserveTimestamps
        };

        await fs.copy(sourcePath, targetPath, copyOptions);

        // Verify that the copy was successful
        if (!(await fs.pathExists(targetPath))) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Copy operation completed but target file not found'
              }
            ],
            isError: true
          };
        }

        // Verify the copied file
        await fs.stat(targetPath);

        // Count the number of files (if it's a directory)
        let fileCount = 1;
        if (isDirectory) {
          fileCount = await countFilesInDirectory(targetPath);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Copy complete!\nSource path: ${sourcePath}\nTarget path: ${targetPath}\nType: ${isDirectory ? 'Folder' : 'File'}\nSize: ${Math.round(sourceSize / 1024)}KB\n${isDirectory ? `Files included: ${fileCount}` : ''}\nTimestamps preserved: ${preserveTimestamps ? 'Yes' : 'No'}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error copying file: ${error instanceof Error ? error.message : String(error)}`
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
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      const items = await fs.readdir(itemPath);
      for (const item of items) {
        await calculateSize(path.join(itemPath, item));
      }
    } else {
      totalSize += stats.size;
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
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      const items = await fs.readdir(itemPath);
      for (const item of items) {
        await countFiles(path.join(itemPath, item));
      }
    } else {
      fileCount++;
    }
  };

  await countFiles(dirPath);
  return fileCount;
}

export default registerTool;
