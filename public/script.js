const Prism = window.Prism;

const $id = i => document.getElementById(i);
const $cl = c => document.getElementsByClassName(c);
const $qa = q => document.querySelectorAll(q);
const $qr = q => document.querySelector(q);
const $mk = t => document.createElement(t);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;


// URL.canParse() is unsupported on some browsers
const canParseUrl = u => { try { new URL(u); return true; } catch (_) { return false; } }

// Returns alphanumeric-only chars
const cleanURL = s => s.replace(/[^\w\s]/gi, '');

const linkNode = $id("FeedLinkContainer");
const FEED     = $id("FEED");
const S_FEED   = $id("SAVED-ITEMS");

var SAVED_ARRAY = [];
var MAX_FEED_ITEMS = 3; // Per feed
var MAX_ITEMS = 25;     // In total
var DATA = {
    links: []
};

var nOfLinks = 0;
var search_by = $id("searchBySel").value;

let isCfgOpen    = false;
let isBotCfgOpen = false; // Bottom-bar gear thingy
let isFullFOpen  = false;
let isSavedFOpen = false;
let isAdvOptOpen = false;

function debounce(func, ms) {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(func, ms);
    };
}



// I forgot where did I stole this from
function calcTime(dtc) {
    const date = new Date(dtc);
    const seconds = Math.floor((new Date() - date) / 1000);
        
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) { return [interval, 6] }

    interval = Math.floor(seconds / 2592000);
    if (interval > 1) { return [interval, 5] }

    interval = Math.floor(seconds / 86400);
    if (interval > 1) { return [interval, 4] }

    interval = Math.floor(seconds / 3600);
    if (interval > 1) { return [interval, 3] }
        
    interval = Math.floor(seconds / 60);
    if (interval > 1) { return [interval, 2] }
    if (seconds < 10) { return [Math.floor(seconds), 1] }
}



// Just in case...
function removeScript(string) {
    return string.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, " ");
}

// For adding, editing or deleting links
// Should be a class??
const POPUP = {
    nodeContainer: $id("PopupContainer"),
    nodeInput:     $id("PopupInput"),
    okButton:      $id("PopupButOk"),
    delButton:     $id("PopupInputDel"),
    _hide: () => {
        POPUP.nodeContainer.style.display = "none";
        POPUP.nodeInput.value = "";
        POPUP.okButton.onclick = null;
    },
    call: (fn, opt) => {
        POPUP.nodeInput.value = opt?.init ? opt.init : "";
        $id("PopupMsg").textContent  = opt?.msg || " ";
        $id("PopupDesc").textContent = opt?.desc || " ";
        $id("cTitleInp").value = opt?.title ? opt.title : "";
        $id("cItemsNInp").value = opt?.noi ? opt.noi : "";
        if  (opt?.del) { POPUP.delButton.style.display = 'block'; }
        else { POPUP.delButton.style.display = 'none'; }
        POPUP.nodeContainer.style.display = "flex";
        POPUP.okButton.onclick = () => { fn({
            dir:   POPUP.nodeInput.value,
            title: $id("cTitleInp").value,
            noi:   $id("cItemsNInp").value,
            col:   [$qr("#PopupCol1 input").jscolor.toRGBAString(), $qr("#PopupCol2 input").jscolor.toRGBAString()] //["rgba(0,0,0,1)", "rgba(0,0,0,1)"] //
        }); POPUP._hide(); };
    },
    
    // To set events once ((Shoulbe a class?????))
    init: () => {
        POPUP.nodeContainer.onclick = e => { e.target.id === "PopupContainer" ? POPUP._hide() : null };
        $id("PopupButCancel").onclick = () => POPUP._hide();
        POPUP.delButton.onclick = () => { POPUP.nodeInput.value = "" }
    }
};

// Feed order input
$id("cItemsNInp").addEventListener('input', function() {
    if (parseInt(this.value) || parseInt(this.value) === 0 || !this.value) {
        this.style.boxShadow = "none";
    } else {
        this.style.boxShadow = "0 4px 13px red";
    }
});

