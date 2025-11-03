import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export default function registerMergePdfTool(server: McpServer) {
  server.registerTool(
    'merge-pdf',
    {
      title: 'Merge PDF Files',
      description: 'Merges multiple PDF files into a single PDF document.',
      inputSchema: {
        input_files: z.array(z.string()).describe('Array of PDF file paths to merge'),
        output_path: z.string().describe('Output path for the merged PDF file'),
      },
    },
    async (params: { input_files: string[]; output_path: string }) => {
      try {
        const { input_files, output_path } = params;

        // Validate input files exist
        for (const file of input_files) {
          if (!(await fs.pathExists(file))) {
            return {
              content: [{ type: 'text', text: `Error: Input file does not exist: ${file}` }],
              isError: true,
            };
          }
        }

        // Ensure output directory exists
        await fs.ensureDir(path.dirname(output_path));

        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        // Process each input PDF
        for (const filePath of input_files) {
          const fileBuffer = await fs.readFile(filePath);
          const pdf = await PDFDocument.load(fileBuffer);

          // Copy all pages from the current PDF to the merged PDF
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        await fs.writeFile(output_path, mergedPdfBytes);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully merged ${input_files.length} PDF files into: ${output_path}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error merging PDFs: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
