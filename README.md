# iGen Resume Formatter

Upload a resume (PDF/DOCX/TXT) -> text is extracted and organized locally -> detected company names are masked -> iGen-style CV as Word + PDF. No AI service or API key is used.

## Run
1. Install Node 18+ and LibreOffice (needed for the PDF; set SOFFICE=/path/to/soffice if it is not on PATH).
2. Copy `.env.example` to `.env`.
3. Run `npm install` and `node --env-file=.env server.js`, then open http://localhost:3000.
The parser uses common resume headings and runs on the backend without sending resume text to an AI service. Review the generated result because unusual layouts may need manual correction. Scanned PDFs require OCR and are not supported unless uploaded as searchable PDFs.

## Notes
- Uploads stay in memory only. Generated files live in the OS temp folder and are deleted after 10 minutes (TTL in server.js).
- Masking: detected employer names are replaced with "the client". Rule-based parsing may miss names in unusual layouts, so always review the preview.
- The resume formatter is public and does not require sign-in. Anyone with a generated job link can access that job's files until they expire; generated files are deleted after 10 minutes.
- Template look is rebuilt in server.js (buildDocx): navy #202060, Calibri, cover page + Personal details / Profile / Core skills / Project history. Change colors and fonts there; swap public/logo.jpg and the CSS variables in public/style.css once you have official brand values.

## Deployment
- The Netlify site proxies `/api/*` to the Render web service defined in `render.yaml`.
- Deploy the project as a Render Blueprint. No AI credentials or external parsing service are required.
- LibreOffice is installed in the backend Docker image for PDF generation.