function saveData() {
    fetch('/savedata', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DATA)
    })
    .catch(e => { console.log(e) });
}

function renderFeed(F = {}, parent = null) {
    const rDiv    = $id("FEED-FULL");
    const rBar    = $id("TOPBAR-FULL");
    const topBar  = $id("TOPBAR");
    const sTopBar = $id("SUBTOPBAR");
    const botBar  = $id("BOTBAR");
    const saveBut = $id("saveFeedItem");
    const img     = saveBut.querySelector("img");
    
    img.src = F.isSaved ? './svg/ico_star1.svg' : './svg/ico_star0.svg';
    
    if (!isFullFOpen) {
        const s = $id("gotoFeedSrc");      
        
        rDiv.innerHTML = '<h2 class="feedRenderTitle">' + F.title + '</h2><hr class="feedFullHr"><br>' + (F.content ? removeScript(F.content) : `<div id="rDivNoContent"><p>No content to display.<br>Go to this item <a href="${F.link}">source</a> to read more.</p></div>`) + '<div id="EOFR"></div>';
        $id("fullUrlField").innerHTML = F.customTitle ? F.customTitle : F.fTitle;
        
        
        // Fixing code blocks bad format
        // See:
        // https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
        const badCodeBlocks = rDiv.querySelectorAll('code > pre');
        badCodeBlocks.forEach(pre => {
            const code = pre.parentElement;
            const newPre  = $mk('pre');
            const newCode = $mk('code');
            while (pre.firstChild) {
                newCode.appendChild(pre.firstChild);
            }
            newPre.appendChild(newCode);
            code.parentElement.replaceChild(newPre, code);
        });
        
        // Generic c-like syntax highlight for code blocks (or inline code)
        const codeBlocks = rDiv.querySelectorAll("code");
        codeBlocks.forEach((e) => {
            e.style.cssText = "";
            if (e.parentNode.tagName === "PRE") {
                e.parentNode.style.cssText = "";
                e.parentNode.innerHTML = Prism.highlight(e.textContent, Prism.languages.clike, 'clike');
            } else {
                e.innerHTML = Prism.highlight(e.textContent, Prism.languages.clike, 'clike');
            }
        });
        
        s.onclick = () => window.open(F.link, '_blank', 'noopener','noreferrer');
        saveBut.onclick = function() {
            const fromSaved = parent.classList.contains("favItem");
            const normalParent = $id(F.link);
            if (!F.isSaved) {
                F.isSaved = true;
                SAVED_ARRAY.push(F);
                if (normalParent) { normalParent.classList.add("feedItemSaved"); }
                else if (!normalParent && !fromSaved) { parent.classList.add("feedItemSaved"); }
                img.src = './svg/ico_star1.svg';
                
                mkFeedHTML(F, true);
                saveFeedDebounce();
            } else {
                SAVED_ARRAY = SAVED_ARRAY.filter(item => item !== F);
                F.isSaved = false;
                if (fromSaved) {
                    parent.remove();
                    if (normalParent) { normalParent.classList.remove("feedItemSaved"); }
                } else {
                    const clean = cleanURL(F.link) + "-favitem";
                    const si = $id(clean);
                    console.log(si, clean)
                    si?.remove();
                    parent.classList.remove("feedItemSaved");
                }
                img.src = './svg/ico_star0.svg';
                
                saveFeedDebounce();
            }
        }
        
        botBar.style.display = "none";
        topBar.style.display = "none";
        sTopBar.style.display = "none";
        FEED.style.display   = "none";
        S_FEED.style.display = "none";
        rDiv.style.display   = "block";
        rBar.style.display   = "flex";
        rDiv.scrollTop = 0;
        isFullFOpen = true;
    } else {
        if (isSavedFOpen) {
            S_FEED.style.display = "flex";
            S_FEED.style.animation = "";
        } else {
            FEED.style.display   = "flex";
            FEED.style.animation = "";
        }
        rDiv.innerHTML = "";
        botBar.style.display  = "flex";
        topBar.style.display  = "flex";
        sTopBar.style.display = "flex";
        rDiv.style.display    = "none";
        rBar.style.display    = "none";
        isFullFOpen = false;
    }
}

