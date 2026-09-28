// Imported and starter collections may have missing or duplicated IDs.
// Give every row a distinct identity before editing, deleting, or sorting it.
export function ensureArrayItemIds(items) {
  const reserved = new Set(items.map((item) => item.id).filter(Boolean));
  const seen = new Set();
  return items.map((item, index) => {
    let id = item.id;
    if (!id || seen.has(id)) {
      id = `rcms-item-${index}`;
      while (reserved.has(id) || seen.has(id)) id += '-';
    }
    seen.add(id);
    return id === item.id ? item : { ...item, id };
  });
}
