
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
  }
  elm.appendChild(myList);
});