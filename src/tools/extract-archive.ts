import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import extractZip from 'extract-zip';
import * as tar from 'tar';

/**
 * Tool: Extract Archive
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'extract-archive',
    {
      title: 'Extract Archive',
      description:
        'Extracts a ZIP, TAR, or TAR.GZ file to a specified directory. Parameters: archivePath - Path to the archive file (required); extractTo - Target directory for extraction (required); overwrite - Whether to overwrite existing files (optional, default is false)',
      inputSchema: {
        archivePath: z.string(),
        extractTo: z.string(),
        overwrite: z.boolean().optional()
      }
    },
    async ({ archivePath, extractTo, overwrite = false }) => {
      try {
        // Check if the archive file exists
        if (!(await fs.pathExists(archivePath))) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Archive file ${archivePath} does not exist`
              }
            ],
            isError: true
          };
        }

        // Check the file format
        const fileExtension = path.extname(archivePath).toLowerCase();
        const supportedFormats = ['.zip', '.tar', '.gz', '.tgz'];

        // Special handling for .tar.gz
        const fileName = path.basename(archivePath).toLowerCase();
        const isTarGz =
          fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');

        if (
          !supportedFormats.some((ext) =>
            archivePath.toLowerCase().endsWith(ext)
          ) &&
          !isTarGz
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unsupported archive format. Supported formats: ZIP, TAR, TAR.GZ, TGZ`
              }
            ],
            isError: true
          };
        }

        // Ensure the extraction directory exists
        await fs.ensureDir(extractTo);

        // Check if the target directory is empty (if not overwriting)
        if (!overwrite) {
          const existingFiles = await fs.readdir(extractTo);
          if (existingFiles.length > 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Target directory ${extractTo} is not empty. Set overwrite=true to overwrite existing files.`
                }
              ],
              isError: true
            };
          }
        }

        let extractedFiles: string[] = [];
        let format = '';

        // Choose extraction method based on file format
        if (fileExtension === '.zip') {
          format = 'ZIP';
          extractedFiles = await extractZipFile(archivePath, extractTo);
        } else if (
          isTarGz ||
          fileExtension === '.gz' ||
          fileExtension === '.tgz'
        ) {
          format = 'TAR.GZ';
          extractedFiles = await extractTarFile(archivePath, extractTo, true);
        } else if (fileExtension === '.tar') {
          format = 'TAR';
          extractedFiles = await extractTarFile(archivePath, extractTo, false);
        }

        // Calculate the total size of the extracted files
        let totalSize = 0;
        for (const file of extractedFiles) {
          try {
            const stats = await fs.stat(file);
            if (stats.isFile()) {
              totalSize += stats.size;
            }
          } catch {
            // Ignore stat errors
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Extraction complete!\nArchive file: ${archivePath}\nFormat: ${format}\nExtracted to: ${extractTo}\nNumber of files extracted: ${extractedFiles.length}\nTotal size: ${Math.round(totalSize / 1024)}KB`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error extracting archive: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

/**
 * Extracts a ZIP file.
 */
async function extractZipFile(
  archivePath: string,
  extractTo: string
): Promise<string[]> {
  await extractZip(archivePath, { dir: path.resolve(extractTo) });

  // Recursively get all extracted files
  const getAllFiles = async (dirPath: string): Promise<string[]> => {
    const files: string[] = [];
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        files.push(...(await getAllFiles(itemPath)));
      } else {
        files.push(itemPath);
      }
    }

    return files;
  };

  return await getAllFiles(extractTo);
}

/**
 * Extracts a TAR file.
 */
async function extractTarFile(
  archivePath: string,
  extractTo: string,
  gzip: boolean
): Promise<string[]> {
  const extractedFiles: string[] = [];

  await tar.extract({
    file: archivePath,
    cwd: extractTo,
    gzip: gzip,
    onentry: (entry: any) => {
      if (entry.type === 'File') {
        extractedFiles.push(path.join(extractTo, entry.path));
      }
    }
  } as any);

  return extractedFiles;
}

export default registerTool;
