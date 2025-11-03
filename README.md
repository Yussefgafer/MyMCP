# File Operation MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)

A **Model Context Protocol (MCP)** based file operation server, providing file statistics, list queries, image compression, and various system utilities.

## ✨ Features

- 📊 **File Statistics** - Count files in a specified folder
- 📋 **File Listing** - Get detailed information of all files in a folder
- 🖼️ **Image Compression** - High-quality image compression, supporting multiple formats
- 🗜️ **File Compression** - Create ZIP, TAR, TAR.GZ archive files
- 📦 **File Extraction** - Extract ZIP, TAR, TAR.GZ archive files
- 📂 **File Copy** - Copy files or folders to a specified location
- 🔄 **File Move** - Move files or folders to a specified location
- 📄 **PDF Merge** - Merge multiple PDF files into one
- ✂️ **PDF Split** - Split PDF files by page or range
- 🖼️ **PDF to Image** - Convert PDF pages to JPEG/PNG images
- 🔒 **Secure & Reliable** - Comprehensive error handling and parameter validation
- ⚡ **High Performance** - Built with TypeScript and powered by **Bun** for speed.

## 🛠️ Technology Stack

- **TypeScript** - Type-safe JavaScript
- **Bun** - High-performance JavaScript runtime, used for running the server.
- **MCP SDK** - Official Model Context Protocol SDK
- **Sharp** - High-performance image processing library
- **PDF-lib** - Pure JavaScript PDF processing library, supports merging and splitting
- **PDF2pic** - PDF to image conversion tool
- **Mammoth** - Word document processing library
- **Puppeteer** - Headless browser, used for PDF generation
- **Archiver** - File compression library, supports ZIP, TAR, etc.
- **Extract-Zip** - ZIP file extraction library
- **TAR** - TAR format file processing library
- **fs-extra** - Enhanced file system operations
- **Zod** - TypeScript-first data validation

## 📦 Installation

### Environment Requirements

- Node.js >= 18.0.0 (for `pnpm` build steps)
- **Bun** (recommended for running the server)
- pnpm (recommended for package installation and build)

### Clone Project

```bash
git clone https://github.com/lxKylin/file-operation-mcp.git
cd file-operation-mcp
```

### Install Dependencies

```bash
bun install # Use Bun for faster installation
pnpm install # (Alternative if Bun is not preferred, or for specific build dependencies)
```

### Build Project

```bash
pnpm build
## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TIME_LIMIT` | Default time limit for operations (seconds) | `120` | `300` |
| `MAX_TIME_LIMIT` | Maximum allowed time limit (seconds) | `600` | `1800` |

### Example Usage

```bash
# Set custom time limit (5 minutes)
TIME_LIMIT=300 bun run start

# Set maximum time limit (30 minutes)
MAX_TIME_LIMIT=1800 bun run start
```

## 🔌 Transport Method Comparison

This project supports two MCP transport methods. You can choose the appropriate method based on your usage scenario:

### 📊 Stdio vs SSE Comparison Table

| Feature | Stdio | SSE |
|---|---|---|
| **Transfer Protocol** | Inter-process Communication (IPC) | HTTP/HTTPS |
| **Connection Method** | stdin/stdout | Server-Sent Events |
| **Multi-client Support** | ❌ 1-to-1 connection | ✅ Many-to-1 connection |
| **Remote Access** | ❌ Local only | ✅ Supported |
| **Deployment Complexity** | ✅ Simple | ❌ Requires HTTP server |
| **Resource Usage** | ✅ Low | ❌ Relatively higher |
| **Debugging Convenience** | ❌ Difficult | ✅ Easy (HTTP tools) |
| **Network Traversal** | ❌ Not supported | ✅ Supported |
| **Load Balancing** | ❌ Not supported | ✅ Supported |
| **Monitoring Capabilities** | ❌ Limited | ✅ Rich (health checks, etc.) |
| **Latency** | ✅ Very Low (~1-5ms) | ❌ Slightly Higher (~10-50ms) |

