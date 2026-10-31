/*
 * Story stats: counts visits, chapter reads, finished chapters and likes.
 *
 * One copy of this file serves every story on this site. Each story page loads it from
 * /Conglomerate-Projects/stats.js, so a fix or a change of backend is made here only.
 *
 *   home page      counts a visit, and shows the totals under the cover
 *   chapter page   counts a read and a finish, and adds a Like button
 *   comic page     the same, for the comic chapters
 *   the hub        counts a visit (data-kind="hub") and exposes window.StoryStats for its tiles
 *
 * The story is taken from the address (kesava-w.github.io/<Story>/...), so a new story
 * only has to include this script. Nothing personal is sent or kept: no cookies, and the
 * only thing stored in the browser is a note of what was already counted today.
 * If the backend cannot be reached the numbers simply do not appear.
 */
(function () {
    "use strict";

    var API = "https://phani6188.pythonanywhere.com";

    // For testing only: when the page itself is on localhost it may point at a local backend.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        try { API = localStorage.getItem("storyStatsApi") || API; } catch (e) { /* ignore */ }
    }

    var script = document.currentScript;
    var isHub = !!script && script.getAttribute("data-kind") === "hub";
    var storyOverride = script && script.getAttribute("data-story-id");

    // ---------- small helpers ----------

    var store = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
        del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
        keys: function () { try { return Object.keys(localStorage); } catch (e) { return []; } }
    };

    function fmt(n) { return Number(n || 0).toLocaleString("en-IN"); }

    // "1 visit", "2 visits"
    function count(n, word) { return fmt(n) + " " + word + (Number(n) === 1 ? "" : "s"); }

    function today() {
        var d = new Date();
        return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    }

    function clean(item) { return String(item || "").replace(/[^A-Za-z0-9 _.,()&'-]/g, "").slice(0, 80); }

    function el(tag, cls) {
        var e = document.createElement(tag);
        e.className = cls;
        return e;
    }

    function post(body) {
        return fetch(API + "/event", {
            method: "POST", mode: "cors", credentials: "omit", keepalive: true,
            headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body)
        }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }

    function get(path) {
        var ctl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) { ctl.abort(); } }, 7000);
        return fetch(API + path, { mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (d) { clearTimeout(timer); return d; });
    }

    // What was already sent today is remembered, so a reload does not repeat the request.
    // (The server also refuses repeats, so this only saves traffic.)
    function flag(key) { return "st:d:" + today() + ":" + key; }

    store.keys().forEach(function (k) {
        if (k.indexOf("st:d:") === 0 && k.indexOf("st:d:" + today() + ":") !== 0) { store.del(k); }
    });

    // ---------- what kind of page is this? ----------

    var params = new URLSearchParams(location.search);
    var file = (location.pathname.split("/").pop() || "").toLowerCase();
    var page = null;

    if (isHub) {
        page = { story: "hub", kind: "hub", item: "" };
    } else {
        var seg = location.pathname.split("/")[1] || "";
        try { seg = decodeURIComponent(seg); } catch (e) { /* keep as is */ }
        var story = storyOverride || (/\.html?$/i.test(seg) ? "" : seg);
        if (/^[A-Za-z0-9_-]{1,64}$/.test(story)) {
            if (file === "chapter.html") { page = { story: story, kind: "chapter", item: clean(params.get("file")) }; }
            else if (file === "comic.html") { page = { story: story, kind: "comic", item: clean(params.get("c")) }; }
            else if (file === "" || file === "index.html") { page = { story: story, kind: "home", item: "" }; }
        }
    }

    // The hub reads the numbers itself, so it is given a small handle.
    window.StoryStats = {
        api: API,
        format: fmt,
        count: count,
        summary: function () { return get("/counts"); },
        story: function (name) { return get("/counts?story=" + encodeURIComponent(name)); }
    };

    if (!page) { return; }

    // ---------- look ----------

    var style = document.createElement("style");
    style.textContent = [
        ".st-box{max-width:900px;margin:18px auto 0;padding:0 12px;text-align:center;font:15px Georgia,serif;color:inherit}",
        ".st-like{font:inherit;font-weight:bold;padding:9px 20px;border-radius:999px;border:1px solid currentColor;",
        "background:transparent;color:inherit;cursor:pointer}",
        ".st-like:hover:not(:disabled){background:rgba(225,29,72,.12);border-color:#e11d48;color:#e11d48}",
        ".st-like.st-on{background:#e11d48;border-color:#e11d48;color:#fff;cursor:default}",
        ".st-num{display:inline-block;margin:6px 0 0 10px;opacity:.85}",
        ".st-home{margin-top:18px;font:15px Georgia,serif;color:rgba(255,255,255,.8)}"
    ].join("");
    document.head.appendChild(style);

    // ---------- the pieces ----------

    function refOf() {
        try { var u = new URL(document.referrer); return (u.origin + u.pathname).slice(0, 200); } catch (e) { return ""; }
    }

    // A chapter page opened without ?file= shows the first chapter, so the name is looked up.
    function resolveItem() {
        if (page.item || (page.kind !== "chapter" && page.kind !== "comic")) { return Promise.resolve(page.item); }
        var url = page.kind === "chapter" ? "chapters.json" : "comic/comic.json";
        return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
            var first = page.kind === "chapter" ? d[0] && d[0].file : d.chapters && d.chapters[0] && d.chapters[0].id;
            return clean(first);
        }).catch(function () { return ""; });
    }

    function sendOnce(event, extra) {
        var key = flag(event + ":" + page.story + ":" + page.kind + ":" + page.item);
        if (store.get(key)) { return Promise.resolve(null); }
        var body = { event: event, story: page.story, kind: page.kind, item: page.item };
        if (extra) { for (var k in extra) { body[k] = extra[k]; } }
        return post(body).then(function (r) { if (r) { store.set(key, "1"); } return r; });
    }

    function showHome(d) {
        var header = document.querySelector("header");
        if (!d || !header) { return; }
        var line = el("div", "st-home");
        var text = count(d.visits, "visit") + "  ·  " + count(d.reads, "chapter read");
        if (d.comic_reads) { text += "  ·  " + count(d.comic_reads, "comic read"); }
        line.textContent = text + "  ·  ♥ " + fmt(d.likes);
        header.appendChild(line);
    }

    function showItem(d) {
        var group = d && (page.kind === "chapter" ? d.chapters : d.comics);
        var anchor = document.getElementById(page.kind === "comic" ? "reader" : "content");
        if (!group || !anchor) { return; }

        var entry = group[page.item] || { views: 0, likes: 0 };
        var likeKey = "st:like:" + page.story + ":" + page.kind + ":" + page.item;
        var likes = entry.likes;
        var liked = !!store.get(likeKey);

        var box = el("div", "st-box");
        var btn = el("button", "st-like");
        var num = el("span", "st-num");
        btn.type = "button";
        box.appendChild(btn);
        box.appendChild(num);

        function paint() {
            btn.textContent = liked ? "♥ Liked" : "♡ Like";
            btn.classList.toggle("st-on", liked);
            btn.disabled = liked;
            btn.setAttribute("aria-pressed", String(liked));
            num.textContent = count(likes, "like") + "  ·  " + count(entry.views, "read");
        }

        btn.addEventListener("click", function () {
            if (liked) { return; }
            liked = true; likes += 1; paint();
            post({ event: "like", story: page.story, kind: page.kind, item: page.item }).then(function (r) {
                if (r) {
                    store.set(likeKey, "1");
                    if (r.totals) { likes = r.totals.likes; paint(); }
                } else {
                    liked = false; likes -= 1; paint();   // could not be saved, so let them try again
                }
            });
        });

        paint();
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }

    // A chapter counts as finished when the reader has spent a while and reached the end.
    function watchFinish() {
        var wait = page.kind === "chapter" ? 30000 : 15000;
        var started = Date.now();
        var done = false;
        var timer = 0;

        function check() {
            if (done) { return; }
            var doc = document.documentElement;
            var atEnd = (window.scrollY + window.innerHeight) / doc.scrollHeight >= 0.92;
            if (atEnd && doc.scrollHeight > window.innerHeight * 1.3 && Date.now() - started >= wait) {
                done = true;
                window.removeEventListener("scroll", onScroll);
                sendOnce("finish");
            }
        }
        function onScroll() { clearTimeout(timer); timer = setTimeout(check, 250); }

        window.addEventListener("scroll", onScroll, { passive: true });
        setTimeout(check, wait + 500);   // for a reader who reached the end early and then stopped scrolling
    }

    // ---------- go ----------

    resolveItem().then(function (item) {
        if ((page.kind === "chapter" || page.kind === "comic") && !item) { return; }
        page.item = item;

        sendOnce("view", { ref: refOf() }).then(function () {
            if (page.kind === "hub") { return; }
            return get("/counts?story=" + encodeURIComponent(page.story)).then(function (d) {
                if (page.kind === "home") { showHome(d); } else { showItem(d); }
            });
        });

        if (page.kind === "chapter" || page.kind === "comic") { watchFinish(); }
    });
})();
