# Onboarding Page

> Page-specific rules. These **override** `design-system/cloudrive/MASTER.md`
> for the first-run onboarding wizard (`/onboarding`).

**Route:** `/onboarding` — `apps/app/app/(onboarding)/onboarding/page.tsx`
**Trigger:** authenticated user whose organization list is empty (gate lives in
`app/(dashboard)/layout.tsx` and the page itself).

---

## Layout

- Full-screen centered panel (`min-h-svh items-center justify-center`), no
  sidebar — the page sits outside the `(dashboard)` route group.
- Content column: `max-w-xl`, single card (`bg-card border` token classes) on
  the page background. Spacious density (Master dials: density 3/10).
- Vertical rhythm inside the card: Stepper → heading block → question →
  options grid → footer actions.

## Wizard pattern

- 4 steps: referral source (radio cards) → use cases (checkbox cards) →
  create organization (text fields) → create workspace (text fields).
  Progress shown by segment bars
  (`components/block/onboarding/stepper.tsx`) + "Step X of 4" caption.
- Options render as selectable cards: `border` default, `border-primary +
  bg-primary/5` when checked, `hover:bg-muted/60`. The form control is
  visually hidden but stays in the accessibility tree (radio group semantics
  on step 1, checkboxes on step 2).
- Step changes re-mount the panel (`key={step}`) with a 300ms fade/slide
  (tw-animate classes) and move focus to the step heading (`tabIndex={-1}`),
  which is skipped under `prefers-reduced-motion`.

## Interaction rules

- Survey answers are **required**: Continue is blocked by Zod
  (`ReferralStepSchema` / `UseCasesStepSchema`); errors surface per field.
- Step 3 submits the survey (`POST /v1/onboarding/survey`, upsert) then the
  organization (`POST /v1/organizations`) and advances to the workspace step.
- The final step creates the workspace (`POST /v1/organizations/:orgId/workspaces`)
  and replaces to `/dashboard`. It has **no Back button** — the organization
  already exists, so going back would only offer to re-create it. While
  submitting, the CTA is disabled with a spinner.
- Back never loses answers — values are lifted into the wizard orchestrator
  and reused as `defaultValues` when a step re-mounts.

## Tokens & components

- Colors, radii and shadows come from the semantic tokens in
  `apps/app/app/globals.css` (light + `.dark`); Primary `#2563EB` via
  `bg-primary`, no hardcoded hex in JSX.
- Font: Poppins (root layout `--font-poppins`).
- Icons: lucide only, one per option card, `size-5 text-primary`,
  `aria-hidden`.
- Reused primitives: `button`, `card`, `label`, `radio-group`, `checkbox`,
  `field`, `input`; auth blocks `session-loading` (gate states) and the
  brand mark.

## Anti-patterns (page-specific)

- ❌ No skip button — the survey is mandatory by product decision.
- ❌ No sidebar/dashboard chrome — the wizard is a standalone context.
- ❌ No layout-shifting hover transforms on option cards (color/background
  transitions only, 150–200ms).
