const SERIALIZATION_PLACEHOLDERS = new Set([
  "[circular]",
  "[context depth limit]"
]);

export function isSerializedRegionPlaceholder(value) {
  return typeof value === "string"
    && SERIALIZATION_PLACEHOLDERS.has(value.trim().toLowerCase());
}

export function regionDefaultsFromDefinitions(definitions = {}) {
  return Object.fromEntries(
    Object.entries(definitions || {}).flatMap(([regionId, definition]) => {
      if (
        !definition
        || typeof definition !== "object"
        || !Object.prototype.hasOwnProperty.call(definition, "defaultValue")
      ) {
        return [];
      }
      return [[regionId, definition.defaultValue]];
    })
  );
}

export function repairSerializedRegionValues(regions = {}, definitions = {}) {
  const defaults = regionDefaultsFromDefinitions(definitions);
  const repaired = {};
  let changed = false;

  Object.entries(regions || {}).forEach(([regionId, value]) => {
    if (!isSerializedRegionPlaceholder(value)) {
      repaired[regionId] = value;
      return;
    }

    changed = true;
    if (Object.prototype.hasOwnProperty.call(defaults, regionId)) {
      repaired[regionId] = defaults[regionId];
    }
  });

  return { changed, regions: repaired };
}
