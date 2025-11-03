import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Tool: Scrape Web
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'scrape_web',
    {
      title: 'Scrape Web',
      description: 'Scrapes a website for data. Can extract all text, specific elements, links, or element attributes.',
      inputSchema: {
        url: z.string().describe("The URL of the website to scrape."),
        selector: z.string().optional().describe("A CSS selector to target specific elements."),
        extract_attribute: z.string().optional().describe("The attribute to extract from the selected elements (e.g., 'href', 'src')."),
        extract_all_text: z.boolean().optional().default(false).describe("If true, extracts all text from the page, ignoring other selectors."),
        extract_links: z.boolean().optional().default(false).describe("If true, extracts all absolute links from the page."),
        output_format: z.enum(['text', 'json']).optional().default('text').describe("The desired output format."),
      }
    },
    async ({
      url,
      selector,
      extract_attribute,
      extract_all_text,
      extract_links,
      output_format,
    }) => {
      try {
        const { data, request } = await axios.get(url, { responseType: 'text' });
        const finalUrl = request.res.responseUrl || url;
        const $ = cheerio.load(data);

        let results: string | string[];

        if (extract_all_text) {
          results = $('body').text().replace(/\s\s+/g, ' ').trim();
        } else if (extract_links) {
          results = $('a[href]').map((i, el) => {
            const href = $(el).attr('href');
            if (!href) return null;
            try {
              return new URL(href, finalUrl).href;
            } catch {
              return null; // Ignore invalid URLs
            }
          }).get().filter(Boolean);
        } else if (selector) {
          const elements = $(selector);
          if (extract_attribute) {
            results = elements.map((i, el) => $(el).attr(extract_attribute)).get().filter(Boolean);
          } else {
            results = elements.map((i, el) => $(el).text().trim()).get();
          }
        } else {
            return {
                content: [{ type: 'text', text: "Error: You must either provide a 'selector', or set 'extract_all_text' or 'extract_links' to true." }],
                isError: true,
            };
        }

        if (output_format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        } else {
          return { content: [{ type: 'text', text: Array.isArray(results) ? results.join('\n') : results }] };
        }
      } catch (error: any) {
        let errorMessage = `Error scraping web: ${error.message}`;
        if (error.response) {
            errorMessage += `\nStatus: ${error.response.status}`;
        }
        return {
          content: [{ type: 'text', text: errorMessage }],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
