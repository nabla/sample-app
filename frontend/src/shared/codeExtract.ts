export function extractRegion(source: string, region: string): string {
	const regionStartIndex = source.indexOf(`// #region ${region}`);
	if (regionStartIndex === -1) {
		return "";
	}
	const contentStartIndex = source.indexOf("\n", regionStartIndex) + 1;
	const regionEndIndex = source.indexOf(`// #endregion ${region}`);
	if (regionEndIndex === -1) {
		return "";
	}
	return source.slice(contentStartIndex, regionEndIndex).trimEnd();
}
