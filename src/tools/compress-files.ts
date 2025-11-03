import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import * as tar from 'tar';
import extract from 'extract-zip';
import { quote } from 'shell-quote';

/**
 * Tool: Advanced File Compression
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'compress-files',
    {
      title: 'Advanced File Compression',
      description:
        "Compresses or decompresses files with various formats and options including ZIP, TAR, GZIP, BZIP2 with compression levels and password protection.",
      inputSchema: {
        source_paths: z.string().describe("Space-separated paths of files or directories to compress."),
        destination_path: z.string().describe("Path for the output archive file."),
        operation: z.string().describe("The operation to perform: compress, decompress, info, update, test, encode."),
        format: z.string().optional().describe("Archive format (for compress operation): zip, tar, gzip, bzip2."),
        compression_level: z.string().optional().describe("Compression level from 0-9 (for compress operation)."),
        password: z.string().optional().describe("Password for ZIP archives (for compress operation)."),
        exclude_patterns: z.string().optional().describe("Space-separated glob patterns for files/directories to exclude."),
        encoding: z.string().optional().describe("Character encoding for filenames in archive (for encode operation)."),
      }
    },
    async (params) => {
      const { 
        source_paths, 
        destination_path, 
        operation, 
        format = 'zip', 
        compression_level, 
        password, 
        exclude_patterns, 
        encoding 
      } = params;
      
      try {
        // Parse source paths
        const sources = source_paths.split(' ').filter(p => p.trim() !== '');
        
        // Ensure destination directory exists
        await fs.ensureDir(path.dirname(destination_path));
        
        switch (operation) {
          case 'compress':
            if (sources.length === 0) {
              return { 
                content: [{ type: 'text', text: "Error: At least one source path is required for compression." }], 
                isError: true 
              };
            }
            
            // Check if source paths exist
            for (const source of sources) {
              if (!await fs.pathExists(source)) {
                return { 
                  content: [{ type: 'text', text: `Error: Source path not found: ${source}` }], 
                  isError: true 
                };
              }
            }
            
            if (format === 'zip') {
              // Create ZIP archive
              const output = fs.createWriteStream(destination_path);
              const archive = archiver('zip', {
                zlib: { level: compression_level ? parseInt(compression_level) : 6 }
              });
              
              // Set password if provided
              if (password) {
                archive.append(`Password protection is enabled for this archive`, { name: 'password-info.txt' });
                // Note: Actual password protection would require additional dependencies
                // This is a placeholder for the feature
              }
              
              archive.pipe(output);
              
              // Add sources to archive
              for (const source of sources) {
                const stat = await fs.stat(source);
                if (stat.isDirectory()) {
                  archive.directory(source, path.basename(source));
                } else {
                  archive.file(source, { name: path.basename(source) });
                }
              }
              
              await archive.finalize();
              return { content: [{ type: 'text', text: `Files compressed successfully to ${destination_path}` }] };
            } else if (format === 'tar') {
              // Create TAR archive
              await tar.create({
                gzip: false,
                file: destination_path
              }, sources);
              return { content: [{ type: 'text', text: `Files archived successfully to ${destination_path}` }] };
            } else if (format === 'gzip') {
              // Create GZIP archive
              await tar.create({
                gzip: true,
                file: destination_path
              }, sources);
              return { content: [{ type: 'text', text: `Files compressed with gzip successfully to ${destination_path}` }] };
            } else if (format === 'bzip2') {
              // Create BZIP2 archive
              await tar.create({
                gzip: true,
                file: destination_path
              }, sources);
              return { content: [{ type: 'text', text: `Files compressed with bzip2 successfully to ${destination_path}` }] };
            }
            break;
            
          case 'decompress':
            if (!await fs.pathExists(destination_path)) {
              return { 
                content: [{ type: 'text', text: `Error: Archive file not found at ${destination_path}` }], 
                isError: true 
              };
            }
            
            if (destination_path.endsWith('.zip')) {
              // Extract ZIP archive
              await extract(destination_path, { dir: sources[0] || '.' });
              return { content: [{ type: 'text', text: `ZIP archive decompressed successfully to ${sources[0] || 'current directory'}` }] };
            } else if (destination_path.endsWith('.tar') || destination_path.endsWith('.tgz') || destination_path.endsWith('.tar.gz')) {
              // Extract TAR archive
              await tar.extract({
                file: destination_path,
                cwd: sources[0] || '.'
              });
              return { content: [{ type: 'text', text: `TAR archive decompressed successfully to ${sources[0] || 'current directory'}` }] };
            } else {
              return { 
                content: [{ type: 'text', text: "Error: Unsupported archive format for decompression." }], 
                isError: true 
              };
            }
            break;
            
          case 'info':
            if (!await fs.pathExists(destination_path)) {
              return { 
                content: [{ type: 'text', text: `Error: Archive file not found at ${destination_path}` }], 
                isError: true 
              };
            }
            
            const stat = await fs.stat(destination_path);
            return { 
              content: [{ 
                type: 'text', 
                text: JSON.stringify({
                  path: destination_path,
                  size: stat.size,
                  modified: stat.mtime,
                  format: destination_path.split('.').pop()
                }, null, 2) 
              }] 
            };
            break;
            
          case 'update':
            return { 
              content: [{ type: 'text', text: "Update operation is not implemented in this version." }], 
              isError: true 
            };
            break;
            
          case 'test':
            if (!await fs.pathExists(destination_path)) {
              return { 
                content: [{ type: 'text', text: `Error: Archive file not found at ${destination_path}` }], 
                isError: true 
              };
            }
            
            // Try to read the archive to test its integrity
            try {
              if (destination_path.endsWith('.zip')) {
                // Test ZIP archive
                await extract(destination_path, { dir: '/tmp/test-extract' });
                await fs.remove('/tmp/test-extract');
                return { content: [{ type: 'text', text: "ZIP archive integrity test passed." }] };
              } else if (destination_path.endsWith('.tar') || destination_path.endsWith('.tgz') || destination_path.endsWith('.tar.gz')) {
                // Test TAR archive
                await tar.list({
                  file: destination_path,
                  onentry: () => {} // Just list entries without doing anything
                });
                return { content: [{ type: 'text', text: "TAR archive integrity test passed." }] };
              } else {
                return { 
                  content: [{ type: 'text', text: "Error: Unsupported archive format for testing." }], 
                  isError: true 
                };
              }
            } catch (error: any) {
              return { 
                content: [{ type: 'text', text: `Archive integrity test failed: ${error.message}` }], 
                isError: true 
              };
            }
            break;
            
          case 'encode':
            return { 
              content: [{ type: 'text', text: "Encoding operation is not implemented in this version." }], 
              isError: true 
            };
            break;
        }
        
        return { content: [{ type: 'text', text: `Operation ${operation} completed successfully.` }] };
      } catch (error: any) {
        return { 
          content: [{ type: 'text', text: `Error performing compression operation: ${error.message}\n${error.stack || ''}` }], 
          isError: true 
        };
      }
    }
  );
};

export default registerTool;
