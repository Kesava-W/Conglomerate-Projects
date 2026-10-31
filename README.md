# Conglomerate-Projects

One page for all the stories by Kesava Nittala. Click a story and it opens in place; the others move to the side.

Live at https://kesava-w.github.io/Conglomerate-Projects/

## Adding or changing a story

Everything comes from `stories.json`. Each story needs a `slug`, `title`, `tagline`, `genres`, `chapters`, `status`, `shelf`, `accent` and the `url` of its own site. Add a `comic` link to show a Comic button.

Put the cover in `covers/` as `<slug>-240.webp`, `<slug>-400.webp` and `<slug>-640.webp`. The page picks the size that suits the screen.

## Files

- `index.html`, `styles.css`, `app.js`: the page
- `stories.json`: the story list
- `covers/`: cover images in three sizes
