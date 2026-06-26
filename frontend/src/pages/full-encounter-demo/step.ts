// The lifecycle every demo step shares: render its own markup into a container, wire
// listeners that auto-detach on teardown, then clear the container when it leaves.
// This is the "each step owns its DOM" model, encoded once so every step is identical.

export interface StepContext {
	// The container the step renders into; controllers query within it to wire listeners.
	// (Render helpers look elements up globally by id — safe because only one step is
	// mounted at a time, so ids stay unique.)
	root: HTMLElement;
	// Wire every listener with { signal }: leaving the step aborts it, so they all detach.
	signal: AbortSignal;
}

export type StepTeardown = () => void;

export function mountStep(
	rootSelector: string,
	html: string,
	setup: (context: StepContext) => void,
): StepTeardown {
	const root = document.querySelector(rootSelector) as HTMLElement;
	root.innerHTML = html;
	const controller = new AbortController();
	setup({ root, signal: controller.signal });
	return () => {
		controller.abort(); // detaches every listener wired with this signal
		root.innerHTML = "";
	};
}

export function showError(error: unknown): void {
	alert(error instanceof Error ? error.message : String(error));
}
