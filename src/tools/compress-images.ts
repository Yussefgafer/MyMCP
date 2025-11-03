import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

export default function registerCompressImagesTool(server: McpServer) {
  server.registerTool(
    'compress-images',
    {
      title: 'Compress Images',
      description: 'Compresses image files to reduce file size while maintaining quality.',
      inputSchema: {
        input_files: z.array(z.string()).describe('Array of image file paths to compress'),
        output_dir: z.string().optional().describe('Output directory (defaults to same as input)'),
        quality: z.number().min(1).max(100).optional().default(80).describe('Compression quality (1-100)'),
        format: z.enum(['jpeg', 'png', 'webp']).optional().default('jpeg').describe('Output format'),
        max_width: z.number().optional().describe('Maximum width in pixels'),
        max_height: z.number().optional().describe('Maximum height in pixels'),
      },
    },
    async (params: {
      input_files: string[];
      output_dir?: string;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
      max_width?: number;
      max_height?: number;
    }) => {
      try {
        const { input_files, output_dir, quality = 80, format = 'jpeg', max_width, max_height } = params;

        // Validate input files exist
        for (const file of input_files) {
          if (!(await fs.pathExists(file))) {
            return {
              content: [{ type: 'text', text: `Error: Input file does not exist: ${file}` }],
              isError: true,
            };
          }
        }

        const outputDirectory = output_dir || path.dirname(input_files[0]);
        await fs.ensureDir(outputDirectory);

        const compressedFiles: string[] = [];

        // Process each image
        for (const inputFile of input_files) {
          const fileName = path.basename(inputFile, path.extname(inputFile));
          const outputFileName = `${fileName}_compressed.${format}`;
          const outputPath = path.join(outputDirectory, outputFileName);

          // Get original file size
          const originalStats = await fs.stat(inputFile);
          const originalSize = originalStats.size;

          // Process image with Sharp
          let sharpInstance = sharp(inputFile);

          // Resize if specified
          if (max_width || max_height) {
            sharpInstance = sharpInstance.resize(max_width, max_height, {
              fit: 'inside',
              withoutEnlargement: true,
            });
          }

          // Set format and quality
          if (format === 'jpeg') {
            sharpInstance = sharpInstance.jpeg({ quality });
          } else if (format === 'png') {
            sharpInstance = sharpInstance.png({ quality: quality / 100 });
          } else if (format === 'webp') {
            sharpInstance = sharpInstance.webp({ quality });
          }

          // Save compressed image
          await sharpInstance.toFile(outputPath);

          // Get compressed file size
          const compressedStats = await fs.stat(outputPath);
          const compressedSize = compressedStats.size;
          const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

          compressedFiles.push(
            `${outputPath} (${originalSize} → ${compressedSize} bytes, ${compressionRatio}% reduction)`
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully compressed ${input_files.length} images:\n${compressedFiles.join('\n')}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error compressing images: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
