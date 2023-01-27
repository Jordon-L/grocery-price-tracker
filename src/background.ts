import { Item, Site } from "./types";

chrome.runtime.onInstalled.addListener(() => {
  console.log("onInstalled...");
  chrome.storage.sync.set({ watchlist: [] });
});

function connect(tabId: number) {
  chrome.tabs.connect(tabId);
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

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let type = request.type;

  if (type == "data") {
    let data = request.data as Item;
    if (data.location != "") {
      console.log(data.location);
      //add to database
    }
  } else if (type == "watchlist") {
    let data = request.data as Site;
    let link = data.link;
    let title = data.title;
    chrome.storage.sync.get(["watchlist"], function (items) {
      let watchlist = items["watchlist"] as Array<Site>;
      let duplicate = watchlist.map((item) => item.link).includes(link);
      if (duplicate == false) {
        watchlist.push({ link, title });
        chrome.storage.sync.set({ watchlist: watchlist });
      }
    });
  } else if (type == "chart") {
    let data = request.data;
    console.log(data.productSKU);
    //call database with product sku
    sendMessage(sender.tab.id, "chart", "placeholder");
  }
});
export {};
