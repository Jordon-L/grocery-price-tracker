import { Item, Site } from "./types";

let openTabs: number[] = [];
function timer(ms: number) { return new Promise(res => setTimeout(res, ms)); }
chrome.runtime.onInstalled.addListener(async () => {
  console.log("onInstalled...");
  chrome.alarms.clearAll(createAlarm);

});

chrome.alarms.onAlarm.addListener(
  (alarmInfo) => {
    console.log("alarm", Date.now().toLocaleString("en-us"));
    if(alarmInfo.name === "track"){
      chrome.storage.sync.get(["watchlist"], async function (items) {
        let watchlist = items["watchlist"] as Array<Site>;
        console.log(watchlist);
        let index = 0;
        for(const elm of watchlist){
          if(Date.now() > elm.time){
            let tab = await chrome.tabs.create({pinned: true, active: false, index:0, url: elm.link});
            openTabs.push(tab.id);
            var date = new Date();
            watchlist[index] = {time: Date.now() + 7200000, link: elm.link, title: elm.title};
            let randomNum = Math.floor(Math.random() * 30) + 15;
            await timer(randomNum*1000);
            closeTab(tab.id);
            index++;
          }
        }
        chrome.storage.sync.set({ watchlist: watchlist });
      });
    }
  }
)

function createAlarm(){
  console.log("create alarm");
  chrome.alarms.create("track", {periodInMinutes: 60, delayInMinutes: 1});
}

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
    const response = await fetch("https://tracker.jordonlee.com/api/price", {
      method: "post",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "x-api-key": key },
    });
    const data = await response.json();
  });
}

function connect(tabId: number) {
  chrome.tabs.connect(tabId);
}

function closeTab(tabId: number){
  if(openTabs.includes(tabId)){
    openTabs = openTabs.filter((elm) => elm != tabId);
    chrome.tabs.remove(tabId);
  }
}

function sendMessage(tabId: number, type: string, data: any) {
  chrome.tabs.sendMessage(tabId, { type, data });
}

function logURL(requestDetails: any) {
  console.log(`Loading: ${requestDetails.url}`);
  setTimeout(connect, 1000, requestDetails.tabId);
  
}
chrome.webRequest.onCompleted.addListener(logURL, {
  urls: ["*://*.realcanadiansuperstore.ca/api/product/*"],
});

chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  let type = request.type;

  if (type == "data") {
    let data = request.data as Item;
    if (data.location != "") {
      console.log(data);
      //add to database
      addPrice(data);
    }
  } else if (type == "watchlist") {
    let data = request.data as Site;
    let link = data.link;
    let title = data.title;
    chrome.storage.sync.get(["watchlist"], function (items) {
      let watchlist = items["watchlist"] as Array<Site>;
      let duplicate = watchlist.map((item) => item.link).includes(link);
      let time = Date.now() + 100000;
      if (duplicate == false) {
        watchlist.push({ link, title, time});
        chrome.storage.sync.set({ watchlist: watchlist });
      }
    });
  } else if (type == "chart") {
    if(openTabs.includes(sender.tab.id)){
      return;
    }
    let data = request.data;
    console.log(data.productSKU, data.location);
    //call database with product sku
    const prices = await getPrices(data.productSKU, data.location);
    sendMessage(sender.tab.id, "chart", prices);
  }
});
export {};
