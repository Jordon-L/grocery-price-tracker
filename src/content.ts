import bb, { step } from "billboard.js";
import { Item } from "./types";

let observers = [] as MutationObserver[];
function waitForElm(selector: string) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });
    observers.push(observer);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

function sendToDatabase(data: Item) {
  chrome.runtime.sendMessage({ type: "data", data: data });
}

function scrapePrice() {
  waitForElm("#site-content > div > div > div.product-tracking").then(
    (elm: HTMLElement) => {
      const result = JSON.parse(elm.dataset.trackProductsArray);
      const data = result[0];
      let price = data.productPrice;
      let regularPrice = data.productPrice;
      let name = data.productName;
      let brand = data.productBrand || "no brand";
      let productSKU = data.productSKU;
      let tag = "regular";
      let unit = "EA";
      let location = "";
      waitForElm(".fulfillment-mode-button__content__location > span").then(
        (elm: any) => {
          location = elm.textContent;
        }
      );
      if (data.dealBadge != null) {
        tag = data.dealBadge;
        waitForElm(
          `#site-content > div > div > div.product-tracking > div.product-details-page-details > 
          div.product-details-page-details__content__name > div > div > div.product-details-page-details__content__sticky-placeholder > 
          div > div.product-details-deals-badge.product-details-deals-badge--product-details-page-details > div > div > 
          div.product-promo__badge-wrapper > div > p`
        ).then((elm: any) => {
          let promoText = elm.textContent as string;
          if (tag === "limit") {
            let array = promoText.split(" ");
            price = array[0].slice(1);
          } else if (tag === "multi") {
            let array = promoText.split(" ");
            let amount = array[0];
            price = Number(array[2].slice(1)) / Number(amount);
          }
          waitForElm(
            `#site-content > div > div > div.product-tracking > div.product-details-page-details > 
            div.product-details-page-details__content__name > div > div > 
            div.product-details-page-details__content__sticky-placeholder > div > 
            div.product-details-page-details__content__prices > div > ul > li > span > span.price__value.comparison-price-list__item__price__value`
          ).then((elm: any) => {
            if (productSKU.includes("KG")) {
              price = elm.textContent;
              price = price.slice(1);
              unit = "KG";
            }
            console.log(price, tag, unit);
            if (tag === "sale") {
              sendToDatabase({
                name,
                brand,
                price: price,
                productSKU,
                tag: "regular",
                unit,
                location,
              });
            } else {
              sendToDatabase({
                name,
                brand,
                price,
                productSKU,
                tag,
                unit,
                location,
              });
              sendToDatabase({
                name,
                brand,
                price: regularPrice,
                productSKU,
                tag: "regular",
                unit,
                location,
              });
            }
          });
        });
      } else {
        waitForElm(
          `#site-content > div > div > div.product-tracking > div.product-details-page-details > 
          div.product-details-page-details__content__name > div > div > 
          div.product-details-page-details__content__sticky-placeholder > div > 
          div.product-details-page-details__content__prices > div > ul > li > span > span.price__value.comparison-price-list__item__price__value`
        ).then((elm: any) => {
          if (productSKU.includes("KG")) {
            price = elm.textContent;
            price = price.slice(1);
            unit = "KG";
          }
          console.log(price, tag, unit);
          sendToDatabase({
            name,
            brand,
            price,
            productSKU,
            tag,
            unit,
            location,
          });
        });
      }
    }
  );
}

function runTracker() {
  //wait for website to load
  waitForElm(
    ".product-details-accordion__item > div > div > div > p > span"
  ).then((elm: any) => {
    console.log("Product Number");
    //request chart data
    let productSKU = elm.textContent;
    waitForElm(".fulfillment-mode-button__content__location > span").then(
      (elm: any) => {
        let location = elm.textContent;
        scrapePrice();
        chrome.runtime.sendMessage({
          type: "chart",
          data: { productSKU: productSKU, location: location },
        });
      }
    );
  });
}

function addToWatchList(event: Event) {
  let link = window.location.href;
  let title = document.title;
  chrome.runtime.sendMessage({ type: "watchlist", data: { link, title } });
  let button = document.querySelector(".add-watchlist");
  button.textContent = "Added";
}

function insertData(prices: [], priceArray: string[], dateArray: string[]) {
  prices.forEach((element: any) => {
    let date = new Date(element.date).toLocaleDateString("en-US", {
      timeZone: "UTC",
    });
    priceArray.push(element.price);
    dateArray.push(date);
  });
}
function createChart(data: any) {
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const elm = document.querySelector(
    "#site-content > div > div > div.product-tracking"
  );

  const ctx = document.createElement("div");
  const button = document.createElement("button");
  button.textContent = "Add To Watchlist";
  button.className =
    "common-button--theme-base common-button--weight-regular common-button--size-medium add-watchlist";
  button.addEventListener("click", addToWatchList);
  ctx.id = "price-tracker";
  elm!.append(ctx);
  elm!.append(button);

  let dateArray = [["x0"], ["x1"], ["x2"]];
  let priceArray = [["limit"], ["multi"], ["regular"]];
  insertData(data.limitPrice, priceArray[0], dateArray[0]);
  insertData(data.multiPrice, priceArray[1], dateArray[1]);
  insertData(data.regularPrice, priceArray[2], dateArray[2]);
  let prices = Object.values(data)[0] as any;
  let unit: any = undefined;
  if(prices.length != 0 ){
    unit = prices[0].unit;
  }
  
  let chart = bb.generate({
    data: {
      xs: {
        limit: "x0",
        multi: "x1",
        regular: "x2",
      },
      columns: [
        dateArray[0],
        dateArray[1],
        dateArray[2],
        priceArray[0],
        priceArray[1],
        priceArray[2],
      ],
      type: "step",
      empty: {
        label: {
          text: "No Data",
        },
      },
    },
    axis: {
      x: {
        type: "timeseries",
        tick: {
          format: "%m-%d-%Y",
          rotate: -60,
        },
      },
      y: {
        min: 0,
        padding: {
          bottom: 0,
        },
        tick: {
          format: (y: number) => formatter.format(y),
        },
      },
    },
    line: {
      step: {
        type: "step-after",
        tooltipMatch: true,
      },
    },
    point: {
      r: 5,
    },
    grid: {
      x: {
        show: true,
      },
      y: {
        show: true,
      },
    },
    padding: {
      left: 60,
      right: 60,
    },
    tooltip: {
      format: {
        value: function (value, ratio, id, index) {
          if(unit == undefined){
            return formatter.format(value);
          }
          return `$${formatter.format(value)}/${unit}`;
        },
      },
    },
    bindto: "#price-tracker",
  });
  let d = { limit: "#ed8e07", multi: "#f4e900", regular: "black" };

  chart.data.colors(d);
}
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let type = request.type;
  if (type == "chart") {
    console.log(request);
    createChart(request.data);
  }
});

chrome.runtime.onConnect.addListener(() => {
  const regex = /\/*\/p\/[a-z0-9_]+/;
  for (const obs of observers) {
    obs.disconnect();
  }
  const found = document.location.pathname.match(regex);
  if (found != null) {
    runTracker();
  }
});

export {};
