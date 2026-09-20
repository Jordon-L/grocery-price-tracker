import { Item } from "./types";
// The canvas renderer is a separate ESM module: importing from
// "billboard.js/canvas" and calling canvas() registers it on the chart
// prototype (the plain "billboard.js" entry throws if render.mode is
// "canvas" without this).
import bb, { step, scatter, canvas } from "billboard.js/canvas";
// billboard.js 4.x reads its default styles from CSS, so the library's own
// stylesheet must be in the page (it is not imported by the JS bundle).
import billboardCss from "billboard.js/dist/billboard.min.css";
console.log("Content script running");
let observers = [] as MutationObserver[];
function waitForElm<T extends HTMLElement = HTMLElement>(selector: string): Promise<T> {
  return new Promise<T>((resolve) => {
    const existingElm = document.querySelector<T>(selector);
    if (existingElm) {
      return resolve(existingElm);
    }

    const observer = new MutationObserver(() => {
      const elm = document.querySelector<T>(selector);
      if (elm) {
        observer.disconnect();
        resolve(elm);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    observers.push(observer);
  });
}

let currentChart: any = null;
let scrapedPoints: Item[] = [];
// Set by createChart; folds a freshly-scraped point into the live chart.
let addLivePoint: ((data: Item) => void) | null = null;

// Max points drawn on the shared x-axis, as a backup for very large
// histories. Canvas mode renders thousands of points smoothly, so the cap
// is high and only kicks in for huge datasets.
const MAX_POINTS = 10000;
// "All" spans years; same cap now that canvas handles the density.
const ALL_MAX_POINTS = 10000;

function sendToDatabase(data: Item) {
  // Keep the points we scraped so we can add them to the chart.
  scrapedPoints.push(data);
  if (currentChart) {
    addPointToChart(currentChart, data);
  }
  chrome.runtime.sendMessage({ type: "data", data: data });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}

function addPointToChart(chart: any, data: Item) {
  console.log("[price-tracker] adding point to chart", data);
  // createChart installs the real updater (it owns the combined data and the
  // chart). Guard against a scrape that lands before the first chart exists.
  if (addLivePoint) {
    addLivePoint(data);
  }
}

function scrapePrice() {
  waitForElm("#site-content > div[data-track-products-array]").then(
    (elm: HTMLElement) => {

      const result = JSON.parse(elm.dataset.trackProductsArray ?? '{}');
      const data = result[0];
      if (data == undefined) {
        return;
      }
      let price = data.productPrice;
      let regularPrice = data.productPrice;
      let name = data.productName;
      let brand = data.productBrand || "no brand";
      let productSKU = data.productSKU;
      let tag = "regular";
      let unit = "EA";
      // The locations table uses short names (e.g. 'Grandview'), so use the
      // .env LOCATION value instead of the full store name from the DOM.
      let location = __LOCATION__;
      console.log("[price-tracker] location:", location);
      if (data.dealBadge != null) {
        tag = data.dealBadge;
        waitForElm(
          `#site-content .product-details-page-details__content__sticky-placeholder .product-details-deals-badge--product-details-page-details .product-promo__badge-wrapper p`
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
            `#site-content .product-details-page-details__content__sticky-placeholder .comparison-price-list__item__price__value`
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
          `#site-content .product-details-page-details__content__sticky-placeholder .comparison-price-list__item__price__value`
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
    scrapePrice();
    chrome.runtime.sendMessage({
      type: "chart",
      data: { productSKU: productSKU, location: __LOCATION__ },
    });
  });
}

function addToWatchList(event: Event) {
  let link = window.location.href;
  let title = document.title;
  chrome.runtime.sendMessage({ type: "watchlist", data: { link, title } });
  let button = document.querySelector(".add-watchlist");
  if(button){
    button.textContent = "Added";
  }

}

function insertData(
  prices: any[],
  priceArray: string[],
  dateArray: string[],
  timeArray: number[]
) {
  prices.forEach((element: any) => {
    const t = new Date(element.date).getTime();
    if (Number.isNaN(t)) {
      return;
    }
    priceArray.push(String(element.price));
    dateArray.push(formatDate(new Date(t)));
    timeArray.push(t);
  });
}

function sortSeries(dates: string[], prices: string[], times: number[]) {
  const pairs = dates.map((d, i) => ({ d, p: prices[i], t: times[i] }));
  pairs.sort((a, b) => a.t - b.t);
  dates.length = 0;
  prices.length = 0;
  times.length = 0;
  for (const row of pairs) {
    dates.push(row.d);
    prices.push(row.p);
    times.push(row.t);
  }
}
function createChart(data: any) {
  // Single-page app: tear down any previous chart first, or the pages
  // stack up and we end up with two charts on screen.
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  document.getElementById("price-tracker")?.remove();

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Insert the chart above the product description accordion item.
  const descItem = document.querySelector(
    ".product-details-accordion__item:has(.product-details-page-description)"
  ) as HTMLElement | null;

  // Outer wrapper: holds the chart div, the watchlist button, and the
  // filter row. Billboard must NOT bind here — if it measures this box
  // it counts the buttons in the height and the chart grows every click.
  const ctx = document.createElement("div");
  ctx.id = "price-tracker";
  // Inner div: the only element Billboard is allowed to draw in.
  // Fixed height so it can never grow.
  const chartBox = document.createElement("div");
  chartBox.id = "price-tracker-chart";
  chartBox.style.height = "320px";
  ctx.append(chartBox);

  const button = document.createElement("button");
  button.textContent = "Add To Watchlist";
  button.className =
    "common-button--theme-base common-button--weight-regular common-button--size-medium add-watchlist";
  button.addEventListener("click", addToWatchList);

  // Webpack doesn't load CSS files here, so style the filter buttons
  // with an inline <style> tag on the wrapper.
  const style = document.createElement("style");
  style.textContent = billboardCss + `
    .price-tracker-filters {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .price-tracker-filter {
      padding: 4px 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #f5f5f5;
      cursor: pointer;
      font-size: 13px;
    }
    .price-tracker-filter.active {
      background: #333;
      color: #fff;
      border-color: #333;
    }
    .price-tracker-stats {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 13px;
      color: #333;
    }
    /* billboard 4.x probes this container's computed CSS to determine
       default stroke widths (lines, axes, ticks, grid). The host page's
       global SVG rules leak into that probe and fatten everything, so
       reset to the SVG initial value and let billboard use its defaults. */
    #price-tracker-chart svg,
    #price-tracker-chart svg * {
      stroke-width: 1px !important;
    }
  `;
  ctx.append(style);

  if (descItem && descItem.parentNode) {
    descItem.parentNode.insertBefore(ctx, descItem);
  } else {
    // Fallback: append to the main content area.
    const fallback = document.querySelector("#site-content");
    fallback?.append(ctx);
  }

  let dateArray = [["x0"], ["x1"], ["x2"]];
  let priceArray = [["limit"], ["multi"], ["regular"]];
  let timeArray: number[][] = [[], [], []];
  insertData(data.limitPrice, priceArray[0], dateArray[0], timeArray[0]);
  insertData(data.multiPrice, priceArray[1], dateArray[1], timeArray[1]);
  insertData(data.regularPrice, priceArray[2], dateArray[2], timeArray[2]);
  // Include the points we already scraped (faster than the API round-trip)
  // so the current price shows on the chart immediately.
  const tagIndex: any = { limit: 0, multi: 1, regular: 2 };
  const now = Date.now();
  const today = formatDate(new Date(now));
  for (const point of scrapedPoints) {
    const i = tagIndex[point.tag];
    if (i == undefined) {
      continue;
    }
    const existing = dateArray[i].indexOf(today);
    if (existing !== -1) {
      // Already tracked today: update the existing point instead of
      // adding a duplicate.
      priceArray[i][existing] = String(point.price);
      timeArray[i][existing - 1] = now;
    } else {
      priceArray[i].push(String(point.price));
      dateArray[i].push(today);
      timeArray[i].push(now);
    }
  }
  scrapedPoints = [];

  // Keep the full dataset (without the series-name headers) so we can
  // re-filter it when the user changes the time range. Sort oldest
  // first: if the API returns newest-first, a 6-month hole looks like a
  // negative interval and is never treated as a gap.
  const fullDates = dateArray.map((d) => d.slice(1));
  const fullPrices = priceArray.map((p) => p.slice(1));
  const fullTimes = timeArray.map((t) => t.slice());
  for (let i = 0; i < 3; i++) {
    sortSeries(fullDates[i], fullPrices[i], fullTimes[i]);
  }
  const seriesIds = ["limit", "multi", "regular"];
  const seriesColors: { [id: string]: string } = {
    limit: "#ed8e07",
    multi: "#f4e900",
    regular: "black",
  };

  // Combine all three series onto ONE shared x-axis (the union of every
  // date). regular is the step line (a point on every scrape date); limit
  // and multi become colored scatter points on their own dates. A date with
  // no value for a series is null, so billboard skips it (no dot / gap).
  // Multiple scrapes on the same day collapse to the most recent price.
  const byDate: { [id: string]: Map<string, string> } = {
    limit: new Map(),
    multi: new Map(),
    regular: new Map(),
  };
  const dateTimes = new Map<string, number>(); // date -> latest time
  for (let i = 0; i < 3; i++) {
    const id = seriesIds[i];
    for (let j = 0; j < fullDates[i].length; j++) {
      const d = fullDates[i][j];
      const t = fullTimes[i][j];
      byDate[id].set(d, fullPrices[i][j]); // last (most recent) wins
      if (!dateTimes.has(d) || t > dateTimes.get(d)!) {
        dateTimes.set(d, t);
      }
    }
  }
  let combinedDates = Array.from(dateTimes.keys()).sort(
    (a, b) => dateTimes.get(a)! - dateTimes.get(b)!
  );
  let combinedTimes = combinedDates.map((d) => dateTimes.get(d)!);

  function capPoints(dates: string[], prices: string[], cap: number) {
    const stride = Math.ceil(dates.length / cap);
    if (stride <= 1) {
      return { dates, prices };
    }
    const outDates = [dates[0]];
    const outPrices = [prices[0]];
    for (let j = stride; j < dates.length - 1; j += stride) {
      outDates.push(dates[j]);
      outPrices.push(prices[j]);
    }
    outDates.push(dates[dates.length - 1]);
    outPrices.push(prices[prices.length - 1]);
    return { dates: outDates, prices: outPrices };
  }

  // Build the columns for a given number of days (undefined = all) on the
  // shared x-axis. regular anchors the step line; limit/multi are colored
  // scatter points (null on dates they don't have). A series with no points
  // in the range is omitted entirely: billboard throws if a series is empty.
  function buildColumns(days?: number) {
    const cutoff = days
      ? Date.now() - days * 24 * 60 * 60 * 1000
      : undefined;
    const cap = days === undefined ? ALL_MAX_POINTS : MAX_POINTS;
    // Dates within the window, on the shared x-axis.
    const dates: string[] = [];
    for (let j = 0; j < combinedDates.length; j++) {
      if (cutoff !== undefined && combinedTimes[j] < cutoff) {
        continue;
      }
      dates.push(combinedDates[j]);
    }
    if (dates.length < 2) {
      return { columns: [], xs: {} };
    }
    // Thin out only for very large histories (canvas handles the rest).
    const capped = capPoints(dates, dates, cap);
    const cd = capped.dates;
    const regularPrices = cd.map((d) => byDate.regular.get(d) ?? null);
    // regular anchors the step line; if it has no value in the window the
    // chart is empty.
    if (!regularPrices.some((v) => v != null)) {
      return { columns: [], xs: {} };
    }
    const columns: (string | number | null)[][] = [
      ["x", ...cd],
      ["regular", ...regularPrices],
    ];
    // limit / multi are colored scatter points; include a series only if it
    // has at least one value in the window (billboard errors on empty).
    for (const id of ["limit", "multi"]) {
      const prices = cd.map((d) => byDate[id].get(d) ?? null);
      if (prices.some((v) => v != null)) {
        columns.push([id, ...prices]);
      }
    }
    return { columns, xs: {} };
  }

  function columnsFor(days?: number) {
    const sliced = buildColumns(days);
    return sliced.columns.length ? sliced : buildColumns();
  }

  // Lowest / average / highest for a window, from the RAW data (not the
  // collapsed/capped chart columns, which drop flat days and would skew
  // the average). Uses the same cutoff as buildColumns and every series
  // (limit, multi, regular) so a sale is the lowest.
  function statsFor(days?: number): { lowest: number; average: number; highest: number } | null {
    const cutoff = days
      ? Date.now() - days * 24 * 60 * 60 * 1000
      : undefined;
    let lowest = Infinity;
    let highest = -Infinity;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < fullPrices[i].length; j++) {
        if (cutoff !== undefined && fullTimes[i][j] < cutoff) {
          continue;
        }
        const v = Number(fullPrices[i][j]);
        if (isNaN(v)) {
          continue;
        }
        if (v < lowest) lowest = v;
        if (v > highest) highest = v;
        sum += v;
        count++;
      }
    }
    if (count === 0) {
      return null;
    }
    return { lowest, average: sum / count, highest };
  }

  const cachedColumns: {
    [label: string]: { columns: (string | number | null)[][]; xs: any };
  } = {
    "30d": columnsFor(30),
    "90d": columnsFor(90),
    "1yr": columnsFor(365),
    "All": columnsFor(),
  };

  // Precompute the stats per window so filter clicks stay instant.
  const cachedStats: { [label: string]: { lowest: number; average: number; highest: number } | null } = {
    "30d": statsFor(30),
    "90d": statsFor(90),
    "1yr": statsFor(365),
    "All": statsFor(),
  };

  // Filter buttons (30d / 90d / 1yr / All).
  const filterRow = document.createElement("div");
  filterRow.className = "price-tracker-filters";
  const filterOptions: { label: string; days?: number }[] = [
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "1yr", days: 365 },
    { label: "All" },
  ];
  // Default to 30d: the first paint is a smaller window, which feels
  // faster.
  let activeFilter: { label: string; days?: number } = {
    label: "30d",
    days: 30,
  };
  const filterButtons: { btn: HTMLButtonElement; opt: { label: string; days?: number } }[] = [];
  for (const opt of filterOptions) {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    btn.className = "price-tracker-filter";
    btn.addEventListener("click", () => {
      activeFilter = opt;
      for (const f of filterButtons) {
        f.btn.classList.toggle("active", f.opt === opt);
      }
      // Swap in only the sliced data (prebuilt once in cachedColumns).
      // transition duration is 0 and the box height is fixed, so this
      // is fast: only the visible points exist in the DOM.
      applyPayload(cachedColumns[opt.label]);
      renderStats(cachedStats[opt.label]);
    });
    filterRow.append(btn);
    filterButtons.push({ btn, opt });
  }
  // filterRow is appended after bb.generate() below, because
  // billboard clears the bindto container when the chart is created.
  let prices = Object.values(data)[0] as any;
  let unit: any = undefined;
  if(prices.length != 0 ){
    unit = prices[0].unit;
  }

  // Stats row: Lowest / Average / Highest for the active window.
  const statsRow = document.createElement("div");
  statsRow.className = "price-tracker-stats";
  const statsLabels = ["Lowest", "Average", "Highest"] as const;
  const statsSpans = statsLabels.map((label) => {
    const span = document.createElement("span");
    span.textContent = `${label} —`;
    statsRow.append(span);
    return span;
  });
  function renderStats(stats: { lowest: number; average: number; highest: number } | null) {
    const fmt = (v: number) =>
      unit == undefined ? `$${formatter.format(v)}` : `$${formatter.format(v)}/${unit}`;
    const values = stats
      ? [stats.lowest, stats.average, stats.highest].map(fmt)
      : ["—", "—", "—"];
    statsSpans.forEach((span, i) => {
      span.textContent = `${statsLabels[i]} ${values[i]}`;
    });
  }

  function applyPayload(payload: { columns: (string | number | null)[][]; xs: any }) {
    const present = new Set(payload.columns.map((c) => c[0]));
    const gone = seriesIds.filter((id) => !present.has(id));
    chart.load({
      columns: payload.columns,
      ...(gone.length ? { unload: gone } : {}),
    });
  }

  let chart = bb.generate({
    data: {
      columns: cachedColumns[activeFilter.label].columns,
      // All series share ONE x-axis column (the combined dates). Declaring it
      // via data.x tells billboard "x" is the axis, not a data series.
      x: "x",
      colors: seriesColors,
      // Tooltip / legend labels for each series.
      names: {
        regular: "Regular",
        limit: "Limit",
        multi: "Multi",
      },
      // regular is the step line; limit & multi render as circles (scatter)
      // on their own dates (null elsewhere, which billboard skips).
      type: step(),
      types: {
        // ESM: each shape type must be imported and called to register its
        // module (the string form only works with the full pkgd bundle).
        limit: scatter(),
        multi: scatter(),
      },
      empty: {
        label: {
          text: "No Data",
        },
      },
    },

    line: {
      step: {
        // Match the billboard.js step demo: the price holds its old value
        // until the change date, then jumps (step-after). tooltipMatch makes
        // the tooltip report the flat segment's value under the cursor
        // instead of interpolating between points.
        type: "step-after",
        tooltipMatch: true,
      },
    },

    render: {
      // Draw to a single <canvas> instead of one SVG node per point — much
      // faster with hundreds of step segments. canvas() registers the
      // renderer (first call) and returns the "canvas" mode string.
      mode: canvas(),
    },

    axis: {
      x: {
        type: "timeseries",
        // Treat the shared x-axis as a single axis for hover/tooltip: the
        // tooltip anchors on the closest date (always a regular point) and
        // shows limit/multi when they share that date, instead of requiring
        // the cursor to land within point_sensitivity of a dot.
        forceAsSingle: true,
        tick: {
          // Show month labels (the tooltip carries the exact date). Mark the
          // year at each January so multi-year charts stay unambiguous.
          format: (date: Date) => {
            const d = new Date(date);
            const month = d.toLocaleDateString("en-US", {
              month: "short",
              timeZone: "UTC",
            });
            return d.getUTCMonth() === 0
              ? `${month} ${d.getUTCFullYear()}`
              : month;
          },
          culling: {
            max: 8,
          },
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

    point: {
      // limit & multi (scatter) draw an always-visible circle per
      // point; the regular line keeps r=0 base points so no dots show.
      opacity: 1,
      r: (d) => (d.id === "regular" ? 0 : 4),
      focus: {
        expand: {
          // Fixed hover radius for every series. The regular step line has a
          // base r of 0, and billboard's default hover size is pointR * 1.75
          // (= 0), so without an explicit r no dot would ever show on it.
          // 5 keeps the scatter dots (base r 4) from shrinking on hover too.
          enabled: true,
          r: 5,
        },
      },
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
        // The default tooltip title reuses the x-axis tick format (months),
        // so set it explicitly to the full date.
        title: (x: any) => {
          const d = new Date(x);
          return d.toLocaleDateString("en-US", { timeZone: "UTC" });
        },
        value: function (value, ratio, id, index) {
          if(unit == undefined){
            return formatter.format(value);
          }
          return `$${formatter.format(value)}/${unit}`;
        },
      },
    },
    size: {
      // Lock the height so billboard doesn't guess from the container.
      height: 320,
    },
    transition: {
      // Skip the redraw animation: filters should feel instant.
      duration: 0,
    },
    bindto: "#price-tracker-chart",
  });

  // Append the button, filter row, and stats row to the OUTER wrapper
  // (never the inner chart div — that would put them back inside
  // billboard's box).
  ctx.append(button);
  ctx.append(filterRow);
  ctx.append(statsRow);

  // Mark the default filter button as active and show its stats.
  for (const f of filterButtons) {
    f.btn.classList.toggle("active", f.opt === activeFilter);
  }
  renderStats(cachedStats[activeFilter.label]);

  currentChart = chart;
  // Live-scrape updater: fold the new point into the combined data and
  // reload the active window. createChart owns the combined data, so the
  // updater lives here (addPointToChart just delegates to it).
  addLivePoint = (data: Item) => {
    if (data.tag == undefined || !byDate[data.tag]) {
      return;
    }
    const date = formatDate(new Date());
    const t = Date.now();
    byDate[data.tag].set(date, String(data.price));
    if (!dateTimes.has(date) || t > dateTimes.get(date)!) {
      dateTimes.set(date, t);
    }
    if (!combinedDates.includes(date)) {
      combinedDates.push(date);
    }
    combinedDates.sort((a, b) => dateTimes.get(a)! - dateTimes.get(b)!);
    combinedTimes = combinedDates.map((d) => dateTimes.get(d)!);
    const payload = buildColumns(activeFilter.days);
    if (payload.columns.length) {
      applyPayload(payload);
    }
  };
}
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let type = request.type;
  if (type == "chart") {
    console.log(request);
    createChart(request.data);
  }
});

const productPath = /\/p\/[a-z0-9_]+/i;

function startTrackerIfProductPage() {
  for (const obs of observers) {
    obs.disconnect();
  }
  observers = [];
  if (productPath.test(document.location.pathname)) {
    runTracker();
  }
}

chrome.runtime.onConnect.addListener(startTrackerIfProductPage);
startTrackerIfProductPage();

export {};