### 🎯 Recommended Use Cases

#### Choose Stdio if you need:
- 🏠 **Local Development**: Simple personal desktop tools
- 🔒 **Single User**: Applications for personal use only
- ⚡ **Low Latency**: Extremely high response time requirements
- 📦 **Simple Deployment**: Don't want to configure an HTTP server
- 💾 **Resource Saving**: Limited system resources

#### Choose SSE if you need:
- 🌐 **Remote Access**: Connect to the server over a network
- 👥 **Multi-user**: Team-shared server
- 🔄 **High Availability**: Requires load balancing and failover
- 🐛 **Easy Debugging**: Convenient debugging tools during development
- 📈 **Scalability**: May need horizontal scaling in the future
- 🔍 **Monitoring Needs**: Requires detailed service monitoring

### 🔧 Performance Comparison

#### Stdio Architecture
```
Client <─> Server Process (Direct IPC)
Latency: 1-5ms | Memory: Low | CPU: Low
```

#### SSE Architecture  
```
Client <─> HTTP Server <─> MCP Server
Latency: 10-50ms | Memory: Medium | CPU: Medium
```

### 🛠️ Code Difference Example

#### Stdio Startup
```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Stdio MCP server started');
```

#### SSE Startup
```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

const app = express();
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.listen(3000, () => {
  console.error('SSE MCP server started on port 3000');
});
```

> 💡 **Recommendation**: If you are a single user and only need local use, choose **Stdio**; if you need team collaboration or remote access, choose **SSE**.

## ⚙️ Stdio Configuration

### Claude Desktop Configuration

Add the following configuration to Claude Desktop's configuration file:

**Configuration File Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**Configuration Content:**
```json
{
  "mcpServers": {
    "file-operation-mcp": {
      "command": "node",
      "args": ["path/to/file-operation-mcp/dist/index.js"],
      "cwd": "path/to/file-operation-mcp",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

> ⚠️ **Note**: Please replace `path/to/file-operation-mcp` with the actual project path

### Cursor IDE Configuration

```json
{
  "mcpServers": {
    "file-operation-mcp": {
      "command": "node",
      "args": ["path/to/file-operation-mcp/dist/index.js"]
    }
  }
}
```

## ⚙️ SSE Configuration

### Starting the SSE Server

First, start the HTTP server:

```bash
bun start
# Or using pnpm (less recommended for runtime due to Bun's performance)
```
The server will be available at:
- Health check: http://localhost:3000/health
- MCP endpoint: http://localhost:3000/sse

##  Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TIME_LIMIT` | Default time limit for operations (seconds) | `120` | `300` |
| `MAX_TIME_LIMIT` | Maximum allowed time limit (seconds) | `600` | `1800` |
# Check server health status
curl http://localhost:3000/health

