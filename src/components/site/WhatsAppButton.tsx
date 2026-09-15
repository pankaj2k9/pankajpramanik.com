import { site } from "@/lib/site";
export default function WhatsAppButton() {
  return (
    <a
      href={site.whatsapp}
      className="whatsapp-float"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Pankaj on WhatsApp (opens in a new tab)"
    >
      <svg
        width="25"
        height="25"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        aria-hidden="true"
      >
        <path d="M20.5 11.8a8.6 8.6 0 0 1-12.8 7.5L3 20.5l1.3-4.6a8.6 8.6 0 1 1 16.2-4.1Z" />
        <path d="M8 7.5c-.8.5-.9 1.5-.5 2.5 1 2.8 3.2 5 6 5.8 1 .3 2-.1 2.5-1l.2-.8-2.6-1.3-1 1c-1.6-.7-2.8-1.8-3.5-3.4l.9-1.1L8.8 7Z" />
      </svg>
      <span>Let’s chat</span>
    </a>
  );
}
