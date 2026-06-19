---
name: spec-driven-development
description: Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet. Use when requirements are unclear, ambiguous, or only exist as a vague idea.
---

# Spec-Driven Development

## Overview

Write a structured specification before writing any code. The spec is the shared source of truth between you and the human engineer — it defines what we're building, why, and how we'll know it's done. Code without a spec is guessing.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

**When NOT to use:** Single-line fixes, typo corrections, or changes where requirements are unambiguous and self-contained.

## The Gated Workflow

Spec-driven development has eight phases. Do not advance to the next phase until the current one is validated.

```
                        ┌─ desde main ─┐
                        ▼              │
SPECIFY → PLAN → TASKS → BRANCH → IMPLEMENT → VERIFY → COMMIT ─┐
   │         │        │     │         │          │       │      │
   ▼         ▼        ▼     ▼         ▼          ▼       ▼      │
 Review   Review   Review  Ask     (en rama)   (en rama) (rama) │
                           permiso                              │
                                                     ← loop si hay más tareas →
                                                                        │
                                                                        ▼
                                                                   ASK PERMISO
                                                                        │
                                                                        ▼
                                                                     MERGE → main
```

### Phase 1: Specify

Start with a high-level vision. Ask the human clarifying questions until requirements are concrete.

**Surface assumptions immediately.** Before writing any spec content, list what you're assuming:

```
ASSUMPTIONS I'M MAKING:
1. This is a web application (not native mobile)
2. Authentication uses session-based cookies (not JWT)
3. The database is MongoDB (based on existing Prisma schema)
4. We're targeting modern browsers only (no IE11)
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The spec's entire purpose is to surface misunderstandings *before* code gets written — assumptions are the most dangerous form of misunderstanding.

**Write a spec document covering these six core areas:**

1. **Objective** — What are we building and why? Who is the user? What does success look like?

2. **Commands** — Full executable commands with flags, not just tool names.
   ```
   Check: npx tsc --noEmit
   Test: node --test
   Lint: npx eslint .
   Build: npm run build
   ```

3. **Effort** — Complexity estimate (XS, S, M, L, XL) with rationale. Not time — complexity and uncertainty.

4. **Dependencies** — What other tasks or milestones this depends on. Must be ordered and justified.

5. **Delivery Criteria** — Concrete, testable conditions that define "done". Not "works on my machine" — verifiable in CI.

6. **Boundaries** — Three-tier system:
   - **Always do:** Ask before creating/merging branches, run `npx tsc --noEmit` and `node --test` before every commit, follow naming conventions, validate inputs, commit with semantic prefixes
   - **Ask first:** Database schema changes, adding dependencies, changing milestone scope
   - **Never do:** Create or merge branches without asking, commit with failing tests, commit secrets, edit vendor directories, remove failing tests without approval, use `--no-verify` or `--force-with-lease`, work on `main` instead of a feature branch

**Spec template:**

```markdown
# HH.Y — Nombre — Specification

