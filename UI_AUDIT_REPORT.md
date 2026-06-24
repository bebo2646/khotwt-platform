# UI/UX DESIGN SYSTEM AUDIT REPORT

This report documents the single source of truth for the platform's unified design system tokens, typography rules, interactive behaviors, and spacing scales.

---

## 1. Centralized Theme Color Tokens

All colors across components are dynamic and reference these CSS variable tokens in [index.css](file:///D:/manst%20ellem/frontend/src/index.css) to support unified Dark/Light mode shifting:

| Color Token | Dark Mode Value | Light Mode Value | Design Role |
| :--- | :--- | :--- | :--- |
| `--primary-color` | `#6366F1` | `#6366F1` | Brand Indigo / Purple identity |
| `--primary-hover` | `#5458EE` | `#5458EE` | Darker active hover color |
| `--secondary-color` | `#8B5CF6` | `#8B5CF6` | Secondary accent purple |
| `--secondary-hover` | `#7C3AED` | `#7C3AED` | Secondary hover purple |
| `--accent-color` | `#06B6D4` | `#06B6D4` | Cyan highlight |
| `--bg-color` | `#020617` | `#F8FAFC` | Main layout background |
| `--surface-bg` | `#0F172A` | `#FFFFFF` | Core components backdrop |
| `--card-bg` | `#111827` | `#FFFFFF` | Elevated wrapper background |
| `--border-color` | `rgba(255, 255, 255, 0.08)` | `#E2E8F0` | Low-opacity card/table borders |
| `--input-bg` | `rgba(2, 6, 23, 0.45)` | `#F8FAFC` | Inset form element background |
| `--input-border` | `rgba(99, 102, 241, 0.18)` | `#CBD5E1` | Solid border color for inputs |
| `--text-color` | `#FFFFFF` | `#0F172A` | Primary text and headers |
| `--text-secondary` | `#CBD5E1` | `#475569` | Secondary description details |
| `--text-muted` | `#94A3B8` | `#94A3B8` | Subtext and captions |
| `--glow-color` | `rgba(99, 102, 241, 0.35)` | `rgba(99, 102, 241, 0.35)` | Interactive box-shadow glow |

---

## 2. Typography & Fonts System

- **Primary Font**: `Cairo` (coupled with `Inter` and system fallbacks). Implemented natively via:
  ```css
  font-family: 'Cairo', 'Inter', system-ui, sans-serif;
  ```
- **Weights**:
  - `300` (Light) - Supplementary labels.
  - `400` (Regular) - Table rows and descriptive paragraphs.
  - `600` (Semi-Bold) - Inputs, buttons, and subheadings.
  - `700` (Bold) - Main component headers, cards title.
  - `900` (Black) - Main landing Hero headings.

---

## 3. Shadows & Elevation Hierarchy

- **Premium Cards (`.bg-brand-card`)**:
  - **Dark Mode**: `0 20px 60px rgba(0, 0, 0, 0.35)` (large dark projection blur for navy base).
  - **Light Mode**: `0 20px 40px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)` (combines high-density elevation with border definition `#E2E8F0`).
- **Primary Buttons (`.btn-primary`)**:
  - **Glow Shadow**: `0 10px 30px rgba(99, 102, 241, 0.35)` (vivid purple projection).
  - **Active State Hover**: `0 15px 35px rgba(99, 102, 241, 0.5)` + translation scale.
- **Form Fields (Inputs)**:
  - **Inset Shadow**: `inset 0 2px 4px rgba(0, 0, 0, 0.04)` (for elevated card look).
  - **Focus Ring Glow**: `0 0 0 3px rgba(99, 102, 241, 0.35)`.

---

## 4. Spacing & Alignments

- **Base Layout Scale**: Aligning layouts using absolute margin, padding, and gaps:
  - `p-6` / `p-8` / `p-12` (grid components spacing).
  - `gap-6` / `gap-8` (card grid layouts).
  - `space-y-28` (large sections separations).
- **Navbar Layout System**:
  - **Horizontal Padding**: Unified between `32px` and `48px` (`px-8 sm:px-10 lg:px-12`) to align with container layout limits.
  - **Item Gaps**: Set between `24px` and `32px` (`gap-6 xl:gap-8`) to prevent cramping menu elements.
  - **Visual Centering**: Decoupled the navigation link container from the logo using a centered flex layout (`justify-center flex-1 mx-6`) to achieve absolute visual balance across columns.
- **Responsive Widths**: Added `max-w-7xl` container sizing constraints with relative responsive margins (`mx-auto px-4`) to assure layout fluidity.
