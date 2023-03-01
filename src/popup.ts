import { Site } from "./types";

chrome.storage.sync.get(["watchlist"], function (items) {
  let watchlist = items["watchlist"]
  console.log(watchlist);
  let elm = document.querySelector(".list");
  
  for(const item of watchlist){
    const tr = document.createElement("tr");
    let td = document.createElement("td");
    let link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.text = item.title;
    td.appendChild(link);
    tr.appendChild(td);
    let td2 = document.createElement("td");
    let button = document.createElement("button");
    button.title = "Remove this item from watchlist";
    td2.appendChild(button);
    tr.appendChild(td2);
    button.textContent = "x";
    button.addEventListener("click", () =>{
      chrome.storage.sync.get(["watchlist"], function(items) {
        let list = items["watchlist"];
        let newList = list.filter((elm: any) => elm.link != item.link);
        chrome.storage.sync.set({ watchlist: newList });
        tr.remove();
      })
    })
    elm.appendChild(tr);
  }
  
});