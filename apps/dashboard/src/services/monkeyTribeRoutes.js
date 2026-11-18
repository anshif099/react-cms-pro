export function isMonkeyTribeWebsite(website) {
  try {
    return ["monkeytribe.in", "www.monkeytribe.in"].includes(new URL(website?.domain).hostname);
  } catch {
    return false;
  }
}

export function monkeyTribePublicRoutes(sourceProvider) {
  return [
    ["promptx", "PromptX"],
    ["growthx", "GrowthX"],
    ["brandx", "BrandX"],
    ["copycraft", "CopyCraft"],
    ["about", "About"],
    ["webinars", "Webinars"],
    ["register", "Register"],
    ["ai-integrated-digital-marketing", "AI Integrated Digital Marketing"],
    ["ai-prompt-engineering-guide", "AI Prompt Engineering Guide"],
    ["career-opportunities-in-ai-era", "Career Opportunities in the AI Era"]
  ].map(([slug, title]) => ({
    id: slug, slug, title, path: `/${slug}`, sourceFile: "index.html", sourceProvider
  }));
}