# Example response
{
  "status": "ok",
  "message": "MCP File Operation Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Claude Desktop Configuration

Add the following configuration to Claude Desktop's configuration file:

```json
{
  "mcpServers": {
    "file-operation-mcp": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### Cursor IDE Configuration

```json
{
  "mcpServers": {
    "file-operation-mcp": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### SSE Endpoint Description

- **SSE Connection**: `http://localhost:3000/sse` - Primary MCP connection endpoint
- **Message Handling**: `http://localhost:3000/messages` - Handles JSON-RPC messages
- **Health Check**: `http://localhost:3000/health` - Server status check
- **Port Configuration**: Can be modified via `PORT` environment variable, defaults to 3000

> ⚠️ **Note**: SSE mode requires manual server startup first, then client connection configuration.

## 🚀 Usage

After configuration, restart Claude Desktop to use the following features in your conversations:

### 1. File Counting (count-files)

Counts the number of files in a specified folder, defaults to desktop files.

**Parameters:**
- `folderPath` (Optional): Folder path, defaults to desktop

**Example:**
```
Please count how many files are on my desktop
```
```
Please count the number of files in /Users/username/Documents folder
```

### 2. File Listing (list-files)

Gets detailed information of all files in a specified folder, including filename, type, and size.

**Parameters:**
- `folderPath` (Optional): Folder path, defaults to desktop
- `includeHidden` (Optional): Whether to include hidden files, defaults to false

**Example:**
```
Please list all files on my desktop
```
```
Please show the contents of /Users/username/Downloads folder, including hidden files
```

### 3. Image Compression (compress-image)

Compresses specified image files, supports various formats and custom parameters.

**Parameters:**
- `imagePath`: Image file path (Required)
- `quality` (Optional): Compression quality (1-100), defaults to 80
- `maxWidth` (Optional): Maximum width limit
- `maxHeight` (Optional): Maximum height limit  
- `outputPath` (Optional): Output path, defaults to original filename with `_compressed` suffix

**Supported Formats:**
- JPEG/JPG
- PNG
- WebP
- TIFF
- GIF

**Example:**
```
Please compress /Users/username/Desktop/photo.jpg to 60% quality
```
```
Please compress image /path/to/image.png, limit max width to 1920 pixels
```

### 4. File Compression (create-archive)

Compresses files or folders into ZIP, TAR, or TAR.GZ format.

**Parameters:**
- `files`: Array of file/folder paths to compress (Required)
- `outputPath`: Output archive file path (Required)
- `format` (Optional): Compression format (zip, tar, tar.gz), defaults to zip
- `compressionLevel` (Optional): Compression level (0-9), defaults to 6

**Supported Formats:**
- **ZIP** - General compression format, best compatibility
- **TAR** - Common Unix/Linux format, no compression
- **TAR.GZ** - TAR format + GZIP compression, high compression ratio

**Example:**
```
Please compress /Users/username/Documents folder to ZIP format
```
```
Please compress files ["/path/file1.txt", "/path/file2.txt"] to /backup/files.tar.gz format
```
```
Please compress the project folder into a high-compression ZIP package
```

### 5. File Extraction (extract-archive)

Extracts ZIP, TAR, or TAR.GZ files to a specified directory.

**Parameters:**
- `archivePath`: Archive file path (Required)
- `extractTo`: Target directory for extraction (Required)
- `overwrite` (Optional): Whether to overwrite existing files, defaults to false

**Supported Formats:**
- **ZIP** - .zip file
- **TAR** - .tar file
- **TAR.GZ** - .tar.gz, .tgz files

**Example:**
```
Please extract /Downloads/archive.zip to /Projects/ directory
```
```
Please extract /backup/files.tar.gz to /restore/ and overwrite existing files
```
```
Please extract the archive to a temporary folder
```

**Notes:**
- Checks if the target directory is empty before extraction (unless overwrite=true)
- Supports automatic detection of compression format
- Displays extracted file count and total size
- Maintains original file structure during extraction

### 6. File Copy (copy-files)

Copies a file or folder to a specified location, keeping the original file unchanged.

**Parameters:**
- `sourcePath`: Source file/folder path (Required)
- `targetPath`: Target path (Required)
- `overwrite` (Optional): Whether to overwrite existing files, defaults to false
- `preserveTimestamps` (Optional): Whether to preserve timestamps, defaults to true

**Features:**
- Supports file and folder copying
- Recursively copies entire directory structure
- Option to preserve original timestamps
- Security checks prevent accidental overwrites
- Displays copy details and file statistics

**Example:**
```
Please copy /Users/username/Documents/report.pdf to /backup/ directory
```
```
Please copy the entire project folder to a backup directory, preserving timestamps
```
```
Please copy the file and overwrite the existing target file
```

### 7. File Move (move-files)

Moves a file or folder to a specified location, equivalent to a cut operation.

**Parameters:**
- `sourcePath`: Source file/folder path (Required)
- `targetPath`: Target path (Required)
- `overwrite` (Optional): Whether to overwrite existing files, defaults to false

**Features:**
- Supports file and folder moving
- Atomic operation, ensuring data integrity
- Automatic verification of move completion
- Prevents source and target paths from being the same
- Cross-filesystem move support

**Example:**
```
Please move /Downloads/archive.zip to /Projects/ directory
```
```
Please move the temporary folder to a permanent storage location
```
```
Please move the file and overwrite the same-named file at the target location
```

**Notes:**
- Move operation deletes the original file/folder
- Supports cross-partition/drive moves
- Verifies target directory permissions before moving
- Validates results after operation completion

### 8. PDF Merge (merge-pdf)

Merges multiple PDF files into a single complete PDF document.

**Parameters:**
- `inputPaths`: Array of PDF file paths (Required)
- `outputPath`: Output PDF file path (Required)
- `title` (Optional): Title of the merged PDF

**Features:**
- Supports merging any number of PDF files
- Maintains original page format and quality
- Automatically sets document metadata
- Detailed merge statistics report
- Automatically adds .pdf extension

**Example:**
```
Please merge these PDF files: ["/reports/report1.pdf", "/reports/report2.pdf"] to "/merged/combined_report.pdf"
```
```
Please merge project documents, set title to "Complete Project Documentation"
```

### 9. PDF Split (split-pdf)

Splits a PDF file into multiple independent files, supporting splitting by page or custom range.

**Parameters:**
- `inputPath`: Input PDF file path (Required)
- `outputDir`: Output directory (Required)
- `splitMode` (Optional): Split mode - `pages` (one file per page) or `ranges` (split by range), defaults to pages
- `ranges` (Optional): Array of page ranges, e.g., ["1-3", "4-6"], only required for ranges mode
- `prefix` (Optional): Output filename prefix, defaults to original filename

**Features:**
- Two splitting modes: page-by-page splitting or range splitting
- Flexible page range settings
- Maintains original page format
- Automatic file naming and numbering
- Detailed splitting statistics

**Example:**
```
Please split "/documents/manual.pdf" by page to "/pages/" directory
```
```
Please split the PDF by ranges: ["1-5", "6-10", "11-15"]
```
```
Please split pages 3 to 8 of the PDF into separate files
```
- Before splitting

![](./src/assets/images/split-pdf-all.png)

- After splitting

![](./src/assets/images/split-pdf-1-5.png)

### 10. PDF to Image (pdf-to-image)

Converts PDF pages to high-quality image files, supports various formats and custom settings.

**Parameters:**
- `inputPath`: Input PDF file path (Required)
- `outputDir`: Output directory (Required)
- `format` (Optional): Image format - `jpeg` or `png`, defaults to jpeg
- `quality` (Optional): Image quality 1-100, defaults to 80
- `dpi` (Optional): Resolution DPI 50-600, defaults to 150
- `pages` (Optional): Page range, e.g., "1-3" or "1,3,5", defaults to all pages
- `prefix` (Optional): Output filename prefix

**Features:**
- Supports JPEG and PNG formats
- Adjustable image quality and resolution
- Flexible page selection (range, list, single page)
- Batch processing of all pages
- Detailed conversion statistics

**Example:**
```
Please convert "/docs/presentation.pdf" to PNG image, 300 DPI resolution
```
```
Please convert only pages 1, 3, and 5 of the PDF to JPEG images
```
```
Please convert PDF pages 10-20 to high-quality images
```

**Notes:**
- PDF to image conversion requires system support for ImageMagick or GraphicsMagick
- High resolution settings will increase file size and processing time
- PNG format files are larger but higher quality
- Recommended resolution: 150 DPI for screen display, 300 DPI for printing

### 11. SQLite Database Operations (query-sqlite)

Performs various SQLite database operations including creating databases, executing queries, importing/exporting CSV, getting schema info, and more.

**Parameters:**
- `database_path`: SQLite database file path (Required)
- `operation`: Operation type (Required) - create_db, execute_query, import_csv, export_csv, get_schema, drop_table, backup, restore, transaction, get_stats
- `query` (Optional): SQL query statement (for execute_query and transaction operations)
- `table_name` (Optional): Table name (for drop_table, export_csv, etc. operations)
- `csv_path` (Optional): CSV file path (for import_csv and export_csv operations)
- `backup_path` (Optional): Backup file path (for backup and restore operations)

**Features:**
- Create new SQLite databases
- Execute SELECT, INSERT, UPDATE, DELETE and other SQL queries
- Import data from CSV files to database tables
- Export database tables as CSV files
- Get database table schema information
- Delete database tables
- Backup and restore database files
- Execute transactions to ensure data consistency
- Get database statistics

**Example:**
```
Please create a new SQLite database /data/mydb.sqlite
```
```
Please execute query "SELECT * FROM users WHERE age > 18" in /data/mydb.sqlite database
```
```
Please import /data/users.csv into /data/mydb.sqlite database
```
```
Please backup /data/mydb.sqlite database to /backup/mydb_backup.sqlite
```

### 12. Advanced File Compression (compress-files)

Compresses or decompresses files with various formats and options including ZIP, TAR, GZIP, BZIP2.

**Parameters:**
- `source_paths`: File or directory paths to compress (Required, space-separated)
- `destination_path`: Output archive file path (Required)
- `operation`: Operation type (Required) - compress, decompress, info, update, test, encode
- `format` (Optional): Compression format - zip, tar, gzip, bzip2, defaults to zip
- `compression_level` (Optional): Compression level 0-9, defaults to 6
- `password` (Optional): Password for ZIP archives
- `exclude_patterns` (Optional): File/directory patterns to exclude (space-separated)
- `encoding` (Optional): Filename encoding

**Features:**
- Supports multiple compression formats (ZIP, TAR, GZIP, BZIP2)
- Adjustable compression levels
- ZIP archive password protection
- File exclusion patterns
- View compressed file information
- Test compressed file integrity
- Decompress archive files

**Example:**
```
Please compress /Documents/ and /Projects/ directories to /backup/archive.zip
```
```
Please create /data/files.tar.gz archive with highest compression level
```
```
Please decompress /backup/archive.zip to /restore/ directory
```
```
Please test the integrity of /backup/archive.zip
```

### 13. Text Processing (process-text)

Performs various text processing operations including sorting lines, removing duplicates, filtering patterns, replacing text, counting words/lines, and more.

**Parameters:**
- `file_path`: Path to the text file to process (Required)
- `operation`: Operation type (Required) - sort, dedupe, filter, replace, count, convert_encoding, split, merge, case_transform, prefix_suffix, tabs_spaces, trim
- `sort_order` (Optional): Sort order asc/desc (for sort operation)
- `filter_pattern` (Optional): Filter pattern (for filter operation)
- `is_regex` (Optional): Whether it's a regex, defaults to false (for filter and replace operations)
- `find_text` (Optional): Text to find (for replace operation)
- `replace_text` (Optional): Replacement text (for replace operation)
- `merge_paths` (Optional): File paths to merge (for merge operation)
- `case_option` (Optional): Case transformation option upper/lower/capitalize (for case_transform operation)
- `prefix` (Optional): Line prefix (for prefix_suffix operation)
- `suffix` (Optional): Line suffix (for prefix_suffix operation)
- `tab_size` (Optional): Tab size, defaults to 4 (for tabs_spaces operation)
- `output_path` (Optional): Output file path

**Features:**
- Sort text lines (ascending/descending)
- Remove duplicate lines
- Text filtering (plain text/regex)
- Text replacement (plain text/regex)
- Count words, lines, characters
- Text case transformation
- Add line prefixes/suffixes
- Tab to space conversion
- Merge multiple text files
- Trim leading/trailing whitespace

**Example:**
```
Please sort /data/sorted.txt file in ascending order
```
```
Please remove duplicate lines from /logs/error.log
```
```
Please filter lines containing "ERROR" from /data/input.txt
```
```
Please merge /data/file1.txt and /data/file2.txt to /output/merged.txt
```
```
Please convert text in /data/input.txt to uppercase
```

## 📸 Feature Demo

### File Listing Query
Defaults to querying desktop files, or specify a path:

![File Listing Query](./src/assets/images/list-files.png)

### File Count Statistics
Quickly count files in a specified directory:

![File Count Statistics](./src/assets/images/count-files.png)

### Image Compression Feature
High-quality image compression, supports custom parameters:

![Image Compression Feature](./src/assets/images/compress-image.png)

![Compression Effect Display](./src/assets/images/compress-image-demo.png)

## 🔧 Development

### Development Mode

```bash
pnpm dev
```

### Code Formatting

```bash
pnpm format
```

### Code Linting

```bash
pnpm lint
```

### Start Server

```bash
bun start # Now uses Bun for faster startup
```

## ⚠️ Notes

1.  **Permission Requirements**: Ensure Node.js has access to the target folders
2.  **Path Format**: 
    - macOS/Linux: `/Users/username/path`
    - Windows: `C:\Users\username\path`
3.  **Image Formats**: Only common image formats (JPEG, PNG, WebP, TIFF, GIF) are supported
4.  **Archive Formats**: Supports ZIP, TAR, TAR.GZ for compression and extraction
5.  **File Operations**: Copy and move operations support files and folders
6.  **PDF Processing**: PDF merge, split, and convert-to-image functions are purely JavaScript-based
7.  **Image Conversion**: PDF to image conversion requires ImageMagick or GraphicsMagick system support
8.  **File Permissions**: Ensure appropriate permissions for source files and target directories
9.  **Overwrite Protection**: By default, existing files are not overwritten; explicit setting is required
10. **File Size**: Large file processing may take longer
11. **Debugging Output**: Use `console.error()` instead of `console.log()` to avoid interfering with the MCP protocol

## 🐛 Troubleshooting

### Common Issues

**1. Server Startup Failure**
```
Error: Cannot find module 'xxx'
```
**Solution**: Ensure `bun install` (or `pnpm install`) and `pnpm build` have been run.

**2. Permission Error**
```
Error: EACCES: permission denied
```
**Solution**: Check folder access permissions, or use a path with appropriate permissions.

**3. Path Does Not Exist**
```
Error: Path /xxx does not exist
```
**Solution**: Confirm the path is correct, use absolute paths.

**4. Unsupported Image Format**
```
Error: Unsupported image format .xxx
```
**Solution**: Use a supported image format (jpg, png, webp, tiff, gif).

**5. Archive Creation Failure**
```
Error: An error occurred while creating the archive
```
**Solution**: 
- Check if file paths are correct
- Ensure write permissions for the output directory
- Check for sufficient disk space

**6. File Extraction Failure**
```
Error: Target directory is not empty
```
**Solution**: Set `overwrite=true` or clear the target directory.

**7. Unsupported Archive Format**
```
Error: Unsupported archive format
```
**Solution**: Use a supported format (.zip, .tar, .tar.gz, .tgz).

**8. File Copy Failure**
```
Error: Target path already exists
```
**Solution**: Set `overwrite=true` or choose a different target path.

**9. File Move Failure**
```
Error: Source path and target path cannot be the same
```
**Solution**: Ensure source and target paths are different.

**10. Insufficient Permissions**
```
Error: EACCES: permission denied
```
**Solution**: 
- Check access permissions for source files and target directories
- Ensure sufficient disk space
- Avoid moving critical system files

**11. Corrupted PDF File**
```
Error: Unable to process PDF file
```
**Solution**: 
- Check if the PDF file is complete and undamaged
- Confirm the PDF file is not password protected
- Try verifying the file with another PDF viewer

**12. PDF to Image Conversion Failure**
```
Error: Batch conversion failed
```
**Solution**: 
- Ensure ImageMagick or GraphicsMagick is installed on the system
- Check system PATH environment variable configuration
- Lower DPI settings or reduce the number of pages

**13. Page Range Error**
```
Error: Page range out of valid bounds
```
**Solution**: 
- Check the actual number of pages in the PDF file
- Ensure page range format is correct (e.g., "1-5", "1,3,5")
- Page numbering starts from 1, not 0

### Debugging Tips

1.  Check Claude Desktop's developer console
2.  Check server log output
3.  Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for debugging
