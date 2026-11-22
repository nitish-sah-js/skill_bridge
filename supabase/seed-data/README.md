# Seed data contract

`npm run seed:generate` validates every JSON file here and writes `supabase/seed.sql`.
Questions, practical challenges and learning tasks belong to a **skill**, so a skill shared
by several careers (e.g. `python`) is authored once.

## careers.json
Array of:
```jsonc
{
  "slug": "cybersecurity-engineer",
  "name": "Cybersecurity Engineer",
  "description": "1-2 sentences",
  "responsibilities": ["...", "..."],          // 4-6 items
  "prerequisites": ["...", "..."],             // 3-5 entry-level prerequisites
  "suggested_projects": [{ "title": "...", "description": "..." }], // 3 items
  "skills": [                                   // 8-12 items
    { "skill": "computer-networking", "required_proficiency": 75, "importance_weight": 1.0 }
  ]
}
```
`required_proficiency` is 0-100, `importance_weight` is 0.5-1.5 (1.0 = typical).

## skills/<skill-slug>.json  (one file per skill)
```jsonc
{
  "slug": "linux-fundamentals",
  "name": "Linux Fundamentals",
  "description": "1 sentence",
  "category": "Systems",                        // free text grouping
  "prerequisites": ["computer-networking"],     // other skill slugs (may be empty)
  "resources": [{ "title": "...", "url": "https://...", "kind": "docs|course|article|video|interactive" }], // 2-4, stable well-known URLs only
  "questions": [                                // EXACTLY 6
    {
      "key": "linux-q1",                        // unique, stable
      "difficulty": "beginner|intermediate|advanced",
      "question": "...",
      "options": ["A", "B", "C", "D"],          // exactly 4, distinct
      "correct_index": 0,                        // 0-3; vary the position across questions
      "explanation": "why the answer is correct",
      "points": 1                                // beginner 1, intermediate 2, advanced 3
    }
  ],
  "practical": null | {                         // optional, deterministic rubric
    "key": "linux-p1",
    "title": "...",
    "difficulty": "beginner|intermediate|advanced",
    "instructions": "what to write (short command, query, snippet or written answer)",
    "expected_output": "what a good answer contains",
    "rubric": [                                  // 3-5 criteria, points sum = max_points
      { "key": "c1", "description": "Uses find", "points": 4,
        "patterns": ["\bfind\b"],              // JS regex sources, tested case-insensitively against the submission
        "hint": "feedback shown when the criterion is missed" }
    ],
    "max_points": 10
  },
  "tasks": [                                    // EXACTLY 4: level 1 learn, level 1 practice, level 2 practice, level 3 apply
    {
      "key": "linux-t1",
      "level": 1,                                // 1 foundation (proficiency <40), 2 developing (40-69), 3 advanced (>=70)
      "type": "learn|practice|project",
      "title": "...",
      "description": "2-3 sentences of concrete activity",
      "estimated_minutes": 90,                   // 30-240
      "completion_criteria": "measurable criterion",
      "resource_url": "https://..." 
    }
  ]
}
```
