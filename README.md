# Design hub

A home for design explorations and prototypes. The homepage is a grid of tiles. Each tile shows an image, a title and a short description, and opens a project hosted in this repo.

**Live:** https://murillo-gorgias.github.io/design-hub/

These are works in progress, shared for review. They are not final designs.

## Add a project

1. **Add the project folder.** Put the project's files in a new folder at the top of this repo, with an `index.html` inside. The folder must hold everything the page loads (scripts, fonts, images), so one project never depends on another.
2. **Add the tile image.** Save it in `thumbs/` at 1600 x 1000 px (16:10).
3. **Add the tile.** Add one entry to the list in `projects.js`. The fields are described at the top of that file. Tiles sort by date, newest first.

To remove a project, delete its folder, its image and its entry.

## Run it locally

Open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8791
# then open http://localhost:8791
```

## What is in here

- `index.html`, `hub.css`, `hub.js`: the homepage.
- `projects.js`: the list of tiles.
- `thumbs/`: the tile images.
- `assets/`: the homepage's fonts, logo and icon.
- Every other folder is one hosted project.
