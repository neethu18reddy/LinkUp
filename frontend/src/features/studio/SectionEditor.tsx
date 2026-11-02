import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { searchCareerSkills } from '@/features/goals/career.api';
import { type SectionDraft, duration } from './studio.api';

export function SectionEditor({
  sections,
  items,
  names,
  onChange,
}: {
  sections: SectionDraft[];
  items: { key: string; title: string; durationSec: number; available: boolean }[];
  names: Record<string, string>;
  onChange: (sections: SectionDraft[]) => void;
}) {
  const [skillSearch, setSkillSearch] = useState(''),
    [activeSection, setActiveSection] = useState(0),
    [selectedNames, setSelectedNames] = useState<Record<string, string>>(names);
  const skills = useQuery({
    queryKey: ['studio-skill-search', skillSearch],
    queryFn: () => searchCareerSkills(skillSearch, ''),
    enabled: skillSearch.trim().length >= 2,
  });
  const edit = (fn: (draft: SectionDraft[]) => void) => {
    const copy = structuredClone(sections);
    fn(copy);
    onChange(copy.filter((section) => section.itemKeys.length > 0));
  };
  return (
    <div className="studio-section-editor">
      <p className="field-hint">
        Suggested chapters are a starting point. Rename, split, merge and map skills before you
        save.
      </p>
      {sections.map((section, index) => (
        <details
          className="studio-edit-section"
          key={section.id ?? index}
          open={index === activeSection}
        >
          <summary>
            {section.title} · {section.itemKeys.length} items
          </summary>
          <div className="form-field">
            <label htmlFor={`chapter-title-${index}`}>Chapter title</label>
            <input
              id={`chapter-title-${index}`}
              value={section.title}
              maxLength={200}
              onChange={(event) =>
                edit((copy) => {
                  copy[index]!.title = event.target.value;
                })
              }
            />
          </div>
          <div className="form-field">
            <label htmlFor={`chapter-summary-${index}`}>One-line goal</label>
            <input
              id={`chapter-summary-${index}`}
              value={section.topicSummary}
              maxLength={500}
              onChange={(event) =>
                edit((copy) => {
                  copy[index]!.topicSummary = event.target.value;
                })
              }
            />
          </div>
          <div className="form-field">
            <label htmlFor={`chapter-tags-${index}`}>Topic tags, separated by commas</label>
            <input
              id={`chapter-tags-${index}`}
              defaultValue={section.topicTags.join(', ')}
              onBlur={(event) =>
                edit((copy) => {
                  copy[index]!.topicTags = event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .slice(0, 8);
                })
              }
            />
          </div>
          <div className="goal-filters" aria-label="Mapped skills">
            {section.skills.map((skill) => (
              <button
                type="button"
                key={skill.skillId}
                onClick={() =>
                  edit((copy) => {
                    copy[index]!.skills = copy[index]!.skills.filter(
                      (row) => row.skillId !== skill.skillId,
                    );
                  })
                }
                aria-label={`Remove ${selectedNames[skill.skillId] ?? names[skill.skillId] ?? 'mapped skill'}`}
              >
                {selectedNames[skill.skillId] ?? names[skill.skillId] ?? 'Mapped skill'} ·{' '}
                {Math.round(skill.confidence * 100)}% suggestion ×
              </button>
            ))}
          </div>
          <div className="form-field">
            <label htmlFor={`chapter-skill-${index}`}>Link a catalog skill</label>
            <input
              id={`chapter-skill-${index}`}
              value={index === activeSection ? skillSearch : ''}
              onFocus={() => {
                setActiveSection(index);
                setSkillSearch('');
              }}
              onChange={(event) => {
                setActiveSection(index);
                setSkillSearch(event.target.value);
              }}
              placeholder="Search Python, JavaScript, accounting…"
            />
          </div>
          {index === activeSection && skillSearch.length >= 2 && (
            <div className="studio-skill-results">
              {skills.data?.slice(0, 6).map((skill) => (
                <Button
                  key={skill.id}
                  variant="outline"
                  disabled={
                    section.skills.some((row) => row.skillId === skill.id) ||
                    section.skills.length >= 8
                  }
                  onClick={() => {
                    setSelectedNames((current) => ({ ...current, [skill.id]: skill.name }));
                    edit((copy) => {
                      copy[index]!.skills.push({ skillId: skill.id, confidence: 1 });
                    });
                    setSkillSearch('');
                  }}
                >
                  Add {skill.name}
                </Button>
              ))}
            </div>
          )}
          <ol>
            {section.itemKeys.map((key, itemIndex) => {
              const item = items.find((item) => item.key === key)!;
              return (
                <li key={key} className="studio-edit-item">
                  <strong>{item.title}</strong>
                  <small>
                    {item.available
                      ? duration(item.durationSec)
                      : 'Unavailable · excluded from totals'}
                  </small>
                  <div className="studio-inline-actions">
                    <Button
                      variant="outline"
                      disabled={itemIndex === 0}
                      onClick={() =>
                        edit((copy) => {
                          const keys = copy[index]!.itemKeys;
                          [keys[itemIndex - 1], keys[itemIndex]] = [
                            keys[itemIndex]!,
                            keys[itemIndex - 1]!,
                          ];
                        })
                      }
                      aria-label={`Move ${item.title} up`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="outline"
                      disabled={itemIndex === section.itemKeys.length - 1}
                      onClick={() =>
                        edit((copy) => {
                          const keys = copy[index]!.itemKeys;
                          [keys[itemIndex + 1], keys[itemIndex]] = [
                            keys[itemIndex]!,
                            keys[itemIndex + 1]!,
                          ];
                        })
                      }
                      aria-label={`Move ${item.title} down`}
                    >
                      ↓
                    </Button>
                    <label>
                      Move to chapter{' '}
                      <select
                        aria-label={`Chapter for ${item.title}`}
                        value={index}
                        onChange={(event) =>
                          edit((copy) => {
                            const destination = Number(event.target.value);
                            copy[index]!.itemKeys = copy[index]!.itemKeys.filter(
                              (id) => id !== key,
                            );
                            copy[destination]!.itemKeys.push(key);
                          })
                        }
                      >
                        {sections.map((row, target) => (
                          <option key={target} value={target}>
                            {target + 1}. {row.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {itemIndex < section.itemKeys.length - 1 && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          edit((copy) => {
                            const remaining = copy[index]!.itemKeys.splice(itemIndex + 1);
                            copy.splice(index + 1, 0, {
                              ...copy[index]!,
                              id: undefined,
                              title: `${copy[index]!.title} — continued`.slice(0, 200),
                              itemKeys: remaining,
                            });
                          })
                        }
                      >
                        Split after this
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="studio-inline-actions">
            <Button
              variant="outline"
              disabled={index === 0}
              onClick={() =>
                edit((copy) => {
                  [copy[index - 1], copy[index]] = [copy[index]!, copy[index - 1]!];
                })
              }
            >
              Move chapter up
            </Button>
            <Button
              variant="outline"
              disabled={index === sections.length - 1}
              onClick={() =>
                edit((copy) => {
                  [copy[index + 1], copy[index]] = [copy[index]!, copy[index + 1]!];
                })
              }
            >
              Move chapter down
            </Button>
            {index < sections.length - 1 && (
              <Button
                variant="outline"
                onClick={() =>
                  edit((copy) => {
                    copy[index]!.itemKeys.push(...copy[index + 1]!.itemKeys);
                    copy[index]!.skills = [
                      ...new Map(
                        [...copy[index]!.skills, ...copy[index + 1]!.skills].map((skill) => [
                          skill.skillId,
                          skill,
                        ]),
                      ).values(),
                    ].slice(0, 8);
                    copy.splice(index + 1, 1);
                  })
                }
              >
                Merge with next chapter
              </Button>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
