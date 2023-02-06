import { Site } from "./types";

chrome.storage.sync.get(["watchlist"], function (items) {
  let watchlist = items["watchlist"]
  console.log(watchlist);
  let elm = document.getElementById("list");
  const myList = document.createElement("ul");
  for(const item of watchlist){
    let li = document.createElement("li");
    let link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.text = item.title;
    li.appendChild(link);
    myList.appendChild(li);
    let button = document.createElement("button");
    li.appendChild(button)
    button.textContent = "x";
    button.addEventListener("click", () =>{
      chrome.storage.sync.get(["watchlist"], function(items) {
        let list = items["watchlist"];
        let newList = list.filter((elm: any) => elm.link != item.link);
        chrome.storage.sync.set({ watchlist: newList });
        li.remove();
      })
    })
  }
  elm.appendChild(myList);
});