# iGen Resume Formatter

Upload a resume (PDF/DOCX/TXT) -> AI extracts the data -> company names are masked -> iGen-style CV as Word + PDF.

## Run
1. Install Node 18+ and LibreOffice (needed for the PDF; set SOFFICE=/path/to/soffice if it is not on PATH).
2. Copy `.env.example` to `.env`.
3. Run `npm install` and `node --env-file=.env server.js`, then open http://localhost:3000.
Set `OPENAI_API_KEY` before uploading resumes. If it is missing, conversion returns a configuration error; the app never substitutes sample resume data.

## Notes
- Uploads stay in memory only. Generated files live in the OS temp folder and are deleted after 10 minutes (TTL in server.js).
- Masking: the model lists every organisation name it finds, and the server replaces them everywhere with "the client". Always review the preview.
- The resume formatter is public and does not require sign-in. Anyone with a generated job link can access that job's files until they expire; generated files are deleted after 10 minutes.
- Template look is rebuilt in server.js (buildDocx): navy #202060, Calibri, cover page + Personal details / Profile / Core skills / Project history. Change colors and fonts there; swap public/logo.jpg and the CSS variables in public/style.css once you have official brand values.

## Deployment
- The Netlify site proxies `/api/*` to the Render web service defined in `render.yaml`.
- Deploy the project as a Render Blueprint. Set `OPENAI_API_KEY` in Render for AI parsing; without it, uploads return a configuration error.
- LibreOffice is installed in the backend Docker image for PDF generation.
