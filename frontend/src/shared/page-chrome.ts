import { renderNavbar } from "./navbar.render.js";
import { initTabSwitching } from "./tab-switching.js";

// Shared per-page bootstrap: every page's main() calls this to render the top
// navbar and wire up tab switching.
export function initPageChrome(): void {
	renderNavbar();
	initTabSwitching();
}
