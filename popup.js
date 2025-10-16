document.getElementById("btn_rewrite_text").addEventListener("click", async () => {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // send message to content script
  chrome.tabs.sendMessage(tab.id, { type: "INIT_NE" });
});
