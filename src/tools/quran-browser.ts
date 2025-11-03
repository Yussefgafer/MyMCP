import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Quran database - use absolute path for reliability
const QURAN_DB_PATH = path.resolve(__dirname, '../../../quran-db-main/database/q-db.sqlite3');

/**
 * Executes a database query and returns the results
 */
async function queryDatabase<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const db = new Database(QURAN_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(new Error(`Failed to open database at ${QURAN_DB_PATH}: ${err.message}`));
      }
    });

    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) {
        return reject(new Error(`Failed to open database at ${QURAN_DB_PATH}: ${err.message}`));
      }
      resolve(rows as T[]);
    });
  });
}

/**
 * Quran Browser Tool
 * Provides functionality to browse and search the Quran database
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'quran-browser',
    {
      title: 'Quran Browser',
      description: 'Browse and search the Holy Quran',
      inputSchema: {
        action: z.enum([
          'list_surahs',
          'get_surah',
          'get_page',
          'search',
          'get_verse'
        ]).describe('Action to perform'),
        surah_number: z.number().int().min(1).max(114).optional()
          .describe('Surah number (1-114)'),
        ayah_number: z.number().int().min(1).optional()
          .describe('Ayah number within the surah'),
        page_number: z.number().int().min(1).optional()
          .describe('Page number (1-604)'),
        query: z.string().optional()
          .describe('Search query text'),
        limit: z.number().int().min(1).max(100).default(10)
          .describe('Maximum number of results to return (1-100)'),
        offset: z.number().int().min(0).default(0)
          .describe('Offset for pagination')
      }
    },
    async (params, extra) => {
      try {
        switch (params.action) {
          case 'list_surahs':
            return await listSurahs(params.limit, params.offset);
          case 'get_surah':
            if (!params.surah_number) {
              throw new Error('Surah number is required');
            }
            return await getSurah(params.surah_number, params.limit, params.offset);
          case 'get_page':
            if (!params.page_number) {
              throw new Error('Page number is required');
            }
            return await getPage(params.page_number);
          case 'search':
            if (!params.query) {
              throw new Error('Search query is required');
            }
            return await searchVerses(params.query, params.limit, params.offset);
          case 'get_verse':
            if (!params.surah_number || !params.ayah_number) {
              throw new Error('Both surah_number and ayah_number are required');
            }
            return await getVerse(params.surah_number, params.ayah_number);
          default:
            throw new Error('Invalid action');
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true,
          _meta: {}
        };
      }
    }
  );
};

// List all surahs with basic information
async function listSurahs(limit: number, offset: number) {
  const surahs = await queryDatabase<{
    id: number;
    name: string;
    order: number;
    type: number;
    verse_count: number;
  }>(
    `SELECT id, name, "order", type, verse_count 
     FROM chapters 
     ORDER BY "order" ASC 
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const total = await queryDatabase<{ count: number }>(
    'SELECT COUNT(*) as count FROM chapters'
  );

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        surahs: surahs.map(s => ({
          id: s.id,
          name: s.name,
          order: s.order,
          type: s.type === 1 ? 'Meccan' : 'Medinan',
          verse_count: s.verse_count
        })),
        total: total[0].count,
        limit,
        offset
      }, null, 2)
    }],
    _meta: {}
  };
}

// Get verses from a specific surah
async function getSurah(surahNumber: number, limit: number, offset: number) {
  // First get surah info
  const [surah] = await queryDatabase<{
    id: number;
    name: string;
    order: number;
    type: number;
    verse_count: number;
  }>(
    'SELECT * FROM chapters WHERE id = ?',
    [surahNumber]
  );

  if (!surah) {
    throw new Error(`Surah ${surahNumber} not found`);
  }

  // Then get verses
  const verses = await queryDatabase<{
    id: number;
    number: number;
    content: string;
  }>(
    `SELECT id, number, content 
     FROM verses 
     WHERE chapter_id = ? 
     ORDER BY number ASC 
     LIMIT ? OFFSET ?`,
    [surah.id, limit, offset]
  );

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        surah: {
          id: surah.id,
          name: surah.name,
          order: surah.order,
          type: surah.type === 1 ? 'Meccan' : 'Medinan',
          verse_count: surah.verse_count
        },
        verses: verses.map(v => ({
          id: v.id,
          ayah_number: v.number,
          text: v.content
        })),
        total: surah.verse_count,
        limit,
        offset
      }, null, 2)
    }],
    _meta: {}
  };
}

// Get verses from a specific page
async function getPage(pageNumber: number) {
  const verses = await queryDatabase<{
    id: number;
    number: number;
    content: string;
    chapter_id: number;
    chapter_name: string;
  }>(
    `SELECT v.id, v.number, v.content, c."order" as chapter_id, c.name as chapter_name
     FROM verses v
     JOIN chapters c ON v.chapter_id = c.id
     JOIN pages p ON v.page_id = p.id
     WHERE p."order" = ?
     ORDER BY c."order", v.number`,
    [pageNumber]
  );

  if (verses.length === 0) {
    throw new Error(`Page ${pageNumber} not found or has no verses`);
  }

  // Group verses by surah
  const surahs: Record<number, {
    id: number;
    name: string;
    verses: Array<{id: number; ayah_number: number; text: string}>;
  }> = {};

  for (const verse of verses) {
    if (!surahs[verse.chapter_id]) {
      surahs[verse.chapter_id] = {
        id: verse.chapter_id,
        name: verse.chapter_name,
        verses: []
      };
    }
    surahs[verse.chapter_id].verses.push({
      id: verse.id,
      ayah_number: verse.number,
      text: verse.content
    });
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        page: pageNumber,
        surahs: Object.values(surahs)
      }, null, 2)
    }],
    _meta: {}
  };
}

// Search verses by text
async function searchVerses(query: string, limit: number, offset: number) {
  const verses = await queryDatabase<{
    id: number;
    number: number;
    content: string;
    chapter_id: number;
    chapter_name: string;
  }>(
    `SELECT v.id, v.number, v.content, c."order" as chapter_id, c.name as chapter_name
     FROM verses v
     JOIN chapters c ON v.chapter_id = c.id
     WHERE v.content LIKE ?
     ORDER BY c."order", v.number
     LIMIT ? OFFSET ?`,
    [`%${query}%`, limit, offset]
  );

  const total = await queryDatabase<{ count: number }>(
    'SELECT COUNT(*) as count FROM verses WHERE content LIKE ?',
    [`%${query}%`]
  );

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        query,
        results: verses.map(v => ({
          id: v.id,
          ayah_number: v.number,
          text: v.content,
          surah: {
            id: v.chapter_id,
            name: v.chapter_name
          }
        })),
        total: total[0].count,
        limit,
        offset
      }, null, 2)
    }],
    _meta: {}
  };
}

// Get a specific verse by surah and ayah number
async function getVerse(surahNumber: number, ayahNumber: number) {
  const [verse] = await queryDatabase<{
    id: number;
    content: string;
    chapter_name: string;
  }>(
    `SELECT v.id, v.content, c.name as chapter_name
     FROM verses v
     JOIN chapters c ON v.chapter_id = c.id
     WHERE c."order" = ? AND v.number = ?`,
    [surahNumber, ayahNumber]
  );

  if (!verse) {
    throw new Error(`Verse ${surahNumber}:${ayahNumber} not found`);
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        id: verse.id,
        surah: surahNumber,
        ayah: ayahNumber,
        surah_name: verse.chapter_name,
        text: verse.content
      }, null, 2)
    }],
    _meta: {}
  };
}

export default registerTool;
