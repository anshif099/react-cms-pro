export function didAreaSelectionComplete({
  startKey = "",
  currentKey = "",
  startVersion,
  currentVersion
}) {
  if (
    Number.isFinite(startVersion)
    && Number.isFinite(currentVersion)
    && currentVersion !== startVersion
  ) {
    return true;
  }

  return Boolean(currentKey && currentKey !== startKey);
}
