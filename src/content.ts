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

function runTracker() {
  console.log("run");
  let price = "";
  let promo = "";
  let unitPrice = "";
  let name = "";
  let productID = "";
  let link = "";
  waitForElm(".selling-price-list__item__price--now-price__value").then(
    (elm: any) => {
      console.log("Price");
      console.log(elm.textContent);
      waitForElm(".product-name__item--name").then((elm: any) => {
        console.log("Item Name");
        console.log(elm.textContent);
      });
    }
  );

  waitForElm("div.product-promo__badge-wrapper > div > p").then((elm: any) => {
    console.log("Promo");
    console.log(elm.textContent);
  });

  waitForElm(".fulfillment-mode-button__content__location > span").then(
    (elm: any) => {
      console.log("Location");
      console.log(elm.textContent);
    }
  );
  waitForElm("#site-content > div > div > div.product-tracking > div.product-details-page-details > div.product-details-page-details__content__name > div > div > div.product-details-page-details__content__sticky-placeholder > div > div.product-details-page-details__content__prices > div > ul > li > span").then(
    (elm: any) => {
      console.log("Unit Price");
      console.log(elm.textContent);
    }
  );
  waitForElm(".product-details-accordion__item > div > div > div > p > span").then(
    (elm: any) => {
      console.log("Product Number");
      chrome.runtime.sendMessage({productNumber: elm.textContent});
    }
  );
  waitForElm("#site-content > div > div > div.product-details-accordion").then(
    (elm: any) => {
      const ctx = document.createElement("canvas");
      ctx.id = "price-tracker";
      elm!.prepend(ctx);
      new ChartJS(ctx, {
        type: 'line',
        data: {
          labels: ["January", "February", "March", "April", "May", "June", "July"],
          datasets: [{
            label: 'My First Dataset',
            data: [65, 59, 80, 81, 56, 55, 40],
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        },
      });
      
    }
  );
}

chrome.runtime.onConnect.addListener(() => {
  for(const obs of observers){
    obs.disconnect();
  }
  runTracker();
});

export {};
