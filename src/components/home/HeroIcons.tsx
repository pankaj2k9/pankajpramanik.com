/** Line icons for the homepage hero. Stroke-based so colour comes from CSS. */
const paths: Record<string, React.ReactNode> = {
  data: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v6.2c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.5" />
      <path d="M4.5 11.7v6.5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6.5" />
    </>
  ),
  ml: (
    <>
      <path d="M9.5 3.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2 3.2 3.2 0 0 0 2.3 5.3 3 3 0 0 0 5.2 2V4.7a2.5 2.5 0 0 0-2.5-1.2Z" />
      <path d="M14.5 3.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-2.3 5.3 3 3 0 0 1-5.2 2" />
      <path d="M12 8.5h3M12 12h4.5M12 15.5h3M9 9H7.5M9 13H7" />
    </>
  ),
  intelligence: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.1V16h5.2v-.1c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
      <path d="M12 7v3.5M3 9.5h1.5M19.5 9.5H21M5.2 3.8l1 1M18.8 3.8l-1 1" />
    </>
  ),
  automation: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      <circle cx="12" cy="12" r="6.6" />
    </>
  ),
  analytics: (
    <>
      <path d="M3 20.5h18" />
      <path d="m3.5 16 5-5.5 4 3.5 7.5-8.5" />
      <path d="M16 5.5h4v4" />
    </>
  ),
  llmops: (
    <>
      <path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4Z" />
      <path d="m4 7.4 8 4.6 8-4.6M12 12v9.2" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10ZM8 11.5h2.3l1-2 1.6 4 1-2H16" />
  ),
  scale: (
    <path d="M12 4v16M8 20h8M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0Zm14 0-2.5 6a2.5 2.5 0 0 0 5 0Z" />
  ),
  bank: <path d="M3 9.5 12 4l9 5.5M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20.5h18" />,
  cap: (
    <path d="m2.5 9.5 9.5-5 9.5 5-9.5 5ZM6.5 11.6v4.6c1.5 1.3 3.4 2 5.5 2s4-.7 5.5-2v-4.6M21.5 9.5v5" />
  ),
  plane: (
    <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Zm-11 10 5-5" />
  ),
  bars: <path d="M5 20v-5M10 20V9M15 20v-8M20 20V4" />,
  cube: (
    <>
      <path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4Z" />
      <path d="m4 7.4 8 4.6 8-4.6M12 12v9.2" />
    </>
  ),
  bolt: <path d="M13 2.5 4.5 13.5H12L11 21.5l8.5-11H12Z" />,
};

export default function HeroIcon({
  name,
  size = 24,
  strokeWidth = 1.7,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
