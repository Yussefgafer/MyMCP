import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import sqlite3 from 'sqlite3';

/**
 * Tool: Execute SQL Query
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'execute-sql-query',
    {
      title: 'Execute SQL Query',
      description:
        'Executes a SQL query on a specified database. Parameters: database_connection_string - The connection string for the database (required); query - The SQL query to execute (required);',
      inputSchema: {
        database_connection_string: z.string(),
        query: z.string(),
      }
    },
    async ({
      database_connection_string,
      query,
    }) => {
      return new Promise((resolve) => {
        const db = new sqlite3.Database(database_connection_string, (err) => {
          if (err) {
            resolve({
              content: [{ type: 'text', text: `Error connecting to database: ${err.message}` }],
              isError: true,
            });
          }
        });

        db.all(query, [], (err, rows) => {
          if (err) {
            resolve({
              content: [{ type: 'text', text: `Error executing query: ${err.message}` }],
              isError: true,
            });
          } else {
            resolve({
              content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
            });
          }
        });

        db.close((err) => {
          if (err) {
            // This error is less critical, so we'll just log it.
            console.error(`Error closing the database: ${err.message}`);
          }
        });
      });
    }
  );
};

export default registerTool;
