# Poly Relationship Mapper

A simple, interactive web application for visualizing polyamorous relationship networks. Built with React, TypeScript, and Canvas for GitHub Pages deployment.

## Features

- Interactive relationship mapping with drag-and-drop nodes
- Multiple relationship types (Committed, Platonic, Sexual, etc.)
- JSON export/import functionality
- Responsive design
- Real-time visualization updates

## GitHub Pages Deployment

This app is automatically deployed to GitHub Pages using GitHub Actions. Every push to the main branch triggers a new deployment.

### Local Development

```bash
npm install
npm run dev
```

### Manual Deployment

```bash
npm run build
# Deploy the dist/ folder contents to GitHub Pages
```

## Usage

1. Add people using the "Add Person" form
2. Create relationships between people using the "Add Relationship" form
3. Drag nodes to rearrange the visualization
4. Export your map as JSON for backup
5. Import previously saved JSON maps

## Repository Structure

- `src/` - Source code
- `dist/` - Built files (auto-generated)
- `.github/workflows/` - GitHub Actions for deployment