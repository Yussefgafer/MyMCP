import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios, { AxiosProxyConfig, AxiosRequestConfig } from 'axios';
import https from 'https';

/**
 * Tool: Make HTTP Request
 * Registers the tool with the MCP server
 * @param server MCP server instance
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'make-http-request',
    {
      title: 'Make HTTP Request',
      description:
        "Sends an HTTP request with comprehensive options for headers, data, proxy, authentication, and more.",
      inputSchema: {
        url: z.string().describe("The URL for the request."),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET').describe("HTTP method."),
        headers: z.string().optional().describe("A JSON string representing the request headers."),
        data: z.string().optional().describe("Request body data (for POST, PUT). Can be a string or a JSON string."),
        params: z.string().optional().describe("A JSON string representing the URL parameters."),
        proxy: z.string().optional().describe("Proxy server URL (e.g., 'http://user:pass@host:port')."),
        timeout: z.number().int().min(0).optional().describe("Request timeout in milliseconds."),
        follow_redirects: z.boolean().optional().default(true).describe("Whether to follow redirects."),
        verify_ssl: z.boolean().optional().default(true).describe("Verify SSL certificates."),
        auth: z.string().optional().describe("Basic authentication credentials in 'user:password' format."),
        output_raw: z.boolean().optional().default(false).describe("If true, returns only the raw response body."),
        include_headers: z.boolean().optional().default(false).describe("If true, includes response headers in the output."),
      }
    },
    async (args) => {
      try {
        const { url, method, headers, data, params, proxy, timeout, follow_redirects, verify_ssl, auth, output_raw, include_headers } = args;

        let parsedHeaders, parsedParams, parsedData;
        try {
            if (headers) parsedHeaders = JSON.parse(headers);
            if (params) parsedParams = JSON.parse(params);
            if (data) {
                try {
                    parsedData = JSON.parse(data);
                } catch {
                    parsedData = data; // Keep as string if not valid JSON
                }
            }
        } catch (e: any) {
            return { content: [{ type: 'text', text: `Error parsing JSON input: ${e.message}` }], isError: true };
        }

        let proxyConfig: AxiosProxyConfig | undefined;
        if (proxy) {
            const proxyUrl = new URL(proxy);
            proxyConfig = {
                host: proxyUrl.hostname,
                port: Number(proxyUrl.port),
                protocol: proxyUrl.protocol.replace(':', ''),
                auth: proxyUrl.username && proxyUrl.password ? {
                    username: decodeURIComponent(proxyUrl.username),
                    password: decodeURIComponent(proxyUrl.password),
                } : undefined,
            };
        }
        
        const authCredentials = auth ? { username: auth.split(':')[0], password: auth.split(':')[1] } : undefined;

        const requestConfig: AxiosRequestConfig = {
          url,
          method,
          headers: parsedHeaders,
          data: parsedData,
          params: parsedParams,
          timeout,
          maxRedirects: follow_redirects ? 5 : 0,
          httpsAgent: new https.Agent({ rejectUnauthorized: verify_ssl }),
          proxy: proxyConfig,
          auth: authCredentials,
        };

        const response = await axios(requestConfig);

        if (output_raw) {
          return { content: [{ type: 'text', text: typeof response.data === 'string' ? response.data : JSON.stringify(response.data) }] };
        }

        const result: any = {
            status: response.status,
            data: response.data,
        };

        if (include_headers) {
            result.headers = response.headers;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorDetails = {
            message: error.message,
            status: error.response?.status,
            headers: error.response?.headers,
            data: error.response?.data,
          };
          return {
            content: [{ type: 'text', text: `Error making HTTP request:\n${JSON.stringify(errorDetails, null, 2)}` }],
            isError: true
          };
        }
        return {
          content: [{ type: 'text', text: `An unexpected error occurred: ${String(error)}` }],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
