# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a suite of client-side browser-based developer tools, hosted on GitHub Pages. All tools are self-contained single HTML files with embedded CSS and JavaScript - no build process, no dependencies, no backend servers. All processing happens entirely in the user's browser.

## Architecture

**Single-File Design Pattern**: Each tool is typically a standalone HTML file containing:
- Inline CSS in `<style>` tags for styling
- Vanilla JavaScript in `<script>` tags for functionality
- No external dependencies or frameworks (with rare exceptions noted in tool descriptions)
- Exception: Some tools may extract logic into separate `.js` files when shared with test files to prevent code duplication (e.g., `psalm-compare.js`)

**Data Privacy**: A core principle is that no data leaves the user's browser. Each tool includes a notice at the bottom of the page stating "All processing for this is done in your browser; no data is sent to any remote server."

## Current Tools

### ai-csv.html - AI CSV Transformer
Transforms CSV data using AI-generated JavaScript functions without uploading data to any LLM service.
- User pastes CSV data and describes desired transformation
- Generates a prompt for user to give to their AI assistant
- User pastes back the AI-generated JavaScript function
- Transformation executes locally in browser
- Multi-step workflow with visual feedback

### dns-lookup.html - DNS Lookup Tool
Queries DNS records for any domain using DNS-over-HTTPS (Google's public DNS API).
- Supports multiple record types: A, AAAA, MX, TXT, NS, CNAME, SOA, PTR, CAA, SRV
- Real-time DNS queries with formatted results
- Displays TTL, record type, and type-specific data (e.g., MX priority, SOA fields)
- Includes basic domain validation
- Note: This tool does make external requests to Google's DNS API, but no user data is stored

### jwt.html - JWT Parser and Editor
Decodes JWT tokens into header/payload/signature components, allows editing, and reconstructs tokens.
- Uses base64url encoding/decoding functions
- Real-time validation with error messages
- Does NOT sign tokens (user must provide signatures)

### markdown-gdoc.html - Markdown to Google Doc Converter
Converts markdown to formatted HTML that can be pasted directly into Google Docs with preserved formatting.
- Real-time preview of formatted markdown
- Copy to clipboard as rich HTML (works in modern browsers)
- Uses marked.js library for markdown parsing
- Supports standard markdown: headings, lists, code blocks, tables, bold, italic, links, etc.
- Includes styling optimized for Google Docs compatibility
- Note: This tool loads the marked.js library from a CDN (exception to the no-dependencies rule)

### psalm-compare.html - Psalm Array Type Comparator
Compares two Psalm array type definitions from error messages and shows only the differences.
- Extracts two `array{}` type definitions from any error message text
- Parses array shapes with support for nested structures (e.g., `array<array-key, mixed>`)
- Handles commas within type definitions and sub-types
- Outputs JSON showing keys that differ or exist in only one array
- Example output: `{"role": {"first": "array<array-key, mixed>", "second": "list<string>"}}`
- Note: Core logic is in `psalm-compare.js` (shared with `psalm-compare.test.js`) to prevent code drift

### sql-csv.html - CSV Tools
Works with CSV/TSV data, including converting SQL CLI table output (the ASCII art format with `+--+` borders) into CSV format. Filename kept as `sql-csv.html` to preserve the published URL.
- Extracts specific columns by name
- CSV/TSV data can also be pasted directly into the output box, and column extract/wrap still work
- Unique and sort options: de-duplicate and/or sort the column list (numeric-aware); either one defaults to the first column when no name is given
- Wrap feature: replaces `%%` placeholders with column values
- Download button saves the CSV/TSV box as a `.csv`/`.tsv` file via a `Blob` object URL (no server involved)
- Example input format:
  ```
  +---------+--------------+
  | user_id | name         |
  +---------+--------------+
  |       1 | Tim Fish     |
  ```

### sql-insert.html - SQL Insert Generator
Converts SQL `SELECT ... \G` output (vertical format) into INSERT statements.
- Requires table name input
- Optional "skip empty" checkbox to exclude null/zero/empty date values
- Handles field escaping and type detection (numeric vs string)

### tech-debt-generator.html - Tech Debt Generator
Silly project to demonstrate Claude Code's ability to generate randomized code snippets, no real benefit to users.

## Development Guidelines

### Adding New Tools
1. Create a new `.html` file in the root directory
2. Follow the single-file pattern: inline all CSS and JavaScript
3. Include the privacy notice about client-side processing
4. Add an example section to help users understand the expected input
5. Update README.md with a link to the new tool

### Modifying Existing Tools
- Preserve the self-contained nature - no external dependencies
- Maintain the privacy principle - all processing must remain client-side
- Keep the UI simple and functional
- Test thoroughly since there's no build/test pipeline

## Git Workflow

**Base Branch**: The default branch for this repository is `main`. When creating pull requests, target the `main` branch.

Always add new files to git once created (unless they're a common type of file to ignore, in which case add them to `.gitignore`).

**Important Notes**:
- When creating pull requests:
  - Keep descriptions concise with bullet points highlighting key changes
  - Do not mention Claude Code or AI assistance in commit messages or PR descriptions
  - Focus on what changed and why it matters to users

## Deployment

The repository is deployed to GitHub Pages at `https://m1ke.github.io/tools/`

No build, compilation, or deployment process is needed - HTML files are served directly. To publish changes, simply commit to the repository.