$id("closeFeedRender").addEventListener("click", renderFeed);

$id("openSavedFeeds").addEventListener("click", function() {
    if (!isSavedFOpen) {
        this.classList.add("bbbActive");
        S_FEED.style.display = "flex";
        S_FEED.style.animation = "fadeIn 0.2s ease";
        
        FEED.style.display = "none";
    } else {
        this.classList.remove("bbbActive");
        S_FEED.style.display = "none";
        
        FEED.style.animation = "fadeInRev 0.2s ease";
        FEED.style.display = "flex";
        
    }
    isSavedFOpen = !isSavedFOpen;
});

// Creates the base HTML of a given feed item
function mkFeedHTML(feed, fsv = false) {
    const f = $mk("feed-elem");
    const lng = feed.contentSnippet ? feed.contentSnippet.length : 0;
    const size = 180;
    const tSize = 30;
    let pd;
    let tpd = calcTime(feed.pubDate ? feed.pubDate : feed.fPubDate);
    f.dataset.interval = tpd[0].toString();
    f.dataset.order    = tpd[1].toString();
    if      (tpd[1] === 1) { pd = "Just now" }
    else if (tpd[1] === 2) { pd = `${tpd[0]} minutes ago` }
    else if (tpd[1] === 3) { pd = `${tpd[0]} hours ago`   }
    else if (tpd[1] === 4) { pd = `${tpd[0]} days ago`    }
    else if (tpd[1] === 5) { pd = `${tpd[0]} months ago`  }
    else if (tpd[1] === 6) { pd = `${tpd[0]} years ago`   }
    
    const _title = feed.customTitle ? feed.customTitle : feed.fTitle;
    
    //const custom_color = feed.customColor || ["rgba(0,0,0,1)", "rgba(0,0,0,1)"];

    // Remove IMG from snippet
    let snippet = $mk("div");
    snippet.innerHTML = feed.contentSnippet;
    const img = snippet.querySelectorAll("img");
    if (img) { img.forEach(i => { i.remove() }); }
    snippet = feed.contentSnippet ? feed.contentSnippet : null;
    
    f.innerHTML = `
        <feed-title class="feedTop" style="background-image: linear-gradient(90deg, ${fsv ? "rgba(0,0,0,1)" : feed.customColor[0]}, ${fsv ? "rgba(0,0,0,1)" : feed.customColor[1]})">
            <div>
                <p class="feedTitle ${feed.isSaved && !fsv? 'feedTitleSaved' : ''}" onclick="window.open('${feed.link}', '_blank', 'noopener','noreferrer');">${_title.length < tSize ? _title : _title.slice(0,tSize) + "(...)"}</p>
                <p class="feedPubDt">${pd}</p>
            </div>
        </feed-title>
        <feed-content>
            <h3>${feed.title}</h3>
            <div>${lng > size ? snippet.slice(0, size) + "[...]" : snippet ? snippet : "No content to display."}</div>
        </feed-content>
        <hr>
        <feed-opts>
            <button>
                <img src="./svg/ico_arrowR.svg">
            </button>
        </feed-opts>`;
    
    if (feed.isSaved && !fsv) {
        f.classList.add("feedItemSaved");
    }
    
    if (fsv) {
        f.classList.add("favItem");
        f.id = cleanURL(feed.link) + "-favitem";
        S_FEED.appendChild(f);
    } else {
        f.id = cleanURL(feed.link)
        f.classList.add(feed.baseUrl);
        FEED.appendChild(f);
    }
    
    const but = f.querySelector("feed-opts button");
    but.addEventListener("click", () => {
        renderFeed(feed, f);
    });
}

