import { Item, Site } from "./types";
import { config } from "./config";

// Declare helper function before referencing as a callback
function createAlarm() {
  console.log("create alarm");
  chrome.alarms.create("track", { periodInMinutes: 60, delayInMinutes: 1 });
}

let openTabs: number[] = [];

function timer(ms: number) { 
  return new Promise(res => setTimeout(res, ms)); 
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("onInstalled...");
  chrome.alarms.clearAll(createAlarm);
  
  chrome.storage.sync.get(["watchlist"], async function (items) {
    if (items === undefined || !items.watchlist) {
      chrome.storage.sync.set({ watchlist: [] });
    }
  });

  chrome.storage.sync.set({ api_key: config.MY_KEY });
  chrome.storage.sync.set({ user_id: config.USER });
});

chrome.alarms.onAlarm.addListener((alarmInfo) => {
  if (alarmInfo.name === "track") {
    chrome.storage.sync.get(["watchlist"], async function (items) {
      let watchlist = (items["watchlist"] || []) as Array<Site>;
      console.log(watchlist);

      for (const elm of watchlist) {
        if (Date.now() > elm.time) {
          let tab = await chrome.tabs.create({ pinned: true, active: false, index: 0, url: elm.link });
          if (tab.id !== undefined) {
            openTabs.push(tab.id);
          }
          let date = new Date();
          date.setHours(date.getHours() + 12);
          date.setHours(0, 0, 0, 0);
          elm.time = date.getTime();
          let randomNum = Math.floor(Math.random() * 20) + 15;
          await timer(randomNum * 1000);
          closeTabs();
        }
      }
      chrome.storage.sync.set({ watchlist: watchlist });
    });
  }
});

async function getPrices(productSKU: string, location: string) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["api_key"], async function (items) {
      let key = items["api_key"];

      const response = await fetch(
        `https://tracker.jordonlee.com/api/price/${location}/${productSKU}`,
        {
          method: "get",
          headers: { "Content-Type": "application/json", "x-api-key": key },
        }
      );
      const data = await response.json();
      return resolve(data);
    });
  });
}

async function addPrice(opts: Item) {
  const body = { ...opts };
  chrome.storage.sync.get(["api_key"], async function (items) {
    let key = items["api_key"];
    try {
      const response = await fetch("https://tracker.jordonlee.com/api/price", {
        method: "post",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "x-api-key": key },
      });
      console.log(`[price-tracker] POST /api/price -> ${response.status}`, body);
      const data = await response.json();
      console.log(`[price-tracker] added data point: ${body.productSKU} @ ${body.location} - $${body.price}`, data);
    } catch (e) {
      console.error("[price-tracker] failed to add data point", body, e);
    }
  });
}

function connect(tabId: number) {
  chrome.tabs.connect(tabId);
}

async function closeTabs() {
  for (const openTab of openTabs) {
    connect(openTab);
    await timer(2000);
    chrome.tabs.remove(openTab);
  }
  openTabs = [];
}

function sendMessage(tabId: number, type: string, data: any) {
  chrome.tabs.sendMessage(tabId, { type, data });
}

function logURL(requestDetails: any) {
  console.log(`Loading: ${requestDetails.url}`);
  setTimeout(connect, 1000, requestDetails.tabId);
}

chrome.webRequest.onCompleted.addListener(logURL, {
  urls: ["*://api.pcexpress.ca/pcx-bff/api/v1/products/*"],
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let type = request.type;

  if (type === "data") {
    let data = request.data as Item;
    console.log("[price-tracker] received data message", data);
    if (data.location !== "") {
      addPrice(data);
    } else {
      console.warn("[price-tracker] skipping data point, empty location", data);
    }
  } else if (type === "watchlist") {
    let data = request.data as Site;
    let link = data.link;
    let title = data.title;
    chrome.storage.sync.get(["watchlist"], function (items) {
      let watchlist = (items["watchlist"] || []) as Array<Site>;
      let duplicate = watchlist.map((item) => item.link).includes(link);
      let time = Date.now() + 100000;
      if (!duplicate) {
        watchlist.push({ link, title, time });
        chrome.storage.sync.set({ watchlist: watchlist });
      }
    });
  } else if (type === "chart") {
    if (sender.tab && sender.tab.id && openTabs.includes(sender.tab.id)) {
      return;
    }
    let data = request.data;
    const location =
      data.location ||
      (typeof __LOCATION__ !== "undefined" ? __LOCATION__ : "");
    getPrices(data.productSKU, location).then((prices) => {
      if (sender.tab && sender.tab.id) {
        sendMessage(sender.tab.id, "chart", prices);
      }
    });
  }
  return true; // Keep message channel open for async handlers
});

export {};