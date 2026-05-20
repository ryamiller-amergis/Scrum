---
name: Apex Brand Options
overview: Three reviewable Apex brand directions that can replace the current Amergis visual identity in the app after one option is selected.
todos: []
isProject: false
---

# Apex Brand Options

## Purpose

The application currently carries Amergis visual identity through duplicated inline SVG marks, the `Amergis Scrum` title, a Scrum browser title, and navy/teal theme tokens. This document proposes three Apex directions that can be used inside the app without changing Azure DevOps org defaults, project names, or infrastructure naming.

Each option is designed to work across the app's current light and dark themes, login screen, project selector, chat home, calendar accents, buttons, focus states, and favicon.

---

## Option 1: Apex Ascend

**Positioning:** polished, executive, enterprise-ready.  
**Best fit:** if Apex should feel like a trusted planning and delivery command center.

### Brand Personality

Apex Ascend leans into the meaning of "apex": clarity, height, direction, and momentum. It keeps the app professional and familiar, but moves away from the Amergis teal into a sharper blue-violet system that feels more like an AI-enabled product platform.

### Palette

| Role | Light Theme | Dark Theme | Usage |
|---|---:|---:|---|
| Primary accent | `#2747D9` | `#7C8CFF` | Buttons, active nav, links, focus states |
| Accent hover | `#1C33A6` | `#9CA8FF` | Hover and selected states |
| Secondary accent | `#14B8D4` | `#22D3EE` | Highlights, charts, subtle AI indicators |
| Background primary | `#F8FAFF` | `#111827` | App shell and page background |
| Background secondary | `#EEF2FF` | `#1F2937` | Cards, panels, project tiles |
| Text primary | `#111827` | `#F9FAFB` | Primary text |
| Text secondary | `#4B5563` | `#CBD5E1` | Secondary text |
| Success | `#16A34A` | `#4ADE80` | Approved/success states |
| Warning | `#D97706` | `#FBBF24` | Warnings and pending states |
| Error | `#DC2626` | `#F87171` | Error states |

### Logo Direction

- **Icon mark:** an abstract upward peak made from two ascending strokes, forming a subtle `A`.
- **Wordmark:** `Apex` in a strong, geometric wordmark with a small forward angle on the crossbar or peak.
- **Favicon:** icon-only peak in primary accent on transparent background.
- **Motion feel:** no literal mountain illustration; keep it clean enough for 16 px favicon use.

### Suggested App Copy

- Product title: `Apex`
- Optional descriptor: `Planning to Delivery`
- Login prompt: `Sign in with your Azure DevOps account to continue to Apex.`
- Project selector subtitle: `Select a project to start planning.`

### UI Impact

- **Login:** dark, premium card with a blue-violet glow instead of teal. Primary login button uses the primary accent gradient.
- **Project selector:** the current Amergis arc becomes the Apex peak mark above the title. Selected project cards use primary accent.
- **Chat home:** replace the embedded Amergis wordmark with the Apex wordmark or compact mark.
- **Calendar:** event borders use primary accent; AI-generated or planning highlights can use secondary cyan.
- **Focus states:** use a translucent primary accent ring, e.g. `rgba(39, 71, 217, 0.18)` in light mode and `rgba(124, 140, 255, 0.25)` in dark mode.

### Pros

- Feels safest for enterprise users.
- Works well in both light and dark mode.
- Strongest connection to the name "Apex."
- Easy to implement through existing accent token swaps.

### Cons

- More conventional than the other options.
- Less distinct if many internal tools already use blue palettes.

---

## Option 2: Apex Signal

**Positioning:** modern, AI-native, connected.  
**Best fit:** if Apex should feel like an intelligent assistant that turns scattered inputs into clear delivery signals.

### Brand Personality

Apex Signal treats the app as a coordination layer: interviews, PRDs, design docs, backlog work, and reviews all become signals moving through one workflow. The palette feels more technical and energetic, with a graphite base and cyan/lime accents.

### Palette

