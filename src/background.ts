import { Item, Site } from "./types";


chrome.runtime.onInstalled.addListener(() => {
  console.log("onInstalled...");
  chrome.storage.sync.set({ watchlist: [] });
  chrome.storage.sync.set({ api_key: "4b8282fe-cb00-4ba3-ba0c-c8af1e04e92c" });
  chrome.storage.sync.set({ user_id: "4900d2d2-b722-4378-90b4-c28223401e72" });
});

function getProfile() {
  let id = null;
  chrome.identity.getProfileUserInfo(
    ({ accountStatus: "ANY" } as chrome.identity.ProfileDetails,
    async function (info) {
      id = info.id;
      const response = await fetch("https://github.com/");
      const data = await response.json();
    })
  );
}

async function getPrices(productSKU: string, location: string) {
  const body = { productSKU, location };
  chrome.storage.sync.get(["api_key"], async function (items) {
    let key = items["api_key"];
    const response = await fetch(`https://tracker.jordonlee.com/api/price/${location}/${productSKU}`, {
      method: "get",
      headers: { "Content-Type": "application/json", "x-api-key": key},
    });
    const data = await response.json(); 
    console.log(data);   
  });
}

async function addPrice(opts: Item ) {
  const body = { ...opts };

  const response = await fetch("https://tracker.jordonlee.com/api/price", {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
}

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
    console.log(data.productSKU, data.location);
    //call database with product sku
    getPrices(data.productSKU, data.location);
    sendMessage(sender.tab.id, "chart", "placeholder");
  }
});
export {};
