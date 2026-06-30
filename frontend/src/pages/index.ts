import { initPageChrome } from "../shared/page-chrome.js";
import { fetchBackendStatus } from "../transport/client.js";

function main(): void {
  initPageChrome();
  checkBackendStatus();
}

main();

async function checkBackendStatus(): Promise<void> {
  try {
    const status = await fetchBackendStatus();
    // If the backend is configured, hide the setup banner
    if (status.configured) {
      document.getElementById("setup-banner")?.classList.add("hidden");
    }
  } catch {
    // Backend not running — keep the setup banner visible
  }
}
