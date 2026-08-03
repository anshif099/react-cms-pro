import argparse
import json
import random
from pathlib import Path


COMPONENTS = [
    "hero", "features", "heading", "text", "button", "image", "cards",
    "pricing", "testimonials", "faq", "stats", "gallery", "team", "cta",
    "contact", "newsletter", "divider", "spacer",
]
THEMES = [
    ("premium", "#7c3aed", "#0b1020"),
    ("minimal", "#111827", "#ffffff"),
    ("futuristic", "#22d3ee", "#050816"),
    ("luxury", "#c9a227", "#090909"),
    ("corporate", "#2563eb", "#f8fafc"),
]
INTENTS = [
    "Make this homepage {theme} and improve conversions",
    "Redesign the full page with a {theme} visual system",
    "Improve mobile spacing, readability, accessibility, and SEO",
    "Add pricing, testimonials, FAQ, and a stronger final CTA",
    "Make the page feel more trustworthy while preserving the brand",
]


def operation(operation_id, operation_type, summary, reason, **values):
    return {
        "id": operation_id,
        "type": operation_type,
        "summary": summary,
        "reason": reason,
        "targetId": values.get("targetId"),
        "destinationId": values.get("destinationId"),
        "position": values.get("position"),
        "componentType": values.get("componentType"),
        "patches": values.get("patches", []),
    }


def patch(path, value):
    return {"path": path, "valueJson": json.dumps(value, separators=(",", ":"))}