$id("openLinksCfg").addEventListener("click", function() {
    if (isBotCfgOpen) { $id("openGeneralCfg").click(); }
    const fcbg = $id("FeedCFGBG");
    const dv = $id("FeedCFGDiv");
    if (isCfgOpen) {
        this.classList.remove("bbbActive");
        fcbg.style.display = "none";
        isCfgOpen = false;
    } else {
        this.classList.add("bbbActive");
        fcbg.style.display = "flex";
        isCfgOpen = true;
    }
});
$id("FeedCFGBG").onclick = (e) => {
    if (e.target.id === "FeedCFGBG") {
        $id("openLinksCfg").click();
    }
};

$id("openGeneralCfg").addEventListener("click", function() {
    if (isCfgOpen) { $id("openLinksCfg").click(); }
    const fcbg = $id("GeneralCFGBG");
    const dv = $id("GeneralCFGDiv");
    if (isBotCfgOpen) {
        this.classList.remove("bbbActive");
        fcbg.style.display = "none";
        isBotCfgOpen = false;
    } else {
        this.classList.add("bbbActive");
        fcbg.style.display = "flex";
        isBotCfgOpen = true;
    }
});
$id("GeneralCFGBG").onclick = (e) => {
    if (e.target.id === "GeneralCFGBG") {
        $id("openGeneralCfg").click();
    }
};

const saveFeedDebounce = debounce(() => {
    fetch('/feeds/save', {
        method: 'POST',
        body: JSON.stringify(SAVED_ARRAY)
    })
    .catch(e => { console.log(e) });
}, 1000);

function editUrl(O) {
    const def_url = O.dir;
    const dt = O.title;
    const dn = O.noi;
    POPUP.call(function(result) {
        const url = result.dir;
        const ft  = result.title;
        const noi = parseInt(result.noi) ? parseInt(result.noi) : -1;
        result.noi = noi; // Converts it to int
        const elem_c = $id(`${def_url}-container`);
        if (!url) {
            elem_c.remove();
            const index = DATA.links.indexOf(O);
            DATA.links.splice(index, 1);
            saveData();
            return;
        }
        const err = !canParseUrl(url);
        let u;
        if (!err) { u = new URL(url); }
        const elem = $id(`${def_url}`);
        const but = $id(`${def_url}-button`);
        elem_c.id = `${url}-container`;
        elem.id   = cleanURL(url);
        elem.href = url;
        elem.textContent = ft ? ft : u ? u.hostname : url;
        but.id = `${url}-button`;
        but.onclick = () => editUrl(result);
        
        // Unoptimized for larger Arrays
        const index = DATA.links.map(l => l.dir).indexOf(def_url);
        DATA.links[index] = result;
        $qr(`.${cleanURL(DATA.links[index].dir)} feed-title`).style.backgroundImage = `linear-gradient(90deg, ${result.col[0]}, ${result.col[1]})`; //result.col[0]
        saveData();
    }, {
        title: dt,
        noi:   dn,
        del:   true,
        init:  def_url,
        msg:   "Edit Feed",
        desc:  "Modify this feed's parameters. Leave the URL field empty to delete this feed."
    });
}

$id("AddLinkFeed").addEventListener("click", () => {
    POPUP.call(function(result) {
        if (!result.dir || result.dir.match(/^\s+$/gm)) { return; }
        mkLinkHTML(result);
        saveData();
    },
    {
        msg: "Add Feed",
        desc: "Add a feed URL. Empty fields will use the default config or feed specification."
    });
});

