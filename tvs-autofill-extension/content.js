window.addEventListener("message", (event) => {
  if (event.source !== window || event.data.type !== "AADHAAR_FILL") return;

  const rawText = event.data.payload;

  // Extract Name
  const nameMatch = rawText.match(/Name:\s*(.*)/i);
  const name = nameMatch?.[1]?.trim();

  const input = document.querySelector('input[name="likelyUser"]');
  if (input && name) {
    input.value = name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    console.log("Filled name:", name);
  } else {
    console.warn("Could not find the input or name");
  }
});
