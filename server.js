const open = require('open');
const express = require('express');
const path = require('path');
const fs = require('fs');
const RSSParser = require('rss-parser');
const readline = require('readline');


const PORT = 2060;
const HOST = "127.0.0.1";

const parser = new RSSParser({
    timeout: 5000,
});

const app    = express();
app.use(express.text({ limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/public')));

const FEEDS = [];
var SAVED_FEEDS = [];
var LINKS = [];
var FEEDS_READY    = false;
var S_FEEDS_READY  = false;
var ERROR_FILEREAD = false;


const Col = {
    red:   (s) => `\u001b[0;31m${s}\u001b[0m`,
    green: (s) => `\u001b[0;32m${s}\u001b[0m`,
    cyan:  (s) => `\u001b[38;5;44m${s}\u001b[0m`
}

function checkFileExists(path, data = '') {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, data);
        console.log("* Created file: ", Col.green(path));
    }
}

function loadEverything(time=false) {
    getSavedFeeds();
    const t1 = time ? new Date() : null;
    return new Promise((res, rej) => {
        fs.readFile("./userdata/data.json", async (err, data) => {
            if (err) {
                ERROR_FILEREAD = true;
                console.log(err);
                return;
            }
            const d = JSON.parse(data);
            LINKS = d.links ? d.links : []; // in case data.json is empty
            await Promise.all(LINKS.map(async (_link) => {
                const url = _link.dir;
                if (!URL.canParse(url)) { return; }
                let feed = await parser.parseURL(url).catch(e => {
                    const _uo = new URL(url);
                    console.log(Col.red("Error fetching: "), _uo.hostname, "\n", url, "\n└───", (e.code || e));
                });
                if (!feed) { return; }
                feed.srcLink = url;
                feed.customColor = _link.col || ["rgba(0,0,0,1)", "rgba(0,0,0,1)"];
                FEEDS.push(feed);
            })); // <- 
            FEEDS_READY = true;
            if (time) {
                const t2 = new Date();
                const t = t2 - t1 < 1000 ? (t2 - t1).toString() + "ms" : ((t2 - t1) / 1000).toFixed(1).toString() + "s";
                
                console.log("\n-------------------------");
                console.log("Feeds loaded in "+ t +"\nFeeds amount: " + Col.cyan(FEEDS.length) +"/"+ Col.cyan(LINKS.length));
                console.log("-------------------------");
            }
            res();
        });
    });
}


function waitForFeeds() {
    return new Promise((res) => {
        const check = () => {
            if ((S_FEEDS_READY && FEEDS_READY) || ERROR_FILEREAD) {
                return res();
            }
            setTimeout(check, 350);
        };
        check();
    });
}

app.post('/savedata', (req, res) => {
    let modifiedJson = JSON.stringify(req.body, null, 2); // Convert the modified JSON back to a string
    fs.writeFile("./userdata/data.json", modifiedJson, 'utf8', (err) => { // Write the modified JSON back to the file
        if (err) {
            console.log(err);
            return;
        }
        res.send({ mes: "Data saved" })
    });
});

// Populates SAVED_FEEDS from saved.jsonl
// [{...}, {...}]
async function getSavedFeeds() {
    const stream = fs.createReadStream('./userdata/saved.jsonl');
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    rl.on('line', (line) => {
        SAVED_FEEDS.push(JSON.parse(line));
    });
    rl.on('close', () => {
        S_FEEDS_READY = true;
        rl.close();       //* ???
        stream.destroy(); //*
    });
}

app.post('/feeds/save', (req, res) => {
    if (!req.body) { return }
    const data = JSON.parse(req.body);
    SAVED_FEEDS = [...data];
    const lines = data.map(o => JSON.stringify(o)).join('\n') + '\n';
    fs.writeFile('./userdata/saved.jsonl', lines, (err) => {
        if (err) { throw err; }
        console.log("Feeds saved");
    });

});


app.get('/feeds/reload', async (req, res) => {
    FEEDS_READY    = false;
    ERROR_FILEREAD = false;
    FEEDS.length = 0; // Clear array for reloading
    SAVED_FEEDS.length = 0;
    loadEverything();
    await waitForFeeds();
    res.send({ feeds: FEEDS, saved: SAVED_FEEDS, error: ERROR_FILEREAD });
});

app.get('/feeds', async (req, res) => {
    await waitForFeeds();
    res.send({ saved: SAVED_FEEDS, links: LINKS, feeds: FEEDS, error: ERROR_FILEREAD });
});



checkFileExists('./userdata/data.json', '{}'); // Make data json parseable
checkFileExists('./userdata/saved.jsonl');
app.listen(PORT, HOST, () => {
    loadEverything(true);
    console.log(`\nListening on: http://${HOST}:${PORT}/`)
    open(`http://${HOST}:${PORT}/`);
});