function loadFeeds() {
    fetch('/feeds', {
        method: 'GET',
        headers: { "Content-Type": "application/json" },
    })
    .then(r => r.json())
    .then(async (data) => {
        const loadDiv = $id("divFeedLoading");
        if (data.error) {
            const p = $id("loadingP");
            p.textContent = "Error :(";
            p.style.color = "#f50";
            p.style.textShadow = "0 0 9px #000";
            loadDiv.style.backgroundImage = "linear-gradient(135deg, rgba(250,105,80,0.5), rgba(250,85,155,0.6))";
            loadDiv.style.boxShadow = "0 0 18px rgba(250,105,80,0.5)";
            const an = Array.from($cl("loadingFX"));
            an.forEach(e => {
                e.style.backgroundImage = "none";
                e.style.backgroundColor = "rgba(255,55,255,0.08)";
                e.style.animation = `rot ${rand(3,9)}s infinite linear`;
            });
            return;
        }
        
        data.links.forEach(l => mkLinkHTML(l));
        $id("nOfLinks").textContent = `Total feeds: ${nOfLinks}`;
        createFeedFromData(data);
    });
}

function mkLinkHTML(link) {
    const url = link.dir;
    const ft  = link.title;
    const noi = link.noi;
    const err = !canParseUrl(url);
    let u;
    if (!err) {
        u = new URL(url);
    }
    const div = $mk("div");
    div.id = `${url}-container`;
    div.classList.add("URLDiv");
    if (err) {
        div.classList.add("URLDivError");
        div.title = "Invalid URL (Red Highlight)";
    }
    div.innerHTML = `<a id="${url}" target="_blank" href="${url}">${ft ? ft : u ? u.hostname : url}</a>
                     <button id="${url}-button" class="generalButton">Edit</button>`;
    linkNode.appendChild(div);
    $id(`${url}-button`).onclick = () => editUrl(link);
    DATA.links.push({
        dir:   url,
        title: ft,
        noi:   parseInt(noi) ? parseInt(noi) : -1,
        col:   link.col
    });
    nOfLinks++;
}

$id("searchBySel").addEventListener('change', function() { search_by = this.value; });

$id("searchBar").addEventListener('input', function() {
    const query = this.value.toLowerCase();
    let selectorTl = isSavedFOpen ? 'feed-elem:is(.favItem) feed-content h3' : 'feed-elem:not(.favItem) feed-content h3';
    let selectorNm = isSavedFOpen ? 'feed-elem:is(.favItem) .feedTitle'      : 'feed-elem:not(.favItem) .feedTitle';
    let cont;
    if (search_by === "bTitle") {
        cont = document.querySelectorAll(selectorTl);
    } else if (search_by === "fName") {
        cont = document.querySelectorAll(selectorNm);
    }
    
    cont.forEach(item => {
        const elem = item.closest('feed-elem');
        const text = item.textContent.toLowerCase();
        elem.style.display = text.includes(query) || !query ? 'flex' : 'none';
    });
});


$id("showAdvSearch").addEventListener("click", function() {
    const opts   = $id("stbDiv");
    const parent = $id("SUBTOPBAR");
    if (isAdvOptOpen) {
        opts.style.display  = "none";
        parent.style.height = "0px";
        FEED.style.height = "calc(100vh - (var(--barSize) * 2))";
        S_FEED.style.height = "calc(100vh - (var(--barSize) * 2))";
        this.dataset.active = "false";
    } else {
        opts.style.display  = "flex";
        
        // there has to be a better way to make this.......
        parent.style.height = "calc(var(--barSize) * 2.5)";
        S_FEED.style.height = "calc(100vh - (var(--barSize) * 4.5))";
        FEED.style.height = "calc(100vh - (var(--barSize) * 4.5))";
        
        this.dataset.active = "true";
    }
    isAdvOptOpen = !isAdvOptOpen;
});

$id("reloadFeedBut").addEventListener('click', () => {
    $id("nofeedsnotice")?.remove();
    const loadDiv = $id("divFeedLoading");
    loadDiv.style.display = "flex";
    const feed_elems  = document.querySelectorAll('feed-elem');
    feed_elems.forEach(f => { f.remove() });
    if (isSavedFOpen) {
        $id("openSavedFeeds").click();
    }
    fetch('/feeds/reload', {
        method: 'GET',
        headers: { "Content-Type": "application/json" },
    })
    .then(r => r.json())
    .then(async (data) => {
        SAVED_ARRAY.length = 0;
        createFeedFromData(data);
    });
});


