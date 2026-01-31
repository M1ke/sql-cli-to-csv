# Web Tools

A collection of browser-based developer utilities.

## Tools

### [AI CSV Transformer](https://m1ke.github.io/tools/ai-csv.html)
Transform CSV data using AI-generated JavaScript functions without uploading your data to any LLM service.

### [JWT Parser and Editor](https://m1ke.github.io/tools/jwt.html)
Decode JWT tokens, edit header and payload sections, and reconstruct tokens with modified values.

### [Markdown to Google Doc](https://m1ke.github.io/tools/markdown-gdoc.html)
Convert markdown to formatted content that can be pasted directly into Google Docs with preserved formatting.

### [SQL CLI to CSV Converter](https://m1ke.github.io/tools/sql-csv.html)
Convert SQL command-line table output into CSV format, extract specific columns, and wrap values with custom templates.

### [SQL Insert Generator](https://m1ke.github.io/tools/sql-insert.html)
Transform SQL SELECT output (vertical format with \G) into INSERT statements for easy data duplication.

### [Psalm Array Type Comparator](https://m1ke.github.io/tools/psalm-compare.html)
Compare two Psalm array type definitions from error messages and show only the differences in JSON format.

---

All tools process data locally in your browser; no data is sent to any remote server.

## Development

### Testing
Run the test suite for psalm-compare tool:
```bash
node psalm-compare.test.js
```
