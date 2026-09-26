import { readFileSync, writeFileSync } from "node:fs";
import { masterCvSchema } from "@/lib/outreach/master-cv";
import { searchAllBoards } from "@/lib/outreach/providers/job-boards";
import { scoreOpportunity, qualifies } from "@/lib/outreach/scoring";
import { buildDraft } from "@/lib/outreach/drafting";
const cv = masterCvSchema.parse(JSON.parse(readFileSync("prisma/content/master-cv.json", "utf8")));
async function main() {
  try {
    const all = await searchAllBoards({ keywords: ["ai","machine learning","data engineer","llm","python","mlops","rag"], limit: 400 });
    const q = all.map(l => ({ l, s: scoreOpportunity(l, cv) })).filter(({s}) => qualifies(s)).sort((a,b)=>b.s.total-a.s.total);
    console.log("qualified:", q.length);
    if (!q.length) return;
    const { l, s } = q[0];
    const d = await buildDraft(cv, l, s, { name: "Alex", title: "Head of Engineering", company: l.company });
    writeFileSync("/tmp/draft-out.txt", `ROLE: ${l.title} @ ${l.company} (${s.total})\nSUBJECT: ${d.subject}\nWORDS: ${d.body.trim().split(/\s+/).length}\n--BODY--\n${d.body}\n--LETTER--\n${d.coverLetter.slice(0,650)}`);
    console.log("written");
  } catch (e) {
    console.log("ERROR:", (e as Error).name, (e as Error).message.slice(0, 300));
  }
}
main();
