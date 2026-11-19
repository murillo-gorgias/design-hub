/*
  The list of projects shown on the hub homepage. One entry per project.

  To add a project:
    1. Put its files in a new folder at the top of this repo, with an index.html inside.
    2. Save a tile image in thumbs/, 1600 x 1000 px (16:10).
    3. Add an entry below.

  Fields:
    title        Short name shown on the tile.
    description  One or two sentences. Longer text is cut off after three lines.
    href         The project folder, ending in a slash.
    image        Path to the tile image.
    kind         A one-word label, for example "Exploration" or "Prototype".
    date         YYYY-MM-DD. Tiles sort by this date, newest first.
*/
window.HUB_PROJECTS = [
  {
    title: 'AI Agent intent routing',
    description:
      'An onboarding illustration. AI Agent reads each ticket, finds the intent, then replies or hands it to the team.',
    href: 'gaia-intent-routing/',
    image: 'thumbs/gaia-intent-routing.png',
    kind: 'Exploration',
    date: '2026-11-19',
  },
  {
    title: 'Gaia avatar',
    description:
      'A flat, minimal avatar for Gaia, built on the Gorgias chat bubble. Ten animated states, with a panel to tune them.',
    href: 'gaia-avatar/',
    image: 'thumbs/gaia-avatar.png',
    kind: 'Exploration',
    date: '2026-11-16',
  },
];