## Objective
[What we're building and why. Acceptance criteria.]

## Effort
[Complexity: XS / S / M / L / XL. Rationale.]

## Dependencies
[What must be done first. Both tasks and milestones.]

## Delivery Criteria
[Specific, testable conditions that prove completion.]

## Risks
[What could go wrong, and how to mitigate.]
```

**Estimate effort by complexity, not time.** Use this scale from the SDD conventions:

| Tamaño | Significado | Líneas típicas | Incertidumbre |
|--------|------------|----------------|---------------|
| XS | Ajuste trivial | < 50 | Cero |
| S | Cambio acotado | 50–150 | Baja |
| M | Módulo nuevo | 150–400 | Media |
| L | Módulo complejo | 400–800 | Alta |
| XL | Proyecto en sí mismo | 800+ | Muy alta |

**Reframe instructions as success criteria.** When receiving vague requirements, translate them into concrete conditions:

```
REQUIREMENT: "Make the dashboard faster"

REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
- No layout shift during load (CLS < 0.1)
→ Are these the right targets?
```

This lets you loop, retry, and problem-solve toward a clear goal rather than guessing what "faster" means.

### Phase 2: Plan

With the validated spec, generate a technical implementation plan:

1. Identify the major components and their dependencies
2. Determine the implementation order (what must be built first)
3. Note risks and mitigation strategies
4. Identify what can be built in parallel vs. what must be sequential
5. Define verification checkpoints between phases

The plan should be reviewable: the human should be able to read it and say "yes, that's the right approach" or "no, change X."

### Phase 3: Tasks

Break the plan into discrete, implementable tasks:

- Each task should be completable in a single focused session
- Each task has explicit acceptance criteria
- Each task includes a verification step (test, build, manual check)
- Tasks are ordered by dependency, not by perceived importance
- No task should require changing more than ~5 files

**Task template:**
```markdown
- [ ] Task: [Description]
  - Acceptance: [What must be true when done]
  - Verify: [How to confirm — test command, build, manual check]
  - Files: [Which files will be touched]
```

### Phase 4: Branch

Before writing any code, create a dedicated branch for the task:

1. **Ask the human:** "¿Creo la rama `feat/HH.Y-nombre` desde main?" Wait for explicit confirmation before proceeding. If the human says no, stop and clarify.

2. **Create the branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/HH.Y-nombre-descriptivo
   git push -u origin feat/HH.Y-nombre-descriptivo
   ```

3. **Branch naming convention:** Use the task identifier from `docs/sdd/`:
   - `feat/01.1-aes-128-cmac`
   - `feat/02.4-es8plus`
   - `feat/03.1-session-repository-sqlite`

All subsequent Implement → Verify → Commit phases happen on this branch. The spec documents in `docs/sdd/` remain on `main` — the branch only contains code changes.

### Phase 5: Implement

Execute tasks one at a time on the feature branch. Use `context-engineering` to load the right spec sections and source files at each step rather than flooding the agent with the entire spec.

**Before starting implementation, reflect the state change in the status dashboard:**

1. Open `docs/status/README.md`
2. Move the task row from **Next Up** to **Active Tasks**
3. Set its status to `🔄 In Progress`
4. Commit the dashboard update with `docs:` prefix:
   ```bash
   git add docs/status/
   git commit -m "docs: mark HH.Y — Nombre as in progress"
   ```

### Phase 6: Verify

After implementing each task, run the verification gate before considering it done:

1. **`npx tsc --noEmit`** — must pass without errors or warnings. If it fails, **stop immediately** and fix the compilation error before proceeding to any other command.
2. **`node --test`** — all tests must pass (green). If any test fails, **stop immediately** and fix the implementation before proceeding.
3. If the task adds new tests, verify they are included in the test run and pass.

Do not skip or abbreviate verification. "It compiled locally" is not sufficient — run the commands explicitly. If verification fails on the first attempt, fix, then re-run verification from the start.

### Phase 7: Commit

**Update living documentation before committing code.** The documentation must reflect the new state before the commit is made:

1. **Update `docs/sdd/HH-nombre-del-hito/HH.Y-nombre-tarea/SPEC.md`** — change `- [ ] Implementado` to `- [x] Implementado`
2. **Update `docs/sdd/HH-nombre-del-hito/README.md`** — change `- [ ] [HH.Y — ...](...)` to `- [x] [HH.Y — ...](...)`
3. **Update `docs/roadmap/README.md`** — update any progress checkboxes or resolved-debt entries
4. **Update `docs/status/README.md`** — move the task from **Next Up** (or **Active Tasks**) to **Completed Tasks**, set status to `✅ Done`, link the commit hash (use `HEAD` as placeholder, update after commit), and update the progress bars
5. **Stage the doc changes** along with the code changes.

Only after docs are updated, verify and commit:

6. **`git status`** — review what changed. Stage only intended files (no secrets, no build artifacts, no generated files).
7. **`git diff --cached`** — review the staged diff for correctness before committing.
8. **Write a commit message** using semantic prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`. Keep commits focused — one logical change per commit. If both code and docs change in the same task, use the code prefix (`feat:`, `fix:`, etc.) — the docs commit hash will be part of the same commit.
9. **`git commit`** — commit with the message. Do not use `--no-verify`, do not force push.
10. If the commit hook rejects the commit (e.g., linter), fix the issue and create a new commit — do not amend.

**Do not commit if verification fails.** Fix the issue first and re-run verification.

After the commit, go back to the status dashboard and **replace `HEAD` with the real commit hash** in the Completed Tasks entry, then commit the hash fix:

```bash
git add docs/status/
git commit -m "docs: add commit hash to completed task HH.Y"
```

If there are more tasks in the milestone, return to Phase 5 (Implement) for the next task. The branch accumulates commits until all tasks are done.

### Phase 8: Merge

When all tasks for the milestone are implemented, verified, committed, and their checkboxes marked in the living documentation:

1. **Finalize the status dashboard** — open `docs/status/README.md` and update the progress bar for the completed milestone to `████████░░ 100%` (or actual percentage).
2. **Ask the human:** "Todo el hito HH está implementado y verificado en `feat/HH.Y-nombre`. ¿Fusiono a main?" Wait for explicit confirmation. If the human says no, ask what needs to change.

2. **Merge with `--no-ff`** (creates an explicit merge commit):
   ```bash
   git checkout main
   git pull origin main
   git merge --no-ff feat/HH.Y-nombre-descriptivo -m "feat: implement HH.Y — Nombre descriptivo"
   git push origin main
   ```

3. **Delete the feature branch** (local and remote):
   ```bash
   git branch -d feat/HH.Y-nombre-descriptivo
   git push origin --delete feat/HH.Y-nombre-descriptivo
   ```

**Do not merge if verification fails.** The branch must be fully green before asking.

## Keeping the Spec Alive

The spec is a living document, not a one-time artifact:

- **Update when decisions change** — If you discover the data model needs to change, update the spec first, then implement.
- **Update when scope changes** — Features added or cut should be reflected in the spec.
- **Mark progress with checkboxes** — Each SPEC.md, milestone README.md, and the roadmap have checkboxes that track completion. Check them after verifying the task.
- **Keep the status dashboard current** — `docs/status/README.md` is the single source of truth for project state. Every state change (started, completed, blocked) must be reflected there before committing.
- **Commit the spec** — The spec belongs in version control alongside the code.
- **Reference the spec in PRs** — Link back to the spec section that each PR implements.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is simple, I don't need a spec" | Simple tasks don't need *long* specs, but they still need acceptance criteria. A two-line spec is fine. |
| "I'll write the spec after I code it" | That's documentation, not specification. The spec's value is in forcing clarity *before* code. |
| "The spec will slow us down" | A 15-minute spec prevents hours of rework. Waterfall in 15 minutes beats debugging in 15 hours. |
| "Requirements will change anyway" | That's why the spec is a living document. An outdated spec is still better than no spec. |
| "The user knows what they want" | Even clear requests have implicit assumptions. The spec surfaces those assumptions. |

## Red Flags

- Starting to write code without any written requirements
- Asking "should I just start building?" before clarifying what "done" means
- Implementing features not mentioned in any spec or task list
- Making architectural decisions without documenting them
- Skipping the spec because "it's obvious what to build"
- Creating branches without asking the human first
- Merging branches without asking the human first
- Working on `main` instead of a feature branch
- The status dashboard (`docs/status/README.md`) is outdated or missing a task state change

## Verification

Before proceeding to implementation, confirm:

- [ ] The spec covers all six core areas
- [ ] The human has reviewed and approved the spec
- [ ] Success criteria are specific and testable
- [ ] Boundaries (Always/Ask First/Never) are defined
- [ ] The spec is saved to a file in the repository
- [ ] Status dashboard (`docs/status/README.md`) exists and is up to date

Before committing, confirm the verification gate passes:

- [ ] `npx tsc --noEmit` passes without errors or warnings
- [ ] `node --test` passes (all tests green)
- [ ] **Living documentation is updated** — SPEC.md checkbox toggled, milestone README checkbox toggled, status dashboard moved to Completed with commit hash, progress bars updated
- [ ] Only intended files are staged (`git status`)
- [ ] Staged diff is clean and correct (`git diff --cached`)
- [ ] Commit message uses semantic prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`)

Before merging, confirm:

- [ ] Human approved the branch creation (Phase 4 was completed)
- [ ] All tasks are committed on the feature branch
- [ ] All verification gates pass on the branch
- [ ] Checkboxes are marked in `docs/sdd/HH-nombre-del-hito/HH.Y-nombre-tarea/SPEC.md`, `docs/sdd/HH-nombre-del-hito/README.md`, `docs/roadmap/README.md`, and `docs/status/README.md`
- [ ] Human approved the merge (`git merge --no-ff`)
