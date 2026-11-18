export function createCoursePageTree({ title, slug }) {
  const node = (id, type, props, styles = {}, children = []) => ({
    id, type, props, styles: { base: styles }, children
  });
  const heading = (id, text, level = "h2") => node(id, "heading", {
    level, locales: { en: { text } }
  }, { color: "#ffffff", marginBottom: "16px" });
  const paragraph = (id, text) => node(id, "paragraph", {
    locales: { en: { text } }
  }, { color: "#ddd8f2", marginBottom: "20px" });
  const button = (id, label, url, linkType = "url") => node(id, "button", {
    url, linkType, locales: { en: { label } }
  }, { backgroundColor: "#ffce16", color: "#171023" });
  const section = (id, background, children) => node(id, "section", { anchorId: id }, {
    backgroundColor: background,
    padding: "clamp(32px, 7vw, 96px) clamp(20px, 8vw, 112px)"
  }, children);

  return {
    id: slug,
    type: "page",
    version: 2,
    title,
    locale: "en",
    children: [
      section("course-overview", "#211748", [
        paragraph("course-eyebrow", "MONKEY TRIBE · COURSE"),
        heading("course-title", title, "h1"),
        paragraph("course-intro", "Describe what learners will achieve and who this course is for."),
        button("course-view-curriculum", "Explore curriculum", "course-curriculum", "section")
      ]),
      section("course-skills", "#100d25", [
        heading("course-skills-title", "What you’ll learn"),
        paragraph("course-skills-intro", "List the practical skills learners will take away."),
        heading("course-skill-one", "Core skills", "h3"),
        paragraph("course-skill-one-description", "Describe the techniques learners will practise."),
        heading("course-skill-two", "Real-world projects", "h3"),
        paragraph("course-skill-two-description", "Describe a project learners will build.")
      ]),
      section("course-curriculum", "#211748", [
        heading("course-curriculum-title", "Course curriculum"),
        node("course-modules", "accordion", {
          locales: { en: {
            title: "Modules",
            items: [
              { id: "foundations", title: "Module 1 · Foundations", content: "Outline the introductory lessons." },
              { id: "practice", title: "Module 2 · Practical application", content: "Outline the activities and final project." }
            ]
          } }
        })
      ]),
      section("course-enrolment", "#100d25", [
        heading("course-enrol-title", "Ready to enrol?"),
        paragraph("course-enrol-details", "Add the schedule, delivery format, and enrolment details."),
        button("course-register", "Register now", "/register")
      ])
    ]
  };
}
