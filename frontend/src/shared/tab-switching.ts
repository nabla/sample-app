export function initTabSwitching(): void {
	document.querySelectorAll("[data-tabs]").forEach((tabBar) => {
		const group = tabBar.getAttribute("data-tabs")!;
		const buttons = tabBar.querySelectorAll<HTMLButtonElement>("[data-tab]");
		const panels = document.querySelectorAll<HTMLElement>(
			`[data-tab-panel="${group}"][data-tab-content]`,
		);

		function activate(tab: string): void {
			buttons.forEach((button) => {
				const isActive = button.getAttribute("data-tab") === tab;
				button.className = isActive
					? "text-sm px-4 py-3 border-b-2 border-primary-600 text-primary-600 font-medium transition-colors"
					: "text-sm px-4 py-3 border-b-2 border-transparent text-grey-300 transition-colors";
			});
			panels.forEach((panel) => {
				panel.classList.toggle(
					"hidden",
					panel.getAttribute("data-tab-content") !== tab,
				);
			});
		}

		buttons.forEach((button) => {
			button.addEventListener("click", () =>
				activate(button.getAttribute("data-tab")!),
			);
		});

		const firstTab = buttons[0]?.getAttribute("data-tab");
		if (firstTab) {
			activate(firstTab);
		}
	});
}
