import BLOCK_SCHEMAS from "../components/blocks/blockSchemas";

function generateBlock(type, customFields = {}) {
  const schema = BLOCK_SCHEMAS.find(s => s.type === type);
  if (!schema) return null;

  const block = {
    id: Math.random().toString(36).substring(2, 9),
    type,
    locales: {
      en: {}
    }
  };

  schema.fields.forEach(field => {
    let val = "";
    if (field.type === "number") val = 0;
    if (field.type === "boolean") val = false;
    if (field.type === "array") val = [];

    // Apply custom default values if provided
    if (customFields[field.key] !== undefined) {
      val = customFields[field.key];
    }

    if (field.localized) {
      block.locales.en[field.key] = val;
    } else {
      block[field.key] = val;
    }
  });

  return block;
}

export const pageConversionService = {
  getRouteBlocks(route) {
    const cleanRoute = (route || "/").trim().toLowerCase();

    if (cleanRoute === "/" || cleanRoute === "/home" || cleanRoute === "") {
      return [
        generateBlock("hero", {
          title: "Welcome to our Website",
          subtitle: "We deliver exceptional modern digital experiences that engage and convert users.",
          buttonText: "Get Started Now",
          buttonUrl: "/contact"
        }),
        generateBlock("features", {
          title: "Why Choose Us",
          subtitle: "Key advantages that set our solutions apart.",
          items: [
            { id: "f1", icon: "Zap", title: "Lightning Fast", description: "Optimized for maximum speed and SEO performance." },
            { id: "f2", icon: "Shield", title: "Secure by Design", description: "Built with industry-leading security practices." },
            { id: "f3", icon: "Sliders", title: "Fully Customisable", description: "Easily manage components without modifying code." }
          ]
        }),
        generateBlock("cta", {
          title: "Ready to transform your business?",
          subtitle: "Start working with our team today and take your operations to the next level.",
          primaryButtonText: "Contact Us",
          primaryButtonUrl: "/contact",
          secondaryButtonText: "View Pricing",
          secondaryButtonUrl: "/pricing"
        }),
        generateBlock("footer", {
          copyright: "© 2026 ReactCMS Pro. All rights reserved."
        })
      ].filter(Boolean);
    }

    if (cleanRoute.startsWith("/about")) {
      return [
        generateBlock("heading", {
          text: "About Our Company",
          level: "h1",
          alignment: "center"
        }),
        generateBlock("paragraph", {
          text: "<p>We are a dedicated team of designers, engineers, and creators building the future of web content management.</p>"
        }),
        generateBlock("team", {
          title: "Meet the Team",
          subtitle: "The brilliant minds behind our operations.",
          members: [
            { id: "t1", name: "John Doe", role: "CEO & Founder", bio: "Tech visionary and design enthusiast." },
            { id: "t2", name: "Jane Smith", role: "Lead Engineer", bio: "Expert developer and open-source contributor." }
          ]
        })
      ].filter(Boolean);
    }

    if (cleanRoute.startsWith("/contact")) {
      return [
        generateBlock("heading", {
          text: "Get in Touch",
          level: "h1",
          alignment: "center"
        }),
        generateBlock("contact", {
          title: "Contact Form",
          subtitle: "Drop us a line and our support team will get back to you within 24 hours.",
          submitText: "Send Message",
          email: "support@example.com",
          fields: [
            { id: "c1", name: "name", placeholder: "Your name", required: true },
            { id: "c2", name: "email", placeholder: "Your email", required: true },
            { id: "c3", name: "message", placeholder: "How can we help?", required: true }
          ]
        })
      ].filter(Boolean);
    }

    if (cleanRoute.startsWith("/pricing")) {
      return [
        generateBlock("heading", {
          text: "Flexible Pricing Plans",
          level: "h1",
          alignment: "center"
        }),
        generateBlock("pricing", {
          title: "Pricing Structures",
          subtitle: "Select the plan that matches your business needs.",
          plans: [
            { id: "p1", name: "Starter", price: 19, period: "month", features: "1 Website, Core Blocks, Basic SEO support", buttonText: "Select Plan", highlighted: false },
            { id: "p2", name: "Pro", price: 49, period: "month", features: "5 Websites, Advanced Analytics, Visual Sync Editor", buttonText: "Select Plan", highlighted: true }
          ]
        })
      ].filter(Boolean);
    }

    if (cleanRoute.startsWith("/blog") || cleanRoute.startsWith("/post")) {
      return [
        generateBlock("heading", {
          text: "Our Blog Posts",
          level: "h1",
          alignment: "center"
        }),
        generateBlock("cards", {
          title: "Recent Articles",
          subtitle: "Stay updated with our latest industry news and strategies.",
          cards: [
            { id: "b1", title: "Launching ReactCMS Pro v2.5", description: "Read about the new manifest sync engine and live device workstation.", buttonText: "Read Article", buttonUrl: "/blog/launching-v2.5" },
            { id: "b2", title: "Optimizing Web Performance", description: "Top 10 tips to speed up React page rendering speeds.", buttonText: "Read Article", buttonUrl: "/blog/optimizing-performance" }
          ]
        })
      ].filter(Boolean);
    }

    // Default Fallback
    return [
      generateBlock("heading", {
        text: "New Page Section",
        level: "h1",
        alignment: "center"
      }),
      generateBlock("paragraph", {
        text: "<p>Start customizing your newly created CMS section blocks using the visual editor.</p>"
      }),
      generateBlock("cta", {
        title: "Have any questions?",
        subtitle: "Check out the visual guide documents to get started.",
        primaryButtonText: "View Documentation",
        primaryButtonUrl: "/docs"
      })
    ].filter(Boolean);
  },

  getTemplateBlocks(templateKey) {
    switch (templateKey) {
      case "landing":
        return this.getRouteBlocks("/");
      case "blog":
        return this.getRouteBlocks("/blog");
      case "contact":
        return this.getRouteBlocks("/contact");
      case "pricing":
        return this.getRouteBlocks("/pricing");
      case "portfolio":
        return [
          generateBlock("heading", { text: "Our Portfolio", level: "h1", alignment: "center" }),
          generateBlock("gallery", {
            columns: "3",
            gap: 16,
            images: [
              { id: "g1", src: "", alt: "Project 1", caption: "App Mockup" },
              { id: "g2", src: "", alt: "Project 2", caption: "Dashboard UI" },
              { id: "g3", src: "", alt: "Project 3", caption: "Mobile Client App" }
            ]
          })
        ].filter(Boolean);
      case "documentation":
        return [
          generateBlock("heading", { text: "Documentation", level: "h1", alignment: "left" }),
          generateBlock("paragraph", { text: "<h3>Introduction</h3><p>Welcome to our tech documents. Follow the modules to connect your application SDK.</p>" }),
          generateBlock("faq", {
            title: "Frequently Asked Questions",
            items: [
              { id: "q1", question: "How do I install the SDK?", answer: "Run npm install @anshif.rainhopes/reactcms-sdk in your terminal." },
              { id: "q2", question: "Can I manage multiple locales?", answer: "Yes, you can configure translations directly inside the editor panels." }
            ]
          })
        ].filter(Boolean);
      case "blank":
      default:
        return [];
    }
  }
};

export default pageConversionService;