def make_example(index, rng):
    theme_name, primary, background = rng.choice(THEMES)
    existing = ["hero", *rng.sample(COMPONENTS[1:7], rng.randint(2, 5))]
    nodes = [{
        "id": f"{component}-{position + 1}",
        "type": component,
        "label": component.title(),
        "props": {"locales": {"en": {"title": f"Current {component} content"}}},
        "styles": {"base": {}, "mobile": {}},
        "children": [],
    } for position, component in enumerate(existing)]
    intent = rng.choice(INTENTS).format(theme=theme_name)
    operations = [
        operation(
            "theme-colors",
            "update_theme",
            f"Apply a {theme_name} color system",
            "Create consistent hierarchy and contrast.",
            patches=[patch("colors.primary", primary), patch("colors.background", background)],
        ),
        operation(
            "hero-copy",
            "update_component",
            "Strengthen the hero message",
            "Clarify the value proposition and conversion path.",
            targetId=nodes[0]["id"],
            patches=[
                patch("props.locales.en.title", f"A clearer {theme_name} value proposition"),
                patch("styles.mobile.padding", "24px"),
            ],
        ),
        operation(
            "seo",
            "update_page",
            "Improve search metadata",
            "Make the page easier to understand in search results.",
            patches=[
                patch("seo.metaTitle", f"{theme_name.title()} digital platform"),
                patch("seo.metaDescription", "A clear, accessible page built for customer action."),
            ],
        ),
    ]
    previous_id = nodes[-1]["id"]
    for component in rng.sample(["pricing", "testimonials", "faq", "cta"], rng.randint(1, 3)):
        operation_id = f"insert-{component}"
        operations.append(operation(
            operation_id,
            "insert_component",
            f"Add a {component} section",
            "Complete the page narrative with a reusable responsive component.",
            targetId=previous_id,
            position="after",
            componentType=component,
            patches=[patch("label", component.title()), patch("styles.mobile.padding", "20px")],
        ))
        previous_id = f"$op:{operation_id}"
    context = {
        "capabilities": [
            "insert_component", "update_component", "remove_component",
            "move_component", "duplicate_component", "update_theme", "update_page",
        ],
        "currentPage": {
            "id": f"page-{index}",
            "pageKey": "home",
            "locale": "en",
            "settings": {"title": "Home", "route": "/", "seo": {}},
            "componentTree": {"id": "home", "type": "page", "children": nodes},
        },
        "designSystem": {
            "theme": {"colors": {"primary": "#2563eb", "background": "#ffffff"}},
            "registeredComponentTypes": COMPONENTS,
        },
        "websiteMemory": {
            "brandVoice": rng.choice(["clear", "confident", "friendly", "technical"]),
            "targetAudience": rng.choice(["startups", "agencies", "local businesses", "SaaS teams"]),
        },
    }
    scenario = index % 6
    if scenario == 0:
        intent += ". Remove the redundant final section."
        operations.append(operation(
            "remove-redundant",
            "remove_component",
            "Remove a redundant section",
            "Reduce clutter requested by the user.",
            targetId=nodes[-1]["id"],
        ))
    elif scenario == 1:
        intent += ". Move the strongest supporting section directly after the hero."
        operations.append(operation(
            "reorder-flow",
            "move_component",
            "Improve the narrative order",
            "Place supporting information earlier in the reading flow.",
            targetId=nodes[-1]["id"],
            destinationId=nodes[0]["id"],
            position="after",
        ))
    elif scenario == 2:
        intent += ". Duplicate the strongest card section for a second content group."
        operations.append(operation(
            "duplicate-section",
            "duplicate_component",
            "Duplicate a reusable section",
            "Create a second group while retaining consistent structure.",
            targetId=nodes[-1]["id"],
        ))
    elif scenario == 3:
        intent += ". Rewrite the connected announcement editable region."
        context["capabilities"].append("update_region")
        context["currentPage"]["editableRegionValues"] = {
            "home.announcement": {"text": "Old announcement"}
        }
        operations.append(operation(
            "announcement-copy",
            "update_region",
            "Rewrite the announcement",
            "Make the connected content concise and useful.",
            targetId="home.announcement",
            patches=[patch("value.text", "A clearer announcement for customers")],
        ))
    elif scenario == 4:
        intent += ". Create a reusable trust badge source component."
        context["capabilities"].extend(["create_source_file", "replace_source_file"])
        context["sourceProject"] = {
            "entryFile": "src/pages/Home.jsx",
            "files": {"src/pages/Home.jsx": "export default function Home(){return <main />;}"},
        }
        operations.append(operation(
            "create-trust-badges",
            "create_source_file",
            "Create a trust badge component",
            "Add a reusable source component to the connected project.",
            targetId="src/components/TrustBadges.jsx",
            patches=[patch(
                "content",
                "export default function TrustBadges(){return <section aria-label=\"Customer trust\">Trusted by growing teams</section>;}",
            )],
        ))
    else:
        intent += ". Replace the small connected page source with an accessible page shell."
        context["capabilities"].extend(["create_source_file", "replace_source_file"])
        context["sourceProject"] = {
            "entryFile": "src/pages/Home.jsx",
            "files": {"src/pages/Home.jsx": "export default function Home(){return <main />;}"},
        }
        operations.append(operation(
            "replace-home-source",
            "replace_source_file",
            "Replace the connected page source",
            "Implement the explicitly requested accessible source shell.",
            targetId="src/pages/Home.jsx",
            patches=[patch(
                "content",
                "export default function Home(){return <main><h1>Clear customer value</h1><p>Built for accessible growth.</p></main>;}",
            )],
        ))
    plan = {
        "title": f"Build a {theme_name} homepage",
        "summary": "Coordinate design, content, responsive, conversion, and SEO improvements.",
        "assistantMessage": "Rocket AI prepared a complete page plan for approval.",
        "risk": "medium",
        "estimatedEdits": len(operations),
        "requiresApproval": True,
        "affectedAreas": ["Hero", "Theme", "Content", "Mobile", "SEO"],
        "preserved": ["Header", "Footer", "Navigation", "Brand assets"],
        "validationChecks": ["One H1", "WCAG contrast", "Mobile stacking", "CTA clarity"],
        "operations": operations,
    }
    return {"input": {"request": intent, "editableContext": context}, "plan": plan}


def main():
    parser = argparse.ArgumentParser(description="Create Rocket AI's initial ReactCMS curriculum")
    parser.add_argument("--output", default="rocket_ai/data/bootstrap.jsonl")
    parser.add_argument("--examples", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    rng = random.Random(args.seed)
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for index in range(args.examples):
            handle.write(json.dumps(make_example(index, rng), ensure_ascii=False) + "\n")
    print(f"Wrote {args.examples:,} Rocket AI training examples to {path}")


if __name__ == "__main__":
    main()
