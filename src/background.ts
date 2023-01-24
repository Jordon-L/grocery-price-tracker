chrome.runtime.onInstalled.addListener(() => {
  console.log("onInstalled...");
  // create alarm after extension is installed / upgraded
  chrome.alarms.create("refresh", { periodInMinutes: 1 });

  chrome.storage.sync.set({ counter: 0 }, function () {
    //  A data saved callback omg so fancy
  });
});
let count = 0;
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log(alarm.name); // refresh
  helloWorld();
});

function helloWorld() {
  chrome.storage.sync.get(/* String or Array */ ["counter"], function (items) {
    count = items["counter"];
    count++;
    chrome.storage.sync.set({ counter: count }, function () {
      console.log(`Hello, world! ${count}`);
    });
  });
}

function sendMessage() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    console.log(tabs);
    chrome.tabs.connect(tabs[0].id!);
  });
}

function logURL(requestDetails: any) {
  console.log(`Loading: ${requestDetails.url}`);
  setTimeout(sendMessage, 1000);

}
chrome.webRequest.onBeforeRequest.addListener(logURL, {
  urls: ["*://*.realcanadiansuperstore.ca/api/product/*"],
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(request);
  console.log(sender);
  console.log(sendResponse);
});
export {};
