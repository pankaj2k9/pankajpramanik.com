import type { Education } from "@prisma/client";

/**
 * Splits a stored degree such as "Bachelor of Science (Honours) in Data
 * Science" or "Undergraduate Studies, Mechanical Engineering" into the
 * qualification and the field of study, so both can be labelled.
 */
export function splitDegree(degree: string): { qualification: string; field?: string } {
  const match = degree.match(/^(.+?)\s+in\s+(.+)$/) ?? degree.match(/^(.+?),\s+(.+)$/);
  return match
    ? { qualification: match[1].trim(), field: match[2].trim() }
    : { qualification: degree };
}

const isDegree = (qualification: string) =>
  /\b(bachelor|master|doctor|bsc|msc|ba|ma|phd|b\.?tech|m\.?tech)\b/i.test(qualification);

/** Education records as labelled cards; the first card can be featured. */
export default function EducationList({
  education,
  featureFirst = false,
}: {
  education: Education[];
  featureFirst?: boolean;
}) {
  return (
    <ol className={`ed-list${featureFirst ? " has-featured" : ""}`} data-hm-stagger>
      {education.map((ed, i) => {
        const { qualification, field } = splitDegree(ed.degree);
        return (
          <li key={ed.id} data-hm="up">
            <article className={`ip-card ed-card${featureFirst && i === 0 ? " is-featured tone-peach" : ""}`}>
              <div className="ed-head">
                <p className="hm-label ed-years">
                  <time dateTime={String(ed.startYear)}>{ed.startYear}</time>
                  {" - "}
                  {ed.endYear ? <time dateTime={String(ed.endYear)}>{ed.endYear}</time> : "Present"}
                </p>
                <h3 className="ed-institution">{ed.institution}</h3>
              </div>
              <div className="ed-body">
                <dl className="ed-facts">
                  <div>
                    <dt>{isDegree(qualification) ? "Degree" : "Qualification"}</dt>
                    <dd>{qualification}</dd>
                  </div>
                  {field && (
                    <div>
                      <dt>Field of study</dt>
                      <dd>{field}</dd>
                    </div>
                  )}
                </dl>
                {ed.description && <p className="ed-description">{ed.description}</p>}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