| Role | Light Theme | Dark Theme | Usage |
|---|---:|---:|---|
| Primary accent | `#0891B2` | `#22D3EE` | Buttons, active nav, links, focus states |
| Accent hover | `#0E7490` | `#67E8F9` | Hover and selected states |
| Secondary accent | `#84CC16` | `#A3E635` | AI status, generated content, completion cues |
| Background primary | `#F7FAFA` | `#0F172A` | App shell and page background |
| Background secondary | `#ECFEFF` | `#182235` | Cards, panels, project tiles |
| Text primary | `#102027` | `#F8FAFC` | Primary text |
| Text secondary | `#475569` | `#CBD5E1` | Secondary text |
| Success | `#22C55E` | `#86EFAC` | Approved/success states |
| Warning | `#EAB308` | `#FDE047` | Warnings and pending states |
| Error | `#E11D48` | `#FB7185` | Error states |

### Logo Direction

- **Icon mark:** three connected nodes rising into an `A` silhouette, suggesting insight, workflow, and AI signal flow.
- **Wordmark:** `Apex` with a small signal dot over or near the `x`.
- **Favicon:** simplified connected-node `A`, using cyan as the base and lime as a small active node.
- **Motion feel:** subtle "ping" or signal pulse can be used only in loading or generation states, not as a constant animation.

### Suggested App Copy

- Product title: `Apex`
- Optional descriptor: `Signal to Delivery`
- Login prompt: `Sign in to turn project signals into delivery plans.`
- Project selector subtitle: `Select a project to focus your signal.`

### UI Impact

- **Login:** graphite background with a soft cyan radial glow and a small lime accent on the logo.
- **Project selector:** connected-node mark above the title; selected card badge can use lime while borders use cyan.
- **Chat home:** excellent fit for agent and interview workflows because the brand language reinforces AI-assisted synthesis.
- **Calendar:** cyan event borders with lime for generated or ready-for-review states.
- **Focus states:** use cyan rings; reserve lime for positive/generated status so it does not overpower the UI.

### Pros

- Strongest alignment with AI, chat, interviews, PRDs, and workflow intelligence.
- Most differentiated from the current Amergis look.
- Gives the app a clear product story beyond a simple color swap.

### Cons

- Requires more discipline to avoid overusing lime accents.
- Slightly less conservative than a classic enterprise blue identity.

---

## Option 3: Apex Forge

**Positioning:** bold, delivery-focused, decisive.  
**Best fit:** if Apex should feel like a place where ideas become approved work and executable backlog.

### Brand Personality

Apex Forge emphasizes making, refining, and shipping. It uses warm amber/orange accents over a dark slate foundation, giving the app a stronger product-build energy while remaining suitable for enterprise workflows.

### Palette

| Role | Light Theme | Dark Theme | Usage |
|---|---:|---:|---|
| Primary accent | `#EA580C` | `#FB923C` | Buttons, active nav, links, focus states |
| Accent hover | `#C2410C` | `#FDBA74` | Hover and selected states |
| Secondary accent | `#F59E0B` | `#FBBF24` | Highlights, review status, generated outputs |
| Background primary | `#FFFBF7` | `#111111` | App shell and page background |
| Background secondary | `#FFF1E6` | `#24201D` | Cards, panels, project tiles |
| Text primary | `#1F2937` | `#FAFAFA` | Primary text |
| Text secondary | `#5B6472` | `#D6D3D1` | Secondary text |
| Success | `#15803D` | `#4ADE80` | Approved/success states |
| Warning | `#CA8A04` | `#FACC15` | Warnings and pending states |
| Error | `#B91C1C` | `#F87171` | Error states |

### Logo Direction

- **Icon mark:** angular chevron peak or forged `A` formed from two beveled shapes.
- **Wordmark:** heavier `Apex` wordmark with squared terminals and confident spacing.
- **Favicon:** compact angular peak, using orange in light mode and amber-orange in dark mode.
- **Motion feel:** crisp transitions and strong hover elevation, but no flames or literal forge imagery.

### Suggested App Copy

- Product title: `Apex`
- Optional descriptor: `Build the Backlog`
- Login prompt: `Sign in to shape ideas into delivery-ready work.`
- Project selector subtitle: `Select a project to start building.`

### UI Impact

- **Login:** dark slate background with warm amber glow; strongest visual departure from Amergis.
- **Project selector:** angular mark creates a bolder landing moment than the current arc.
- **Chat home:** conveys creation and execution, useful for backlog generation and review workflows.
- **Calendar:** orange borders make events prominent; use secondary amber sparingly for review/generation states.
- **Focus states:** use orange rings with reduced opacity to avoid visual heat in dense views.

### Pros

- Most energetic and memorable.
- Strong fit for PRD, design doc, approval, and backlog creation flows.
- Creates clear separation from the current Amergis teal identity.

### Cons

