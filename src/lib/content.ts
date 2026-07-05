import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "figure",
    "figcaption",
    "h1",
    "h2",
    "iframe",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading", "class"],
    a: ["href", "name", "target", "rel", "title"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "loading", "title"],
    "*": ["id", "class"],
  },
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//.test(href);
      return {
        tagName,
        attribs: external
          ? { ...attribs, rel: "noopener noreferrer", target: "_blank" }
          : attribs,
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { loading: "lazy", ...attribs },
    }),
  },
};

/**
 * Render stored content (HTML from the WordPress migration or Markdown
 * written in the admin) into sanitized HTML for display.
 */
export function renderContent(
  content: string,
  format: "HTML" | "MARKDOWN"
): string {
  const html =
    format === "MARKDOWN" ? (marked.parse(content, { async: false }) as string) : content;
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Plain-text version of content, for reading time / descriptions. */
export function contentToText(content: string, format: "HTML" | "MARKDOWN"): string {
  const html =
    format === "MARKDOWN" ? (marked.parse(content, { async: false }) as string) : content;
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

export function readingTimeMinutes(content: string, format: "HTML" | "MARKDOWN"): number {
  const words = contentToText(content, format).split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

const CTA_PHRASES =
  /^(hire me|book (a )?free consultation|view portfolio|contact me|get in touch|start a project|get started|request a quote|schedule a call|explore project( click here)?|let'?s (talk|automate|build|work|connect|discuss|chat)[\w\s&'-]*)$/i;

/**
 * Upgrade bare CTA text-links inside migrated copy ("Hire Me",
 * "Let's Talk Automation", "Book Free Consultation"…) into styled
 * buttons (see `.prose-content a.btn-inline` in globals.css) and fix
 * the Elementor "/#/path" hrefs. Match on the stripped link text.
 */
export function upgradeCtaLinks(html: string): string {
  return html
    .replace(/href="\/#\//g, 'href="/')
    .replace(/<a\b([^>]*)>([\s\S]{0,160}?)<\/a>/gi, (full, attrs: string, inner: string) => {
      const text = inner
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#8217;|[‘’]/g, "'") // curly → straight apostrophe
        .replace(/\s+/g, " ")
        .trim();
      if (!CTA_PHRASES.test(text)) return full;
      let cleaned = attrs.replace(/\sclass="[^"]*"/i, "");
      // internal link → don't open a new tab
      if (/href="\/(?!\/)/.test(cleaned)) {
        cleaned = cleaned
          .replace(/\starget="[^"]*"/i, "")
          .replace(/\srel="[^"]*"/i, "");
      }
      return `<a${cleaned} class="btn-inline">${text}</a>`;
    });
}
