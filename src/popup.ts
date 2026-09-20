import { Site } from "./types";

chrome.storage.sync.get(["watchlist"], function (items) {
  const watchlist = items["watchlist"] ?? [];
  const elm = document.querySelector(".list");

  if (watchlist.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Your watchlist is empty.";
    elm.appendChild(p);
    return;
  }

  const table = document.createElement("table");

  for (const item of watchlist) {
    const tr = document.createElement("tr");

    const td = document.createElement("td");
    td.className = "link-cell";
    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.text = item.title;
    td.appendChild(link);
    tr.appendChild(td);

    const td2 = document.createElement("td");
    const button = document.createElement("button");
    button.className = "remove";
    button.title = "Remove this item from watchlist";
    button.textContent = "Remove";
    button.addEventListener("click", () => {
      chrome.storage.sync.get(["watchlist"], function (items) {
        const list = items["watchlist"];
        const newList = list.filter((elm: any) => elm.link != item.link);
        chrome.storage.sync.set({ watchlist: newList });
        tr.remove();
      });
    });
    td2.appendChild(button);
    tr.appendChild(td2);

    table.appendChild(tr);
  }

  elm.appendChild(table);
});
