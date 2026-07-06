# Service thumbnail source images

Drop raw thumbnail images here, then run:

```bash
npm run services:art
```

That optimizes each to a 1200×750 WebP in `public/services-art/<slug>.webp` and
regenerates `src/lib/service-art.ts`, so the service index + detail banner
switch from the generated SVG to your photo automatically. Rebuild
(`npm run build`, or dev auto-reloads) to see them.

## Naming — two options

**A) Numbered, in the order the 15 images were provided** — save as `1.jpg` … `15.jpg`:

| # | Service (thumbnail theme) |
|---|---|
| 1 | LLM & RAG Systems — wireframe glowing brain + circuits |
| 2 | DSA Problem Solving — abstract rainbow lines/particles |
| 3 | AI-Based Software Development — brain + hand + code windows |
| 4 | Data Science & Machine Learning — low-poly brain + data particles |
| 5 | LangChain Development — chains: LMs / Tools / Memory / Agents |
| 6 | Deep Learning Solutions — neural net INPUT/HIDDEN/OUTPUT + sine |
| 7 | Vector Database Integration — isometric DB servers + arrows |
| 8 | Data Analytics & Visualization — dashboards + line charts |
| 9 | MLOps — CI/CD infinity + neural nets + containers |
| 10 | Chat App Development — chat bubbles + user network |
| 11 | Cloud & DevOps for AI — glass cloud + glowing cubes |
| 12 | AI-Powered Data Pipelines — green particle brain → pipes/ports |
| 13 | AI Voice Assistants — microphone + soundwave → brain |
| 14 | AI Chatbots & Agents — neon circuit brain + chat + hex icons |
| 15 | Agentic AI Development — circuit brain + chat + diamond bursts |

**B) By slug** — name each file after the service slug, e.g. `agentic-ai-development.jpg`.
Any of `.jpg .jpeg .png .webp .avif` works. Slug names override the numbered map.

Services without a provided image keep their generated neural-SVG thumbnail.
Extensions of `.jpg/.png` here are ignored by git-lfs; the optimized `.webp`
outputs in the parent folder are what get served/committed.
