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

## Visit and like counts

`stats.js` counts visits, chapter reads, finished chapters and likes, and shows the totals. It talks to a small counter service (see the `Story-Stats` folder on the author's PC; it runs on PythonAnywhere). Every story loads this one file, so a change is made here only.

To count a new story, add this line before `</body>` in its `index.html`, `chapter.html` (and `comic.html` if it has one):

```html
<script src="/Conglomerate-Projects/stats.js"></script>
```

The story's name is taken from its address, so nothing else needs setting up. If the counter service is down, the numbers simply do not appear. No cookies are used and nothing personal is stored.
