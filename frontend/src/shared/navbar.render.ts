import { API_VERSION } from "../api/version.js";
import { fetchBackendStatus } from "../transport/client.js";

const INDEPTH_ITEMS = [
  {
    label: "Transcribe",
    file: "transcribe",
    path: "in-depth/transcribe.html",
  },
  {
    label: "Dictate",
    file: "dictate",
    path: "in-depth/dictate.html",
  },
];

export function renderNavbar(): void {
  const pathname = window.location.pathname;
  const isInDepth = pathname.includes("/in-depth/");
  const root = isInDepth ? "../" : "./";
  const currentFile =
    pathname.split("/").pop()?.replace(".html", "") ?? "index";

  const isDemoActive = currentFile === "demo";
  const isInDepthActive = isInDepth;

  function navLink(href: string, label: string, active: boolean): string {
    return `<a href="${href}" class="text-sm px-4 py-[1.1rem] border-b-2 transition-colors whitespace-nowrap ${active ? "border-primary-600 text-primary-600 font-medium" : "border-transparent text-grey-300 hover:text-grey-400"}">${label}</a>`;
  }

  const navElement = document.createElement("nav");
  navElement.className =
    "bg-white border-b border-grey-200 flex items-center justify-between sticky top-0 z-50 h-14";
  navElement.innerHTML = `
    <div class="flex items-center h-full">
      <a href="${root}index.html" class="font-semibold text-grey-400 px-6 flex items-center gap-2 h-full border-b-2 border-transparent hover:border-grey-200 transition-colors">
        <div class="w-5 h-5 bg-primary-600 rounded flex items-center justify-center shrink-0">
          <span class="text-white text-[10px] font-bold">N</span>
        </div>
        <span>Nabla Core API</span>
      </a>
      ${navLink(`${root}demo.html`, "Full Demo", isDemoActive)}
      <div class="relative h-full flex items-center" id="nav-indepth-wrap">
        <button id="nav-indepth-btn" class="text-sm px-4 h-full border-b-2 transition-colors flex items-center gap-1 ${isInDepthActive ? "border-primary-600 text-primary-600 font-medium" : "border-transparent text-grey-300 hover:text-grey-400"}">
          In-depth
          <svg class="w-3 h-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div id="nav-indepth-menu" class="absolute top-full left-0 bg-white border border-grey-200 rounded-xl shadow-lg py-1.5 w-52 hidden">
          ${INDEPTH_ITEMS.map(
            (item) => `
            <a href="${root}${item.path}" class="flex items-center px-4 py-2 text-sm transition-colors ${currentFile === item.file ? "bg-primary-50 text-primary-600 font-medium" : "text-grey-400 hover:bg-grey-50"}">
              ${item.label}
            </a>
          `,
          ).join("")}
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3 px-6">
      <span class="text-xs font-mono text-grey-250 bg-grey-50 border border-grey-200 px-2 py-1 rounded-md">v${API_VERSION}</span>
      <div id="nav-status" class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-grey-250"></div>
        <span class="text-xs text-grey-250">Checking…</span>
      </div>
      <a href="${root}onboarding.html" class="text-xs text-grey-300 hover:text-grey-400 px-3 py-1.5 rounded-lg border border-grey-200 hover:border-grey-250 transition-colors">
        Setup
      </a>
    </div>
  `;

  document.body.insertBefore(navElement, document.body.firstChild);

  const dropdownButton = document.getElementById("nav-indepth-btn")!;
  const dropdownMenu = document.getElementById("nav-indepth-menu")!;
  dropdownButton.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdownMenu.classList.toggle("hidden");
  });
  document.addEventListener("click", () =>
    dropdownMenu.classList.add("hidden"),
  );

  fetchBackendStatus()
    .then(({ configured }) => {
      const statusElement = document.getElementById("nav-status");
      if (!statusElement) {
        return;
      }
      if (configured) {
        statusElement.innerHTML =
          '<div class="w-2 h-2 rounded-full bg-success-300"></div><span class="text-xs text-grey-300">Ready</span>';
      } else {
        statusElement.innerHTML =
          '<div class="w-2 h-2 rounded-full bg-warning-300"></div><span class="text-xs text-grey-300">Not configured</span>';
      }
    })
    .catch(() => {
      const statusElement = document.getElementById("nav-status");
      if (statusElement) {
        statusElement.innerHTML =
          '<div class="w-2 h-2 rounded-full bg-error-200"></div><span class="text-xs text-grey-300">Backend offline</span>';
      }
    });
}
