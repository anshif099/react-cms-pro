export const BLOCK_SCHEMAS = [
  {
    type: "hero",
    label: "Hero Section",
    icon: "Layers",
    category: "layout",
    description: "Full-width header section with titles, image backgrounds, and button links.",
    fields: [
      { key: "title", label: "Hero Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtitle Text", type: "textarea", localized: true },
      { key: "buttonText", label: "CTA Button Text", type: "text", localized: true },
      { key: "buttonUrl", label: "CTA Link URL", type: "url", localized: false },
      { key: "image", label: "Background Image", type: "image", localized: false },
      { key: "overlayOpacity", label: "Overlay Opacity (0-1)", type: "number", localized: false }
    ]
  },
  {
    type: "heading",
    label: "Heading Tag",
    icon: "Type",
    category: "content",
    description: "Rich text heading titles (H1 - H6) with custom align and color settings.",
    fields: [
      { key: "text", label: "Heading Text", type: "text", localized: true },
      { 
        key: "level", 
        label: "Tag Level", 
        type: "select", 
        localized: false,
        options: [
          { value: "h1", label: "Heading 1 (Main Title)" },
          { value: "h2", label: "Heading 2" },
          { value: "h3", label: "Heading 3" },
          { value: "h4", label: "Heading 4" },
          { value: "h5", label: "Heading 5" },
          { value: "h6", label: "Heading 6" }
        ]
      },
      { 
        key: "alignment", 
        label: "Text Alignment", 
        type: "select", 
        localized: false,
        options: [
          { value: "left", label: "Align Left" },
          { value: "center", label: "Align Center" },
          { value: "right", label: "Align Right" }
        ]
      },
      { key: "color", label: "Text Color", type: "color", localized: false }
    ]
  },
  {
    type: "paragraph",
    label: "Paragraph Text",
    icon: "AlignLeft",
    category: "content",
    description: "Standard body descriptions with full rich-text editor layouts.",
    fields: [
      { key: "text", label: "Body Copy", type: "richtext", localized: true },
      { 
        key: "alignment", 
        label: "Alignment", 
        type: "select", 
        localized: false,
        options: [
          { value: "left", label: "Align Left" },
          { value: "center", label: "Align Center" },
          { value: "right", label: "Align Right" },
          { value: "justify", label: "Justify" }
        ]
      }
    ]
  },
  {
    type: "image",
    label: "Image Frame",
    icon: "Image",
    category: "content",
    description: "Single image media container with alt text, width, and captions.",
    fields: [
      { key: "src", label: "Image Asset", type: "image", localized: false },
      { key: "alt", label: "Alternative Alt Text", type: "text", localized: true },
      { key: "caption", label: "Image Caption Text", type: "text", localized: true },
      { key: "width", label: "Custom Width (e.g. 100%, 300px)", type: "text", localized: false },
      { key: "linkUrl", label: "Click Link Redirect URL", type: "url", localized: false }
    ]
  },
  {
    type: "gallery",
    label: "Media Gallery",
    icon: "Grid",
    category: "content",
    description: "Grid gallery of multiple upload assets with dynamic column settings.",
    fields: [
      { 
        key: "images", 
        label: "Gallery Image Collection", 
        type: "array", 
        localized: false,
        fields: [
          { key: "src", label: "Image URL", type: "image" },
          { key: "alt", label: "Alt Label", type: "text" },
          { key: "caption", label: "Caption", type: "text" }
        ]
      },
      { 
        key: "columns", 
        label: "Grid Columns Count", 
        type: "select", 
        localized: false,
        options: [
          { value: "2", label: "2 Columns" },
          { value: "3", label: "3 Columns" },
          { value: "4", label: "4 Columns" }
        ]
      },
      { key: "gap", label: "Item Spacing (Gap px)", type: "number", localized: false }
    ]
  },
  {
    type: "features",
    label: "Features List",
    icon: "Star",
    category: "commerce",
    description: "Product feature cards complete with Lucide icon codes.",
    fields: [
      { key: "title", label: "Feature Section Header", type: "text", localized: true },
      { key: "subtitle", label: "Subtext Description", type: "textarea", localized: true },
      { 
        key: "items", 
        label: "Feature Columns", 
        type: "array", 
        localized: true,
        fields: [
          { key: "icon", label: "Lucide Icon Code", type: "text" },
          { key: "title", label: "Feature Title", type: "text" },
          { key: "description", label: "Description text", type: "textarea" }
        ]
      }
    ]
  },
  {
    type: "cards",
    label: "Info Cards",
    icon: "LayoutGrid",
    category: "commerce",
    description: "Grid listing cards with custom redirection buttons.",
    fields: [
      { key: "title", label: "Cards Header Title", type: "text", localized: true },
      { key: "subtitle", label: "Cards Tagline Subtext", type: "textarea", localized: true },
      { 
        key: "cards", 
        label: "Display Cards", 
        type: "array", 
        localized: true,
        fields: [
          { key: "image", label: "Card Image URL", type: "image" },
          { key: "title", label: "Card Title", type: "text" },
          { key: "description", label: "Card Body Copy", type: "textarea" },
          { key: "buttonText", label: "Button Label Text", type: "text" },
          { key: "buttonUrl", label: "Redirect Link", type: "url" }
        ]
      }
    ]
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: "MessageSquare",
    category: "social",
    description: "Customer review carousels showing comments, roles, and star ratings.",
    fields: [
      { 
        key: "items", 
        label: "Customer Reviews", 
        type: "array", 
        localized: true,
        fields: [
          { key: "name", label: "Customer Full Name", type: "text" },
          { key: "role", label: "Position/Company Name", type: "text" },
          { key: "quote", label: "Review Description Text", type: "textarea" },
          { key: "avatar", label: "Profile Picture URL", type: "image" },
          { key: "rating", label: "Rating Stars (1-5)", type: "number" }
        ]
      }
    ]
  },
  {
    type: "faq",
    label: "FAQ Accordion",
    icon: "HelpCircle",
    category: "social",
    description: "Collapsible questions and answers listings.",
    fields: [
      { key: "title", label: "Accordion Main Header", type: "text", localized: true },
      { 
        key: "items", 
        label: "Question Logs", 
        type: "array", 
        localized: true,
        fields: [
          { key: "question", label: "FAQ Question Label", type: "text" },
          { key: "answer", label: "FAQ Answer Content Text", type: "textarea" }
        ]
      }
    ]
  },
  {
    type: "cta",
    label: "CTA Banner",
    icon: "MousePointerClick",
    category: "social",
    description: "Call to action banners with custom background colors and button pairs.",
    fields: [
      { key: "title", label: "CTA Banner Title", type: "text", localized: true },
      { key: "subtitle", label: "Subtext Description Info", type: "textarea", localized: true },
      { key: "primaryButtonText", label: "Main Button Label", type: "text", localized: true },
      { key: "primaryButtonUrl", label: "Main Button Redirect", type: "url", localized: false },
      { key: "secondaryButtonText", label: "Secondary Button Label", type: "text", localized: true },
      { key: "secondaryButtonUrl", label: "Secondary Button Redirect", type: "url", localized: false },
      { key: "background", label: "Banner Background Color", type: "color", localized: false }
    ]
  },
  {
    type: "pricing",
    label: "Pricing Grid",
    icon: "CreditCard",
    category: "commerce",
    description: "Product pricing structures and feature listings.",
    fields: [
      { key: "title", label: "Pricing Section Header", type: "text", localized: true },
      { key: "subtitle", label: "Section Subheading Text", type: "textarea", localized: true },
      { 
        key: "plans", 
        label: "Pricing Tiers", 
        type: "array", 
        localized: true,
        fields: [
          { key: "name", label: "Plan Tier Title (e.g. Basic)", type: "text" },
          { key: "price", label: "Plan Monthly Cost ($)", type: "number" },
          { key: "period", label: "Billing Cycle (e.g. month)", type: "text" },
          { key: "features", label: "Plan Features (comma split)", type: "textarea" },
          { key: "buttonText", label: "Plan Action Button Label", type: "text" },
          { key: "highlighted", label: "Mark Plan as Highlighted", type: "boolean" }
        ]
      }
    ]
  },
  {
    type: "team",
    label: "Team Profiles",
    icon: "Users",
    category: "social",
    description: "Grid layout of profiles complete with names, roles, and bios.",
    fields: [
      { key: "title", label: "Team Main Header", type: "text", localized: true },
      { key: "subtitle", label: "Team Subheading text", type: "textarea", localized: true },
      { 
        key: "members", 
        label: "Team Members Collection", 
        type: "array", 
        localized: true,
        fields: [
          { key: "name", label: "Full Name", type: "text" },
          { key: "role", label: "Position Role Title", type: "text" },
          { key: "bio", label: "Member Biography Summary", type: "textarea" },
          { key: "avatar", label: "Profile Picture URL", type: "image" }
        ]
      }
    ]
  },
  {
    type: "contact",
    label: "Contact Form Schema",
    icon: "Mail",
    category: "social",
    description: "Custom contact form schemas complete with placeholder values.",
    fields: [
      { key: "title", label: "Contact Header Title", type: "text", localized: true },
      { key: "subtitle", label: "Form Instruction Subtext", type: "textarea", localized: true },
      { key: "submitText", label: "Submit Button Label", type: "text", localized: true },
      { key: "email", label: "Destination Notification Email", type: "text", localized: false },
      { 
        key: "fields", 
        label: "Contact Inputs Schema", 
        type: "array", 
        localized: false,
        fields: [
          { key: "name", label: "Field Technical Key (ID)", type: "text" },
          { key: "placeholder", label: "Input Placeholder Label", type: "text" },
          { key: "required", label: "Is Field Required", type: "boolean" }
        ]
      }
    ]
  },
  {
    type: "footer",
    label: "Footer Layout",
    icon: "Menu",
    category: "social",
    description: "Footer branding section containing logos and copyright texts.",
    fields: [
      { key: "copyright", label: "Footer Copyright text", type: "text", localized: true },
      { key: "logo", label: "Footer Logo Asset", type: "image", localized: false }
    ]
  },
  {
    type: "spacer",
    label: "Vertical Spacer",
    icon: "MoveVertical",
    category: "layout",
    description: "Add clean vertical margins between sections.",
    fields: [
      { key: "height", label: "Spacer Height (px)", type: "number", localized: false }
    ]
  },
  {
    type: "divider",
    label: "Divider Line",
    icon: "Minus",
    category: "layout",
    description: "Draw horizontal section divider rules.",
    fields: [
      { 
        key: "style", 
        label: "Line Border Style", 
        type: "select", 
        localized: false,
        options: [
          { value: "solid", label: "Solid Line" },
          { value: "dashed", label: "Dashed Line" },
          { value: "dotted", label: "Dotted Line" }
        ]
      },
      { key: "color", label: "Divider Color", type: "color", localized: false },
      { key: "margin", label: "Top/Bottom Margin (px)", type: "number", localized: false }
    ]
  },
  {
    type: "html",
    label: "Custom HTML Code",
    icon: "Code",
    category: "content",
    description: "Write raw custom HTML elements.",
    fields: [
      { key: "code", label: "Raw HTML / Embedded Script", type: "textarea", localized: false }
    ]
  }
];

export default BLOCK_SCHEMAS;
