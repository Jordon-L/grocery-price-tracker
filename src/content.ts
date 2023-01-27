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
      console.log(elm.dataset);
      const result = JSON.parse(elm.dataset.trackProductsArray);
      console.log(result);
      const data = result[0];
      let price = data.productPrice;
      let name = data.productName;
      let brand = data.productBrand;
      let productSKU = data.productSKU;
      let promo = "";
      let unitPrice = "";
      let link = window.location.href;
      let title = document.title;
      let location = "";
      waitForElm(".fulfillment-mode-button__content__location > span").then(
        (elm: any) => {
          location = elm.textContent;
        }
      );

      if (data.dealBadge != null) {
        waitForElm("div.product-promo__badge-wrapper > div > p").then(
          (elm: any) => {
            console.log(elm.textContent);
            promo = elm.textContent;
            waitForElm(
              "#site-content > div > div > div.product-tracking > div.product-details-page-details > div.product-details-page-details__content__name > div > div > div.product-details-page-details__content__sticky-placeholder > div > div.product-details-page-details__content__prices > div > ul > li > span"
            ).then((elm: any) => {
              console.log(elm.textContent);
              unitPrice = elm.textContent;
              sendToDatabase({
                name,
                brand,
                price,
                productSKU,
                promo,
                unitPrice,
                link,
                title,
                location,
              });
              console.log("send");
            });
          }
        );
      } else {
        waitForElm(
          "#site-content > div > div > div.product-tracking > div.product-details-page-details > div.product-details-page-details__content__name > div > div > div.product-details-page-details__content__sticky-placeholder > div > div.product-details-page-details__content__prices > div > ul > li > span"
        ).then((elm: any) => {
          console.log(elm.textContent);
          unitPrice = elm.textContent;
          sendToDatabase({
            name,
            brand,
            price,
            productSKU,
            promo,
            unitPrice,
            link,
            title,
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
    chrome.runtime.sendMessage({
      type: "chart",
      data: { productSKU: elm.textContent },
    });

    //scrape price
    scrapePrice();
  });
}

function addToWatchList(){
  let link = window.location.href;
  let title = document.title;
  chrome.runtime.sendMessage({ type: "watchlist", data: {link, title} });
}

function createChart() {
  const elm = document.querySelector(
    "#site-content > div > div > div.product-details-accordion"
  );

  const ctx = document.createElement("canvas");
  const button = document.createElement("button");
  button.textContent = "Add To Watchlist";
  button.style.margin = "10px";
  button.className = "common-button--theme-base common-button--weight-regular common-button--size-medium";
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
  for (const obs of observers) {
    obs.disconnect();
  }
  runTracker();
});



export {};
