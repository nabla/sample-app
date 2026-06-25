// Renders the "Code" tab from snippets pulled out of the real source files, so
// what's shown can never drift from what actually runs. Shared by the in-depth pages.
export function renderCodeSnippets(
	snippets: {
		title: string;
		label: string;
		code: string;
	}[],
): void {
	const container = document.getElementById("code-sections");
	if (!container) {
		return;
	}
	container.innerHTML = snippets
		.map(
			(snippet) => `
    <div>
      <div class="flex items-center gap-3 mb-3">
        <span class="text-sm font-semibold text-grey-400">${snippet.title}</span>
        <span class="text-xs text-grey-250 bg-grey-100 px-2 py-0.5 rounded font-mono">${snippet.label}</span>
      </div>
      <pre class="bg-grey-400 text-grey-200 rounded-xl p-5 font-mono text-xs leading-relaxed overflow-x-auto"><code>${highlight(snippet.code)}</code></pre>
    </div>
  `,
		)
		.join("");
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

// A tiny, dependency-free TypeScript highlighter. Not a real parser — it tokenizes
// in one pass (so each character is coloured at most once) and is good enough for
// read-only snippets. Order matters: comments and strings win over everything else.
const SYNTAX = new RegExp(
	[
		/(\/\/[^\n]*)/.source, // 1 comment
		/(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/.source, // 2 string
		/(\b\d[\d_]*(?:\.\d+)?\b)/.source, // 3 number
		/\b(const|let|var|function|return|await|async|new|if|else|for|of|in|import|from|export|type|interface|class|extends|implements|throw|try|catch|finally|while|break|continue|switch|case|default|typeof|instanceof|as|void|null|undefined|true|false|this)\b/
			.source, // 4 keyword
		/([A-Za-z_$][\w$]*)(?=\s*:)/.source, // 5 property key
	].join("|"),
	"g",
);

function highlight(code: string): string {
	let highlighted = "";
	let lastIndex = 0;
	for (const match of code.matchAll(SYNTAX)) {
		const matchStart = match.index;
		highlighted += escapeHtml(code.slice(lastIndex, matchStart));
		highlighted += `<span class="${colorFor(match)}">${escapeHtml(match[0])}</span>`;
		lastIndex = matchStart + match[0].length;
	}
	return highlighted + escapeHtml(code.slice(lastIndex));
}

function colorFor(match: RegExpExecArray | RegExpMatchArray): string {
	if (match[1]) {
		return "text-grey-300"; // comment
	}
	if (match[2]) {
		return "text-amber-300"; // string
	}
	if (match[3]) {
		return "text-purple-400"; // number
	}
	if (match[4]) {
		return "text-primary-400"; // keyword
	}
	return "text-emerald-400"; // property key
}
