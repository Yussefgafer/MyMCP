import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import sqlite3 from 'sqlite3';
import fs from 'fs-extra';
import { default as Fuse, IFuseOptions } from 'fuse.js';

export default function knowledgeBaseManager(server: McpServer) {
  server.registerTool(
    'knowledge-base-manager',
    {
      title: 'Knowledge Base Manager',
      description:
        'A comprehensive tool for managing a SQLite-based knowledge base. It allows creating the database, creating/dropping tables, adding, updating, deleting, and searching for knowledge items containing titles, content, and tags. The tool also supports listing all items, getting schema information, and executing raw SQL queries for advanced control.',
      inputSchema: {
        operation: z.enum([
          'create_db',
          'create_table',
          'drop_table',
          'add_item',
          'update_item',
          'delete_item',
          'search_items',
          'get_item',
          'list_all_items',
          'get_schema',
          'execute_sql',
          'list_tags',
        ]),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.string().optional(),
        id: z.number().int().optional(),
        query: z.string().optional(),
        search_tags: z.string().optional(),
        limit: z.number().int().min(1).optional(),
        offset: z.number().int().min(0).optional(),
        sql_query: z.string().optional(),
        fuzzy_threshold: z.number().min(0).max(1).optional(),
        fuzzy_keys: z.string().optional(), // Comma-separated string of keys
      },
    },
    async (params) => {
      const dbPath = '/home/youusef/knowledge_base.db';
      let sqlQuery = '';
      let queryParams: any[] = [];

      try {
        // Ensure the directory exists
        await fs.ensureDir(require('path').dirname(dbPath));
        
        // Open database
        const db = new sqlite3.Database(dbPath);
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
        
        const dbClose = () => {
          return new Promise<void>((resolve, reject) => {
            db.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        };
        
        let resultText = '';
        
        switch (params.operation) {
          case 'create_db':
            // Database is created when opened
            resultText = `SQLite database created at ${dbPath}`;
            break;

          case 'create_table':
            sqlQuery = `
              CREATE TABLE IF NOT EXISTS knowledge_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT,
                tags TEXT
              );
            `;
            await dbRun(sqlQuery);
            resultText = `Table 'knowledge_items' created successfully`;
            break;

          case 'drop_table':
            sqlQuery = `DROP TABLE IF EXISTS knowledge_items;`;
            await dbRun(sqlQuery);
            resultText = `Table 'knowledge_items' dropped successfully`;
            break;

          case 'add_item':
            if (params.title === undefined || params.content === undefined) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Error: title and content are required for add_item operation',
                  },
                ],
                isError: true,
              };
            }
            sqlQuery = `INSERT INTO knowledge_items (title, content, tags) VALUES (?, ?, ?);`;
            queryParams = [params.title, params.content, params.tags || ''];
            const result: any = await dbRun(sqlQuery, queryParams);
            resultText = `Item added successfully with ID: ${result.lastID}`;
            break;

          case 'update_item':
            if (params.id === undefined) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Error: id is required for update_item operation',
                  },
                ],
                isError: true,
              };
            }
            // Build SQL dynamically based on provided fields
            const updates: string[] = [];
            const updateParams: any[] = [];
            if (params.title !== undefined) {
              updates.push('title = ?');
              updateParams.push(params.title);
            }
            if (params.content !== undefined) {
              updates.push('content = ?');
              updateParams.push(params.content);
            }
            if (params.tags !== undefined) {
              updates.push('tags = ?');
              updateParams.push(params.tags);
            }

            if (updates.length === 0) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'No fields provided for update.',
                  },
                ],
              };
            }

            sqlQuery = `UPDATE knowledge_items SET ${updates.join(', ')} WHERE id = ?;`;
            queryParams = [...updateParams, params.id];
            
            await dbRun(sqlQuery, queryParams);
            resultText = `Item ${params.id} updated successfully`;
            break;

          case 'delete_item':
            if (params.id === undefined) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Error: id is required for delete_item operation',
                  },
                ],
                isError: true,
              };
            }
            sqlQuery = `DELETE FROM knowledge_items WHERE id = ?;`;
            queryParams = [params.id];
            await dbRun(sqlQuery, queryParams);
            resultText = `Item ${params.id} deleted successfully`;
            break;

          case 'get_item':
            if (params.id === undefined) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Error: id is required for get_item operation',
                  },
                ],
                isError: true,
              };
            }
            sqlQuery = `SELECT id, title, content, tags FROM knowledge_items WHERE id = ?;`;
            queryParams = [params.id];
            const rows = await dbAll(sqlQuery, queryParams);
            
            if (rows.length === 0) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: `Item with ID ${params.id} not found`,
                  },
                ],
                isError: true,
              };
            }
            
            resultText = JSON.stringify(rows[0], null, 2);
            break;

          case 'search_items':
            const allItems = await dbAll('SELECT * FROM knowledge_items');
            
            if (params.query) {
              const fuseOptions: IFuseOptions<any> = {
                keys: params.fuzzy_keys ? params.fuzzy_keys.split(',').map(key => key.trim()) : ['title', 'content', 'tags'],
                includeScore: true,
                threshold: params.fuzzy_threshold !== undefined ? params.fuzzy_threshold : 0.4,
              };
              const fuse = new Fuse(allItems, fuseOptions);
              
              const searchResults = fuse.search(params.query);
              resultText = JSON.stringify(searchResults.map((result: { item: any }) => result.item), null, 2);
            } else if (params.search_tags) {
              const searchTagsArray = params.search_tags.split(/[\s,]+/).filter(Boolean); // Filter out empty strings
              const filteredResults = allItems.filter(item => {
                const itemTags = item.tags ? item.tags.split(/[\s,]+/).filter(Boolean) : [];
                return searchTagsArray.some(searchTag => itemTags.includes(searchTag));
              });
              resultText = JSON.stringify(filteredResults, null, 2);
            } else {
              resultText = JSON.stringify(allItems, null, 2);
            }
            
            break;

          case 'list_all_items':
            let allLimitOffset = '';
            if (params.limit !== undefined) allLimitOffset += ` LIMIT ${params.limit}`;
            if (params.offset !== undefined) allLimitOffset += ` OFFSET ${params.offset}`;
            sqlQuery = `SELECT id, title, content, tags FROM knowledge_items ${allLimitOffset};`;
            const listResults = await dbAll(sqlQuery);
            resultText = JSON.stringify(listResults, null, 2);
            break;

          case 'get_schema':
            sqlQuery = `PRAGMA table_info(knowledge_items);`;
            const schemaResults = await dbAll(sqlQuery);
            resultText = JSON.stringify(schemaResults, null, 2);
            break;

          case 'execute_sql':
            if (params.sql_query === undefined) {
              await dbClose();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Error: sql_query is required for execute_sql operation',
                  },
                ],
                isError: true,
              };
            }
            const sqlResults = await dbAll(params.sql_query);
            resultText = JSON.stringify(sqlResults, null, 2);
            break;

          case 'list_tags':
            // Fetch distinct tag strings from the database
            const distinctTagStrings = await dbAll('SELECT DISTINCT tags FROM knowledge_items WHERE tags IS NOT NULL AND tags != ""');
            const tagSet = new Set<string>();
            distinctTagStrings.forEach(item => {
              if (item.tags) {
                // Split each distinct tag string and add individual tags to the set
                item.tags.split(/[\s,]+/).filter(Boolean).forEach((tag: string) => tagSet.add(tag.trim()));
              }
            });
            resultText = JSON.stringify(Array.from(tagSet), null, 2);
            break;

          default:
            await dbClose();
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown operation: ${params.operation}`,
                },
              ],
              isError: true,
            };
        }
        
        // Close database connection
        await dbClose();
        
        return { content: [{ type: 'text', text: resultText }] };
      } catch (error: any) {
        return { 
          content: [{ type: 'text', text: `Database error: ${error.message}` }], 
          isError: true 
        };
      }
    },
  );
}
