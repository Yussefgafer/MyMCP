import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export default function registerSplitPdfTool(server: McpServer) {
  server.registerTool(
    'split-pdf',
    {
      title: 'Split PDF File',
      description: 'Splits a PDF file into separate pages or page ranges.',
      inputSchema: {
        input_file: z.string().describe('Input PDF file path'),
        output_dir: z.string().describe('Output directory for split PDF files'),
        split_mode: z.enum(['pages', 'ranges']).optional().default('pages').describe('Split mode: pages or ranges'),
        page_ranges: z.array(z.string()).optional().describe('Page ranges (e.g., ["1-3", "5", "7-9"]) - required for ranges mode'),
      },
    },
    async (params: { input_file: string; output_dir: string; split_mode?: 'pages' | 'ranges'; page_ranges?: string[] }) => {
      try {
        const { input_file, output_dir, split_mode = 'pages', page_ranges } = params;

        // Validate input file exists
        if (!(await fs.pathExists(input_file))) {
          return {
            content: [{ type: 'text', text: `Error: Input file does not exist: ${input_file}` }],
            isError: true,
          };
        }

        // Ensure output directory exists
        await fs.ensureDir(output_dir);

        // Load the input PDF
        const fileBuffer = await fs.readFile(input_file);
        const pdf = await PDFDocument.load(fileBuffer);
        const totalPages = pdf.getPageCount();

        let splitPages: number[][] = [];

        if (split_mode === 'pages') {
          // Split each page into separate files
          for (let i = 0; i < totalPages; i++) {
            splitPages.push([i]);
          }
        } else if (split_mode === 'ranges' && page_ranges) {
          // Parse page ranges
          for (const range of page_ranges) {
            const pages: number[] = [];
            if (range.includes('-')) {
              const [start, end] = range.split('-').map(Number);
              for (let i = start - 1; i < Math.min(end, totalPages); i++) {
                pages.push(i);
              }
            } else {
              const pageNum = parseInt(range) - 1;
              if (pageNum >= 0 && pageNum < totalPages) {
                pages.push(pageNum);
              }
            }
            if (pages.length > 0) {
              splitPages.push(pages);
            }
          }
        } else {
          return {
            content: [{ type: 'text', text: 'Error: page_ranges is required for ranges mode' }],
            isError: true,
          };
        }

        const createdFiles: string[] = [];

        // Create split PDF files
        for (let i = 0; i < splitPages.length; i++) {
          const pages = splitPages[i];
          if (pages.length === 0) continue;

          const newPdf = await PDFDocument.create();

          // Copy the specified pages
          const copiedPages = await newPdf.copyPages(pdf, pages);
          copiedPages.forEach((page) => newPdf.addPage(page));

          const outputPath = path.join(output_dir, `split_${i + 1}.pdf`);
          const pdfBytes = await newPdf.save();
          await fs.writeFile(outputPath, pdfBytes);

          createdFiles.push(outputPath);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully split PDF into ${createdFiles.length} files:\n${createdFiles.join('\n')}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error splitting PDF: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
