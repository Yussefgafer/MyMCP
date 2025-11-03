import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function jsonToCsv(jsonData: any[]): string {
  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    throw new Error('Input must be a non-empty array of objects.');
  }
  const headers = Object.keys(jsonData[0]);
  const csvRows = [headers.join(',')];
  for (const row of jsonData) {
    const values = headers.map(header => {
      const value = row[header];
      // Basic escaping for values containing commas
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}

function csvToJson(csvData: string): any[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV data must have a header row and at least one data row.');
  }
  const headers = lines[0].split(',');
  const jsonData = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const rowObject: { [key: string]: string } = {};
    for (let j = 0; j < headers.length; j++) {
      rowObject[headers[j]] = values[j];
    }
    jsonData.push(rowObject);
  }
  return jsonData;
}

export default function dataTransformation(server: McpServer) {
  server.registerTool(
    'data-transformation',
    {
      title: 'Data Transformation',
      description: 'Converts data between different formats (e.g., JSON to CSV). Handles simple data structures only.',
      inputSchema: {
        from_format: z.enum(['json', 'csv']).describe('The source data format.'),
        to_format: z.enum(['json', 'csv']).describe('The target data format.'),
        data: z.string().describe('The string representation of the data to convert.'),
      },
    },
    async (params: { from_format: 'json' | 'csv'; to_format: 'json' | 'csv'; data: string }) => {
      const { from_format, to_format, data } = params;

      if (from_format === to_format) {
        return { content: [{ type: 'text', text: 'Source and target formats cannot be the same.' }], isError: true };
      }

      try {
        let resultData: string;
        if (from_format === 'json' && to_format === 'csv') {
          const jsonData = JSON.parse(data);
          resultData = jsonToCsv(jsonData);
        } else if (from_format === 'csv' && to_format === 'json') {
          const jsonData = csvToJson(data);
          resultData = JSON.stringify(jsonData, null, 2);
        } else {
          return { content: [{ type: 'text', text: `Unsupported conversion from ${from_format} to ${to_format}.` }], isError: true };
        }
        return { content: [{ type: 'text', text: resultData }] };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `An error occurred during transformation: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
