# AIX Studio — Project Context

## ⚠️ NEVER run `pnpm install` or `pnpm build` automatically

The AIUX Lab dev server handles dependency installation and builds automatically when files change. **Do NOT** run `pnpm install`, `npm install`, or any build command unless the user explicitly asks you to. If a build fails, read `.aix/build-status.json` — the dev server reports errors there.

---

## Skill Loading — MANDATORY FIRST STEP

**Before any work, call `mcp__lab-builder__get_skill` with the project path.** This loads the `aiux-build` skill — the single orchestrator that contains:
- **Mode Router** — classifies intent as BUILD / EDIT / DEBUG / ANALYZE
- **43 Principles** — validation rules for all generated code
- **Reference file triggers** — tells you exactly which sub-references to load per mode
- **Companion skill triggers** — tells you when to call `get_patterns` for other skills

If `get_skill` fails, **stop and report the error**. Do NOT proceed without it.

### Companion Skills (loaded via `get_patterns`)

Load these when the `aiux-build` skill instructs you to:

| Skill | When to load | Tool call |
|---|---|---|
| `ui-discovery` | **Before any UI code** (BUILD and EDIT) | `get_patterns(skill='ui-discovery')` |
| `accessibility` | Any interactive element | `get_patterns(skill='accessibility')` |
| `internationalization` | Any user-visible string | `get_patterns(skill='internationalization')` |
| `localization` | Locale-specific formatting, RTL | `get_patterns(skill='localization')` |
| `motion` | Any animation or transition | `get_patterns(skill='motion')` |

**How to use `ui-discovery`:** it returns a single index ranking both packaged AIUX components and live instance widgets — pick the best-fit candidate, load its reference, and (if it's a widget) run the reference's `fetch-widget-source.js` command before wiring it up.

**Order of operations for BUILD tasks:**
1. `ui-discovery` — check the platform component and widget index first
2. Write the component/page/widget using `aiux-build` skill references
3. `accessibility` — wire ARIA, keyboard, focus
4. `internationalization` — wrap all strings

---

## Agent

| Agent | When to Use |
| ----- | ----------- |
| `aiux-coder` | Single-agent pipeline — builds, edits, debugs Karuna AIUX apps and widgets end-to-end |

---

## Project Structure

**The project on disk is the source of truth.** Do not assume or hardcode a directory layout.

1. Call `mcp__lab-builder__get_skill` to load `aiux-build` — it contains the **Placement Conventions** table and **App Architecture** detection logic for the current project type.
2. Use `analyze_project` to read the manifest (`aiux.json` or `now.config.json`) and discover the actual folder layout.
3. Only create files in paths that `aiux-build` prescribes for the detected project type.
4. Never invent directories — if you're unsure, list the project root and read the manifest first.

### Recovery — if you drifted or hallucinated paths

1. **Stop writing.** Read `aiux.json` and/or `now.config.json` to confirm the project type.
2. List the top-level directories (`ls`) to see what actually exists.
3. Re-load `aiux-build` and follow the Placement Conventions table it provides.
4. Move any mislocated files to the correct paths — do not duplicate them.
5. Run `validate_code` if available and fix any violations.

**Tag names are ALWAYS fully hyphenated — never underscores.** A custom element
tag uses only lowercase letters, digits, and hyphens. When the tag is prefixed
with the app scope, hyphenate the scope too: `x_snc_wonderla_app` →
`@customElement('x-snc-wonderla-app-layout')`, NOT `'x_snc_wonderla_app-layout'`.
Underscores belong only to ServiceNow scope/table names, never to a tag.

---

## Figma Design Import

**Uses the `lab-figma` MCP server.** The only tool is `extract_design`.

**Storage rule:** all Figma design artifacts are saved INSIDE the project under `.aiux-lab/design/`.

| Trigger | What to do |
|---------|------------|
| User pasted a `figma.com` URL | Call `extract_design(url=…, output_path="<project>/.aiux-lab/design")` |
| Design spec already exists | Read `.aiux-lab/design/design-spec.md` directly — do NOT re-extract |
| Token error from `extract_design` | Tell user: "Set your Figma token in Settings → Integrations → Figma Token" |

### Figma → Code Workflow

1. **Extract** — call `extract_design`, read both `design-spec.md` and `design-spec.png`
2. **Plan** — component anatomy, data model, color mapping, typography, mock data
3. **Load skills** — `get_skill` (aiux-build) + `get_patterns(skill='ui-discovery')`
4. **Build** — write the code following `aiux-build` skill references
5. **Verify** — compare rendered output against design PNG, fix discrepancies

**The design PNG is the visual source of truth** — when the markdown spec conflicts, trust the PNG.

### Design Spec — Known Pitfalls

| Spec artifact | What it actually means | What to do |
|---|---|---|
| `bg:#hex` on a **text node** | Text fill color, not background | Use as `color: #hex` |
| `fillToken:…/soft/bg` | Light tinted variant | Use 10-15% opacity tint |
| `border:Npx solid #hex` | May be dashed | Check design PNG |
| `icon:corner`, `icon:color` | Generic Figma names | Use CSS for decorative, `<aiux-icon>` for real icons |
| Hardcoded pixel widths | Figma artboard dimensions | Use `width: 100%; max-width: Npx` |

---

## MCP Tools

### lab-builder — App Development

| Tool | When to call |
|------|--------------|
| `get_skill` | **Always first.** Loads `aiux-build` — the core orchestrator skill. |
| `get_patterns` | Load companion skills: `ui-discovery`, `accessibility`, `internationalization`, `localization`, `motion`. |
| `get_skill_ref` | Load a skill's reference sub-file when `aiux-build` instructs you to. |
| `get_component_docs` | Look up a specific component (button, card, modal, etc.). |
| `analyze_project` | Understand existing project structure before writing. |
| `get_project_summary` | Quick project summary at session start. |
| `plan_app` | Generate plan. **Must present to user before creating.** |
| `validate_code` | Validate widget code for common errors. |

### lab-figma — Design Import

| Tool | When to call |
|------|--------------|
| `extract_design` | Extract design spec from a Figma URL. |

### lab-debug — Dev Server

| Tool | When to call |
|------|--------------|
| `read_logs` | Read dev server output for errors. |
| `detect_server` | Check if a dev server is running. |

**Anti-hallucination rules:**
- NEVER invent tool names not listed above.
- If a tool returns `success: false`, read the error and adapt — do not retry the same input.

---

### Icon Usage

```js
import '@servicenow/aiux-components-icon';
html`<aiux-icon name="magnifying-glass-outline" size="md" aria-hidden="true"></aiux-icon>`
```

**Sizes:** `xs` (12px) · `sm` (16px) · `md` (20px) · `lg` (24px) · `xl` (32px)
**Common:** `magnifying-glass`, `plus`, `trash`, `pencil`, `close`, `check`, `chevron-down`, `chevron-right`, `home`, `user`, `gear`, `bell`, `arrow-left`, `arrow-right`, `circle-info`, `triangle-exclamation`
