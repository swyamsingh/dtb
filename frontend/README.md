# AI-Powered Dream Team Builder (Front-End)

This is a Next.js project for the Dream Team Builder front-end.

## Main Features
- Enter required skills and desired team size
- Connects to a Node.js/Express back-end at http://localhost:4000/api/search
- Streams candidate and team data live from the Torre API

## Project Structure
- Main logic: `app/page.js`
- Reusable UI components: `/components`

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Run the development server:
   ```sh
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Customization
- Update the API endpoint in `app/page.js` if your back-end runs on a different port or host.

---

For workspace-specific Copilot instructions, see `.github/copilot-instructions.md`.
