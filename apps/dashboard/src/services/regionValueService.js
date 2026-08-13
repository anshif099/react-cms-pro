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
      const definition = definitions?.[regionId];
      const defaultValue = defaults[regionId];
      const hasBlankImageSource = definition?.type === "image" && (
        value === ""
        || (
          value
          && typeof value === "object"
          && !Array.isArray(value)
          && typeof value.src === "string"
          && !value.src.trim()
        )
      );
      const defaultImageSource = defaultValue
        && typeof defaultValue === "object"
        && !Array.isArray(defaultValue)
        && typeof defaultValue.src === "string"
        && defaultValue.src.trim();

      if (hasBlankImageSource && defaultImageSource) {
        repaired[regionId] = {
          ...defaultValue,
          ...(value && typeof value === "object" && !Array.isArray(value) ? value : {}),
          src: defaultImageSource
        };
        changed = true;
      } else {
        repaired[regionId] = value;
      }
      return;
    }

    changed = true;
    if (Object.prototype.hasOwnProperty.call(defaults, regionId)) {
      repaired[regionId] = defaults[regionId];
    }
  });

  return { changed, regions: repaired };
}
