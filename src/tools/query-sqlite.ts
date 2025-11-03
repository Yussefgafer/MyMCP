import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import sqlite3 from 'sqlite3';
import fs from 'fs-extra';
import { quote } from 'shell-quote';

/**
 * Tool: SQLite Database Query
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'query-sqlite',
    {
      title: 'SQLite Database Query',
      description:
        "Performs various SQLite database operations including creating databases, executing queries, importing/exporting CSV, getting schema info, and more.",
      inputSchema: {
        database_path: z.string().describe("Path to the SQLite database file."),
        operation: z.string().describe("The operation to perform: create_db, execute_query, import_csv, export_csv, get_schema, drop_table, backup, restore, transaction, get_stats."),
        query: z.string().optional().describe("SQL query to execute (for execute_query and transaction operations)."),
        table_name: z.string().optional().describe("Table name (for drop_table operation)."),
        csv_path: z.string().optional().describe("Path to CSV file (for import_csv and export_csv operations)."),
        backup_path: z.string().optional().describe("Path to backup file (for backup and restore operations)."),
      }
    },
    async (params) => {
      const { database_path, operation, query, table_name, csv_path, backup_path } = params;
      
      try {
        // Ensure the directory exists
        await fs.ensureDir(require('path').dirname(database_path));
        
        // Open database
        const db = new sqlite3.Database(database_path);
        const dbRun = (sql: string, params?: any[]) => {
          return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
              if (err) reject(err);
              else resolve(this);
            });
          });
        };
        
        const dbAll = (sql: string, params?: any[]) => {
          return new Promise<any[]>((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
        };
        
        const dbGet = (sql: string, params?: any[]) => {
          return new Promise<any>((resolve, reject) => {
            db.get(sql, params, (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });
        };
        
        const dbClose = () => {
          return new Promise<void>((resolve, reject) => {
            db.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        };
        
        let resultText = '';
        
        switch (operation) {
          case 'create_db':
            // Database is created when opened
            resultText = `SQLite database created at ${database_path}`;
            break;
            
          case 'execute_query':
            if (!query) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: 'query' parameter is required for execute_query operation." }], 
                isError: true 
              };
            }
            
            // For SELECT queries, return results
            if (query.trim().toUpperCase().startsWith('SELECT')) {
              const rows = await dbAll(query);
              resultText = JSON.stringify(rows, null, 2);
            } else {
              // For INSERT/UPDATE/DELETE, return changes
              const result: any = await dbRun(query);
              resultText = `Query executed successfully. Rows affected: ${result.changes || 0}`;
            }
            break;
            
          case 'import_csv':
            if (!csv_path) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: 'csv_path' parameter is required for import_csv operation." }], 
                isError: true 
              };
            }
            
            // Check if CSV file exists
            if (!await fs.pathExists(csv_path)) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: `Error: CSV file not found at ${csv_path}` }], 
                isError: true 
              };
            }
            
            // Read CSV file
            const csvContent = await fs.readFile(csv_path, 'utf-8');
            const lines = csvContent.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: CSV file must contain at least a header row and one data row." }], 
                isError: true 
              };
            }
            
            // Get table name from CSV file name if not provided
            const tableName = table_name || require('path').basename(csv_path, '.csv');
            
            // Parse header
            const header = lines[0].split(',').map(h => h.trim());
            
            // Create table
            const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${header.map(h => `${h} TEXT`).join(', ')})`;
            await dbRun(createTableQuery);
            
            // Insert data
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              if (values.length === header.length) {
                const placeholders = header.map(() => '?').join(', ');
                const insertQuery = `INSERT INTO ${tableName} VALUES (${placeholders})`;
                await dbRun(insertQuery, values);
              }
            }
            
            resultText = `CSV data imported successfully into table ${tableName}`;
            break;
            
          case 'export_csv':
            if (!table_name || !csv_path) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: 'table_name' and 'csv_path' parameters are required for export_csv operation." }], 
                isError: true 
              };
            }
            
            // Get table data
            const rows = await dbAll(`SELECT * FROM ${table_name}`);
            
            if (rows.length === 0) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: `Table ${table_name} is empty or does not exist.` }], 
                isError: true 
              };
            }
            
            // Generate CSV content
            const headers = Object.keys(rows[0]);
            const csvLines = [headers.join(',')];
            
            rows.forEach(row => {
              const values = headers.map(header => {
                const value = row[header];
                // Escape commas and quotes in values
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                  return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
              });
              csvLines.push(values.join(','));
            });
            
            // Write CSV file
            await fs.writeFile(csv_path, csvLines.join('\n'));
            resultText = `Table ${table_name} exported successfully to ${csv_path}`;
            break;
            
          case 'get_schema':
            const schemaRows = await dbAll(`
              SELECT name, sql FROM sqlite_master 
              WHERE type='table' AND name NOT LIKE 'sqlite_%'
              ORDER BY name
            `);
            resultText = JSON.stringify(schemaRows, null, 2);
            break;
            
          case 'drop_table':
            if (!table_name) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: 'table_name' parameter is required for drop_table operation." }], 
                isError: true 
              };
            }
            
            await dbRun(`DROP TABLE IF EXISTS ${table_name}`);
            resultText = `Table ${table_name} dropped successfully`;
            break;
            
          case 'backup':
            if (!backup_path) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: 'backup_path' parameter is required for backup operation." }], 
                isError: true 
              };
            }
            
            // Close the database first
            await dbClose();
            
            // Copy database file to backup location
            await fs.copy(database_path, backup_path);
            resultText = `Database backed up successfully to ${backup_path}`;
            break;
            
          case 'restore':
            if (!backup_path) {
              return { 
                content: [{ type: 'text', text: "Error: 'backup_path' parameter is required for restore operation." }], 
                isError: true 
              };
            }
            
            // Close the database first
            await dbClose();
            
            // Copy backup file to database location
            await fs.copy(backup_path, database_path);
            resultText = `Database restored successfully from ${backup_path}`;
            break;
            
          case 'transaction':
            if (!query) {
              await dbClose();
              return { 
                content: [{ type: 'text', text: "Error: 'query' parameter is required for transaction operation." }], 
                isError: true 
              };
            }
            
            // Begin transaction
            await dbRun('BEGIN TRANSACTION');
            
            try {
              // Execute queries
              const queries = query.split(';').filter(q => q.trim() !== '');
              for (const q of queries) {
                await dbRun(q);
              }
              
              // Commit transaction
              await dbRun('COMMIT');
              resultText = 'Transaction executed successfully';
            } catch (error) {
              // Rollback transaction on error
              await dbRun('ROLLBACK');
              throw error;
            }
            break;
            
          case 'get_stats':
            const stats = await fs.stat(database_path);
            const tableCountRow = await dbGet(`
              SELECT COUNT(*) as count FROM sqlite_master 
              WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `);
            
            resultText = JSON.stringify({
              fileSize: stats.size,
              lastModified: stats.mtime,
              tableCount: tableCountRow?.count || 0
            }, null, 2);
            break;
        }
        
        // Close database connection
        await dbClose();
        
        return { content: [{ type: 'text', text: resultText }] };
      } catch (error: any) {
        return { 
          content: [{ type: 'text', text: `Error performing SQLite operation: ${error.message}` }], 
          isError: true 
        };
      }
    }
  );
};

export default registerTool;