$id("maxNOfItems").addEventListener("change", function() { 
    MAX_ITEMS = parseInt(
        this.value
    );
});
$id("maxNOfItemsFeed").addEventListener("change", function() { 
    MAX_FEED_ITEMS = parseInt(
        this.value
    );
});

function createFeedFromData(data) {
    const loadDiv = $id("divFeedLoading");
    let feedItems = [
        ...data.feeds.map(f => {
            let src_link = DATA.links.find(x => {
                return x.dir === f.srcLink;
            });
            let n = src_link.noi < 1 ? MAX_FEED_ITEMS : src_link.noi; //noi === Number of items
            let sliced = f.items.slice(0, n);
            for (let i = 0; i < n; i++) {
                if (!sliced[i]) { continue; } // If feed's length < size
                sliced[i].baseUrl     = cleanURL(src_link.dir);
                sliced[i].customTitle = src_link.title;
                sliced[i].customColor = f.customColor || ["rgba(0,0,0,1)", "rgba(0,0,0,1)"];
                sliced[i].fTitle      = f.title;
                sliced[i].fPubDate    = f.pubDate;
            }
            return sliced;
        })
    ];
    feedItems = feedItems.flat();
    feedItems.sort((a, b) => {
        const timeA = calcTime(a.pubDate);
        const timeB = calcTime(b.pubDate);      
        if (timeA[1] === timeB[1]) {
            return timeA[0] - timeB[0]
        } else {
            return timeA[1] - timeB[1]
        }
    });
        
    loadDiv.style.display = "none";
    if (feedItems.length === 0) {
        for (const sf of data.saved) {
            SAVED_ARRAY.push(sf);
            mkFeedHTML(sf, true);
        }
    }
    if (feedItems.length > MAX_ITEMS) {
        feedItems = feedItems.slice(0, MAX_ITEMS - 1);
    }
    let nO, nS = 0;
    
    let _sfc = true;
    for (const feed of feedItems) { // `feed` === ITEM
        let is = false;
        // Check if feed is saved + gets HTML'd
        for (const sf of data.saved) {
            if (feed.link === sf.link) {
                is = true;
            }
            if (_sfc) {
                nS++;
                SAVED_ARRAY.push(sf);
                mkFeedHTML(sf, nS, true);
            }
        }
        nO++;
        feed.isSaved = is; // if it `is` saved, gets a different style to differentiate it
        _sfc = false;
        mkFeedHTML(feed);
    }
    const feedcheck = document.querySelector("feed-elem:not(.favItem)");
    if (!feedcheck) { // check if no feeds were created
        const notice = $mk("p");
        notice.id = "nofeedsnotice";
        notice.textContent = "No feeds to load";
        FEED.appendChild(notice);
    }
}

function orderFeedElems(o) {
    const elems = isSavedFOpen ? Array.from($qa(".favItem")) : Array.from($qa("feed-elem:not(.favItem)"));

    elems.sort((a, b) => {
        const aN = Number(a.dataset.order);
        const bN = Number(b.dataset.order);
        if (aN === bN) {
            return o === "des" ? (Number(a.dataset.interval) - Number(b.dataset.interval)) : (Number(b.dataset.interval) - Number(a.dataset.interval));
        } else {
            return o === "des" ? (aN - bN) : (bN - aN);
        }
    });

    // Re append in sorted order
    isSavedFOpen ?
        elems.forEach(node => S_FEED.appendChild(node))
    :
        elems.forEach(node => FEED.appendChild(node));
}

$id("feedOrder").addEventListener("change", function() {
    orderFeedElems(this.value);
});






// Useless but prettier I<3JS
window.addEventListener("load", () => {
    POPUP.init();
    loadFeeds();
});