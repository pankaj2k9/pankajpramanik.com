import PageMotion from "@/components/motion/PageMotion";

/** Side progress steps; ids are the section elements on the homepage. */
const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "expertise", label: "Services" },
  { id: "work", label: "Work" },
  { id: "finder", label: "Process" },
  { id: "contact", label: "Contact" },
];

export default function HomeMotion() {
  return (
    <PageMotion
      steps={STEPS}
      shell=".home-shell"
      root=".home-below"
      hero=".home-hero-frame"
    />
  );
}
