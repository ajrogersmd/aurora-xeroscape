# Colorado Xeriscape Designer

Colorado Xeriscape Designer is a static Vite + React + TypeScript web app for planning a drought-tolerant front-yard xeriscape. It provides a canvas-based top-down editor, a simplified street-view preview, JSON import/export, PNG export, local browser storage, and prompt generators for realistic image rendering.

## Features

- Canvas-based top-down yard editor built with React Konva
- Default Colorado front-yard site model with driveway, porch, sidewalk, slope, and existing trees
- Drag-and-drop plant palette with mature spread rings and label toggles
- Surface material painting for the main bed, curb strip, and left-side bed
- Dry river bed editing with draggable control points, material selection, width control, and optional boulder edging
- Draggable boulders and utility covers
- Simplified curb-facing street-view preview
- JSON import/export and PNG export
- Auto-save and presets stored in `localStorage`
- Copy buttons for realistic street-view and top-down render prompts
- GitHub Pages deployment workflow

## Local setup

1. Install Node.js 22 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL shown by Vite.

## Build and verification

Run the available checks:

```bash
npm run lint
npm run build
```

The production build output is written to `dist/`.

## GitHub Pages deployment

This repository includes a workflow at `.github/workflows/pages.yml`.

- By default, Vite uses `base: '/xeriscape-designer/'`.
- The workflow overrides that with `VITE_BASE_PATH=/${{ github.event.repository.name }}/` so the site works from the repository Pages subpath.

To deploy:

1. Enable **GitHub Pages** in the repository settings.
2. Set the Pages source to **GitHub Actions**.
3. Push to the deployment branch listed in the workflow or trigger the workflow manually.
4. GitHub Actions will build the site and publish `dist/` to Pages.

If you need a different subpath locally or in another deployment system, set an environment variable before building:

```bash
VITE_BASE_PATH=/custom-subpath/ npm run build
```

## Data files

- Example saved design JSON: `public/examples/default-design.json`
- User work and presets are stored in browser `localStorage`

## App usage summary

- Click a plant or placement tool in the palette, then click the top-down plan to place it.
- Click planting zones to paint materials.
- Toggle dry river editing, then click the plan to add river control points.
- Use **Select in plan** in the yard layout panel to highlight and drag base-scene footprints.
- Select plants, boulders, utility covers, trees, or river points to edit them numerically.
- Use the **Street View** tab to preview massing and sight lines.
- Use the prompt buttons to copy realistic render instructions into ChatGPT image generation.

## Notes

- Dimensions are user-editable planning estimates only, not survey-grade measurements.
- The app is fully static: no backend, login, database, or paid APIs are required.