- Warm palette can feel more aggressive in dense enterprise screens.
- Requires careful contrast checks, especially for orange text on light backgrounds.

---

## Side-by-Side Decision Guide

| Criterion | Apex Ascend | Apex Signal | Apex Forge |
|---|---|---|---|
| Enterprise trust | Strongest | Strong | Moderate |
| AI/workflow personality | Moderate | Strongest | Strong |
| Visual distinctiveness | Moderate | Strong | Strongest |
| Lowest implementation risk | Strongest | Strong | Moderate |
| Best dark-mode presence | Strong | Strongest | Strong |
| Best for current app behavior | Strong | Strongest | Strong |

## Recommendation

**Recommended direction: Apex Signal.**

Apex Signal best matches what the app is becoming: a workflow layer for interviews, PRDs, design docs, reviews, backlog creation, chat, and planning. It is distinct from Amergis while still feeling professional, and its cyan/lime system gives useful semantics for AI-generated, ready, and approved states.

Choose **Apex Ascend** if the priority is the most conservative enterprise rebrand. Choose **Apex Forge** if the priority is a bold product-builder identity. Choose **Apex Signal** if the priority is a modern AI-assisted planning product that still feels credible inside the current application.

---

## Implementation Map After Selection

Once a brand direction is selected, the implementation should focus on the current concentrated branding surfaces.

### Theme Tokens

Update `[src/client/App.css](../src/client/App.css)`:

- Replace current navy/teal values in `:root` and `[data-theme="dark"]`.
- Keep the existing token names, including `--accent-color`, `--accent-hover`, `--accent-teal`, `--accent-teal-hover`, `--success-color`, and calendar event tokens, so most components inherit the new brand automatically.
- Consider renaming `--accent-teal` in a later cleanup only if the selected brand is not teal/cyan; for the first implementation, changing values is lower risk than renaming tokens across the app.

### Logo And Wordmark

Create a shared component, likely `[src/client/components/BrandLogo.tsx](../src/client/components/BrandLogo.tsx)`, to prevent future drift:

- `variant="mark"` for favicon-style or project selector usage.
- `variant="wordmark"` for login and chat compose usage.
- `tone="default" | "inverse"` if the selected logo needs different fill behavior on dark login backgrounds.

Then replace duplicated inline SVG usage in:

- `[src/client/components/ProjectSelector.tsx](../src/client/components/ProjectSelector.tsx)`
- `[src/client/components/Login.tsx](../src/client/components/Login.tsx)`
- `[src/client/components/AgentHome.tsx](../src/client/components/AgentHome.tsx)`

### Login Styling

Update `[src/client/components/Login.module.css](../src/client/components/Login.module.css)`:

- Replace hardcoded `#5ACCA6`, `#3aaa86`, and matching rgba shadows with CSS variables from `[src/client/App.css](../src/client/App.css)`.
- Keep the login page dark by default unless a later design pass decides it should follow the user's selected theme.
- Ensure the button text contrast is checked against the chosen accent color.

### Product Naming

Update user-facing naming:

- `[src/client/components/ProjectSelector.tsx](../src/client/components/ProjectSelector.tsx)` from `Amergis Scrum` to `Apex`.
- `[src/client/index.html](../src/client/index.html)` from `Scrum` to `Apex`.
- Consider whether legacy `[public/index.html](../public/index.html)` and `[README.md](../README.md)` should move from Scrum Calendar language to Apex language in the same implementation.

### Favicon

Update `[public/favicon.svg](../public/favicon.svg)`:

- Replace the Amergis arc mark with the selected Apex icon mark.
- Keep it as an SVG for simple browser caching and easy color updates.
- Verify it remains recognizable at 16 px and 32 px.

### Explicitly Out Of Scope Unless Requested

- Azure DevOps organization defaults such as `VITE_ADO_ORG='amergis'`.
- Deployment, CI/CD, and environment configuration.
- MaxView screenshots or sample assets used for AI mock/reference flows.
- Database or RBAC changes.

---

## Implementation Verification Later

When one option is selected and implemented:

1. Run the client type-check with `npx tsc -p tsconfig.client.json --noEmit`.
2. Inspect login, project selector, chat home, and a dense data view in both light and dark themes.
3. Confirm the favicon renders clearly in the browser tab.
4. Search for remaining user-facing `Amergis` branding and decide whether each hit is visual branding or an intentional Azure DevOps/org reference.
