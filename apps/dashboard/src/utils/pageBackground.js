const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function applyPageBackground(tree, color) {
  if (!HEX_COLOR.test(color)) throw new Error("Choose a valid six-digit hex color.");
  const visit = (node, isPage = false) => {
    // Change the page and block surfaces, preserving controls and card interiors.
    const surface = isPage || (tree.children?.includes(node) && node.type !== "button")
      || node.type === "section" || node.type === "container" || node.type === "columns";
    const styles = { ...(node.styles || {}) };
    if (surface) {
      for (const mode of ["base", "desktop", "laptop", "tablet", "mobile"]) {
        styles[mode] = { ...(styles[mode] || {}), background: color, backgroundColor: color, backgroundImage: "none" };
      }
    }
    return {
      ...node,
      ...(surface ? { styles } : {}),
      ...(!isPage && (surface || tree.children?.includes(node)) && node.type !== "button"
        ? { props: { ...node.props, design: { ...node.props?.design, background: color } } }
        : {}),
      ...(node.children ? { children: node.children.map((child) => visit(child)) } : {})
    };
  };
  return visit(tree, true);
}

export function connectedPageBackgroundPlan(context, color) {
  if (!HEX_COLOR.test(color)) throw new Error("Choose a valid six-digit hex color.");
  const page = context.currentPage || {};
  const ids = new Set(Object.entries(page.editableRegionDefinitions || {})
    .filter(([, definition]) => definition.type === "section").map(([id]) => id));
  Object.entries(page.editableRegionValues || {}).forEach(([id, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)
      && ("background" in value || "paddingY" in value)) ids.add(id);
  });
  if (!ids.size) throw new Error("This connected page has no editable sections. Add EditableSection wrappers to enable page background changes.");
  if (ids.size > 80) throw new Error("This page exceeds the 80-section edit limit.");
  return {
    title: "Change page background",
    operations: [...ids].map((id, index) => ({
      id: `page-background-${index}`, type: "update_region", targetId: id,
      destinationId: null, componentType: null,
      patches: [{ path: "value.background", valueJson: JSON.stringify(color) }]
    }))
  };
}
