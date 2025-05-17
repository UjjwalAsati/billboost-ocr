document.getElementById("fillButton").addEventListener("click", async () => {
  const text = document.getElementById("aadhaarText").value;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (data) => {
      window.postMessage({ type: "AADHAAR_FILL", payload: data }, "*");
    },
    args: [text],
  });
});
