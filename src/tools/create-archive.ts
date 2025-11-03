import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import archiver from 'archiver';
import * as tar from 'tar';

/**
 * Tool: Create Archive
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'create-archive',
    {
      title: 'Create Archive',
      description:
        'Compresses files or folders into ZIP or TAR format. Parameters: files - Array of file/folder paths to compress (required); outputPath - Output archive file path (required); format - Archive format (optional, default is zip); compressionLevel - Compression level (optional, default is 6)',
      inputSchema: {
        files: z.array(z.string()),
        outputPath: z.string(),
        format: z.enum(['zip', 'tar', 'tar.gz']).optional(),
        compressionLevel: z.number().min(0).max(9).optional()
      }
    },
    async ({ files, outputPath, format = 'zip', compressionLevel = 6 }) => {
      try {
        // Check if input files exist
        for (const file of files) {
          if (!(await fs.pathExists(file))) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: File or folder ${file} does not exist`
                }
              ],
              isError: true
            };
          }
        }

        // Ensure the output directory exists
        const outputDir = path.dirname(outputPath);
        await fs.ensureDir(outputDir);

        let totalOriginalSize = 0;

        // Calculate the total original size of the files
        const calculateSize = async (filePath: string): Promise<number> => {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            const items = await fs.readdir(filePath);
            let size = 0;
            for (const item of items) {
              const itemPath = path.join(filePath, item);
              size += await calculateSize(itemPath);
            }
            return size;
          } else {
            return stats.size;
          }
        };

        for (const file of files) {
          totalOriginalSize += await calculateSize(file);
        }

        // Choose compression method based on format
        if (format === 'zip') {
          await createZipArchive(files, outputPath, compressionLevel);
        } else if (format === 'tar') {
          await createTarArchive(files, outputPath, false);
        } else if (format === 'tar.gz') {
          await createTarArchive(files, outputPath, true);
        }

        // Get the size of the compressed file
        const compressedStats = await fs.stat(outputPath);
        const compressedSize = compressedStats.size;
        const compressionRatio = Math.round(
          (1 - compressedSize / totalOriginalSize) * 100
        );

        return {
          content: [
            {
              type: 'text',
              text: `Compression complete!\nArchive file: ${outputPath}\nFormat: ${format.toUpperCase()}\nOriginal size: ${Math.round(totalOriginalSize / 1024)}KB\nCompressed size: ${Math.round(compressedSize / 1024)}KB\nCompression ratio: ${compressionRatio}%\nFiles included: ${files.length}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating archive: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

/**
 * Creates a ZIP archive.
 */
async function createZipArchive(
  files: string[],
  outputPath: string,
  compressionLevel: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: compressionLevel }
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    // Add files to the archive
    files.forEach((file) => {
      const stats = fs.statSync(file);
      const fileName = path.basename(file);

      if (stats.isDirectory()) {
        archive.directory(file, fileName);
      } else {
        archive.file(file, { name: fileName });
      }
    });

    archive.finalize();
  });
}

/**
 * Creates a TAR archive.
 */
async function createTarArchive(
  files: string[],
  outputPath: string,
  gzip: boolean
): Promise<void> {
  const tarOptions: any = {
    file: outputPath,
    gzip: gzip
  };

  // Create a file list, maintaining relative path structure
  const fileList: string[] = [];

  for (const file of files) {
    const stats = await fs.stat(file);
    if (stats.isDirectory()) {
      // Recursively add all files in the directory
      const addDirectory = async (dirPath: string) => {
        const items = await fs.readdir(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const itemStats = await fs.stat(itemPath);
          if (itemStats.isDirectory()) {
            await addDirectory(itemPath);
          } else {
            fileList.push(itemPath);
          }
        }
      };
      await addDirectory(file);
    } else {
      fileList.push(file);
    }
  }

  await tar.create(tarOptions, fileList);
}

export default registerTool;
