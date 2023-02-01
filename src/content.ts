import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineController,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Item } from "./types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineController,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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
          if(tag === "limit"){
            let array = promoText.split(" ");
            price = array[0].slice(1);
          }
          else if(tag === "multi"){
            let array = promoText.split(" ");
            let amount = array[0];
            price = Number(array[2].slice(1))/Number(amount);
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
        chrome.runtime.sendMessage({
          type: "chart",
          data: { productSKU: productSKU, location: location},
        });
        scrapePrice();
      }
    );
  });
}

function addToWatchList() {
  let link = window.location.href;
  let title = document.title;
  chrome.runtime.sendMessage({ type: "watchlist", data: { link, title } });
}

function createChart() {
  const elm = document.querySelector(
    "#site-content > div > div > div.product-details-accordion"
  );

  const ctx = document.createElement("canvas");
  const button = document.createElement("button");
  button.textContent = "Add To Watchlist";
  button.style.margin = "10px";
  button.className =
    "common-button--theme-base common-button--weight-regular common-button--size-medium";
  button.addEventListener("click", addToWatchList);
  ctx.id = "price-tracker";
  elm!.prepend(button);
  elm!.prepend(ctx);
  new ChartJS(ctx, {
    type: "line",
    data: {
      labels: ["January", "February", "March", "April", "May", "June", "July"],
      datasets: [
        {
          label: "My First Dataset",
          data: [65, 59, 80, 81, 56, 55, 40],
          fill: false,
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
        },
      ],
    },
  });
}
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let type = request.type;
  if (type == "chart") {
    createChart();
  }
});

chrome.runtime.onConnect.addListener(() => {
  const regex = /\/*\/p\/[a-z0-9_]+/;
  for (const obs of observers) {
    obs.disconnect();
  }
  const found = document.location.pathname.match(regex);
  if(found != null){
    runTracker();
  }
  
});

export {};
