(() => {
    "use strict";

    const DEFAULT_ACCENT = "#c9b98a";

    // Cover sizes come from srcset. `sizes` tells the browser how wide the picture will
    // actually be, so it can pick the smallest file that still looks sharp on this screen.
    const HOME_SIZES = "(min-width: 1240px) 280px, (min-width: 901px) 22vw, 45vw";
    const RAIL_SIZES = "(min-width: 761px) 108px, 44px";

    const $ = (sel) => document.querySelector(sel);
    const body = document.body;
    const shelves = $("#shelves");
    const stage = $("#stage");
    const frame = $("#frame");
    const loading = $("#loading");
    const slow = $("#slow");

    let bySlug = new Map();
    let tiles = [];
    let current = { slug: null, mode: "read" };
    let homeScroll = 0;
    let slowTimer = 0;

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const srcset = (slug) => [240, 400, 640].map((w) => `covers/${slug}-${w}.webp ${w}w`).join(", ");

    function storyUrl(s, mode) {
        return mode === "comic" && s.comic ? s.comic : s.url;
    }

    // ---------- build the page ----------

    function tileHtml(s, sizes) {
        const meta = `${s.chapters} chapters<span class="reads"></span>` + (s.status === "Ongoing" ? `<span class="badge">Ongoing</span>` : "");
        const comic = s.comic ? `<a class="btn" href="#/${s.slug}/comic">Comic</a>` : "";
        return `
        <article class="tile" data-slug="${s.slug}" style="--accent:${s.accent}">
            <a class="cover" href="#/${s.slug}" aria-label="${esc(s.title)}">
                <img src="covers/${s.slug}-400.webp" srcset="${srcset(s.slug)}" sizes="${sizes}"
                     width="400" height="667" alt="${esc(s.title)} cover" loading="lazy" decoding="async">
            </a>
            <div class="body">
                <h3 class="title"><a href="#/${s.slug}">${esc(s.title)}</a></h3>
                <p class="meta">${meta}</p>
                <p class="tagline">${esc(s.tagline)}</p>
                <p class="genres">${esc(s.genres.join(" · "))}</p>
                <div class="actions">
                    <a class="btn primary" href="#/${s.slug}">Read</a>
                    <a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">Open in New Tab</a>
                    ${comic}
                </div>
            </div>
        </article>`;
    }

    // `focused` is true when the page is opened straight onto a story link. The covers must be
    // given their rail size from the start, or the browser downloads the larger file first.
    function render(data, focused) {
        const sizes = focused ? RAIL_SIZES : HOME_SIZES;
        shelves.innerHTML = data.shelves.map((shelf) => `
            <section class="shelf">
                <h2>${esc(shelf.title)}</h2>
                <div class="tiles">
                    ${data.stories.filter((s) => s.shelf === shelf.id).map((s) => tileHtml(s, sizes)).join("")}
                </div>
            </section>`).join("");

        tiles = [...shelves.querySelectorAll(".tile")];
        tiles.forEach((t) => { t.style.viewTransitionName = `tile-${t.dataset.slug}`; });
    }

    // ---------- show a story, or the home page ----------

    function apply(next) {
        const s = next.slug ? bySlug.get(next.slug) : null;
        const focused = !!s;

        body.classList.toggle("focused", focused);
        body.style.setProperty("--accent", s ? s.accent : DEFAULT_ACCENT);
        resetChrome();
        stage.hidden = !focused;
        $("#backBtn").hidden = !focused;

        // The chosen tile hands its transition name to the stage, so it appears to grow into it.
        tiles.forEach((t) => {
            const active = focused && t.dataset.slug === s.slug;
            t.classList.toggle("is-active", active);
            if (active) { t.setAttribute("aria-current", "true"); } else { t.removeAttribute("aria-current"); }
            t.style.viewTransitionName = active ? "none" : `tile-${t.dataset.slug}`;
            t.querySelector("img").sizes = focused ? RAIL_SIZES : HOME_SIZES;
        });
        stage.style.viewTransitionName = focused ? `tile-${s.slug}` : "none";

        if (!focused) {
            document.title = "Stories - Kesava Nittala";
            loadFrame(null);
            return;
        }

        const mode = next.mode;
        $("#stageTitle").textContent = s.title;
        $("#stageGenres").textContent = s.genres.join(" · ");

        const read = $("#modeRead");
        const comic = $("#modeComic");
        read.href = `#/${s.slug}`;
        comic.href = `#/${s.slug}/comic`;
        comic.hidden = !s.comic;
        $("#modeSeg").hidden = !s.comic;
        (mode === "comic" ? comic : read).setAttribute("aria-current", "page");
        (mode === "comic" ? read : comic).removeAttribute("aria-current");

        $("#openNew").href = storyUrl(s, mode);
        $("#slowLink").href = storyUrl(s, mode);
        document.title = `${s.title}${mode === "comic" ? " (Comic)" : ""} - Stories`;

        window.scrollTo(0, 0);
        loadFrame(s, mode);

        const active = tiles.find((t) => t.dataset.slug === s.slug);
        if (active) { active.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    }

    function loadFrame(s, mode) {
        clearTimeout(slowTimer);

        if (!s) {
            delete frame.dataset.url;
            frame.removeAttribute("src");
            return;
        }

        const url = storyUrl(s, mode);
        if (frame.dataset.url === url) { return; }

        frame.dataset.url = url;
        frame.title = `${s.title}${mode === "comic" ? " comic" : ""}`;
        $("#loadingImg").src = `covers/${s.slug}-240.webp`;
        loading.classList.remove("done");
        slow.hidden = true;
        slowTimer = setTimeout(() => { slow.hidden = false; }, 12000);
        frame.src = url;
    }

    frame.addEventListener("load", () => {
        if (!frame.dataset.url) { return; }
        clearTimeout(slowTimer);
        loading.classList.add("done");
        watchScroll();
    });

    // ---------- phones: retract the cover strip and title row ----------

    // Two things can hide them: scrolling the story (auto), or tapping the handle (manual).
    // A tap on the handle wins until the next story is opened.
    const handle = $("#chromeHandle");
    const phone = matchMedia("(max-width: 760px)");
    let autoHidden = false;
    let manualHidden = null;

    const chromeHidden = () => (manualHidden === null ? autoHidden : manualHidden);

    function syncChrome() {
        const hidden = !!current.slug && chromeHidden();
        body.classList.toggle("chrome-hidden", hidden);
        handle.setAttribute("aria-expanded", String(!hidden));
        handle.setAttribute("aria-label", hidden ? "Show the story bar" : "Hide the story bar");
    }

    function resetChrome() {
        autoHidden = false;
        manualHidden = null;
        syncChrome();
    }

    handle.addEventListener("click", () => {
        manualHidden = !chromeHidden();
        syncChrome();
    });

    // The stories live on the same site as this page, so their scrolling can be watched.
    // If a story is ever on another site the browser refuses, and only the handle is used.
    function watchScroll() {
        let win;
        try {
            win = frame.contentWindow;
            void win.document;
        } catch (e) {
            return;
        }

        let lastY = win.scrollY || 0;
        let travel = 0;

        win.addEventListener("scroll", () => {
            if (!phone.matches) { return; }
            const y = win.scrollY || 0;
            const dy = y - lastY;
            lastY = y;

            if (y < 48) {
                travel = 0;
                autoHidden = false;
            } else {
                if (Math.sign(dy) !== Math.sign(travel)) { travel = 0; }
                travel += dy;
                if (travel > 24) { autoHidden = true; }
                if (travel < -24) { autoHidden = false; }
            }
            syncChrome();
        }, { passive: true });
    }

    // ---------- routing: #/story and #/story/comic ----------

    function parseHash() {
        const m = location.hash.match(/^#\/([a-z0-9-]+)(?:\/(comic))?\/?$/);
        const s = m && bySlug.get(m[1]);
        if (!s) { return { slug: null, mode: "read" }; }
        return { slug: s.slug, mode: m[2] === "comic" && s.comic ? "comic" : "read" };
    }

    function withTransition(update) {
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (document.startViewTransition && !reduced) {
            document.startViewTransition(update);
        } else {
            update();
        }
    }

    function route() {
        const next = parseHash();
        if (next.slug === current.slug && next.mode === current.mode) { return; }

        if (!current.slug && next.slug) { homeScroll = window.scrollY; }
        const goingHome = !next.slug;
        current = next;

        withTransition(() => {
            apply(next);
            if (goingHome) { window.scrollTo(0, homeScroll); }
        });
    }

    function goHome() {
        if (!location.hash) { return; }
        history.pushState(null, "", location.pathname + location.search);
        route();
    }

    // ---------- events ----------

    document.addEventListener("click", (e) => {
        const tile = e.target.closest(".tile");
        if (!tile || e.target.closest("a, button")) { return; }
        location.hash = `#/${tile.dataset.slug}`;
    });

    $("#backBtn").addEventListener("click", goHome);
    $("#stageBack").addEventListener("click", goHome);

    $(".brand").addEventListener("click", (e) => {
        if (current.slug) { e.preventDefault(); goHome(); }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && current.slug && !document.fullscreenElement) { goHome(); }
    });

    window.addEventListener("hashchange", route);
    window.addEventListener("popstate", route);

    const fsBtn = $("#fsBtn");
    if (document.fullscreenEnabled) {
        fsBtn.hidden = false;
        fsBtn.addEventListener("click", () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                stage.requestFullscreen();
            }
        });
        document.addEventListener("fullscreenchange", () => {
            fsBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
        });
    }

    // ---------- visit numbers ----------

    const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

    // A story's counts are kept under its site name, which is the first part of its address.
    const siteName = (s) => {
        try { return new URL(s.url).pathname.split("/")[1] || ""; } catch (e) { return ""; }
    };

    function showNumbers() {
        const stats = window.StoryStats;
        if (!stats || document.visibilityState === "hidden") { return; }

        stats.summary().then((d) => {
            if (!d) { return; }   // the counter is unreachable: show nothing rather than an error
            const f = stats.format;

            const line = $("#hubStats");
            const parts = [stats.count(d.site.visits, "visit"), stats.count(d.site.reads, "chapter read"), `♥ ${f(d.site.likes)}`];
            if (d.site.now > 0) { parts.push(`${f(d.site.now)} reading now`); }
            line.textContent = parts.join("  ·  ");
            line.hidden = false;

            tiles.forEach((t) => {
                const s = bySlug.get(t.dataset.slug);
                const n = d.stories[siteName(s)];
                const reads = t.querySelector(".reads");
                if (reads && n && n.reads > 0) { reads.textContent = ` · ${stats.count(n.reads, "read")}`; }
            });
        });
    }

    // ---------- start ----------

    fetch("stories.json")
        .then((r) => {
            if (!r.ok) { throw new Error("stories.json not found"); }
            return r.json();
        })
        .then((data) => {
            bySlug = new Map(data.stories.map((s) => [s.slug, s]));

            const count = data.stories.length;
            $(".hero h1").textContent = `${NUMBER_WORDS[count] || count} ${count === 1 ? "story" : "stories"}.`;
            // Opening a link like #/kleem goes straight to that story, without the animation.
            const start = parseHash();
            render(data, !!start.slug);
            current = start;
            apply(start);

            // The numbers refresh while the page stays open, so "reading now" stays current.
            showNumbers();
            setInterval(showNumbers, 60000);
        })
        .catch(() => {
            shelves.innerHTML = "<p>The stories could not be loaded. Please refresh the page.</p>";
        });
})();
