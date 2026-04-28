# Coach Brand Guidelines

> Version 1.0 | March 2026

---

## 1. Brand Foundation

### Brand Name

**Coach** (Коуч in Mongolian)

### Brand Essence

AI-powered personal nutrition coaching, designed for Mongolia.

### Mission Statement

Empower every Mongolian to understand and improve their nutrition through intelligent, culturally-aware food tracking and coaching.

### Brand Values

| Value           | Meaning                                                   |
| --------------- | --------------------------------------------------------- |
| **Intelligent** | AI-driven insights that feel personal, not generic        |
| **Accessible**  | Designed for Mongolian language, foods, and culture first |
| **Trustworthy** | Accurate data, transparent tracking, privacy-respecting   |
| **Motivating**  | Encouraging progress, not punishing mistakes              |

### Brand Personality

Coach speaks like a **knowledgeable friend** — supportive but direct, data-informed but never clinical. It celebrates small wins and frames setbacks as learning moments.

### Elevator Pitch

> Coach is an AI nutrition app built for Mongolia. Log meals by text, voice, or photo in Mongolian — and get personalized insights powered by GPT-4 Vision. Track macros, weight trends, and weekly progress with a coach that actually understands Mongolian food.

---

## 2. Logo

### Primary Logomark

The Coach logomark is a **stylized letter "C"** constructed from geometric arcs with a dynamic slash element and AI pulse dots. The open ring represents ongoing progress; the slash conveys speed and intelligence; the pulse dots represent the AI engine.

### Logo Variations

| Variation                      | Use Case                                                |
| ------------------------------ | ------------------------------------------------------- |
| **Full-color on dark**         | Primary usage — app icon, splash screens, hero sections |
| **Gradient on dark (#1A1A2E)** | Default digital usage                                   |
| **Monochrome white**           | Single-color contexts, watermarks                       |
| **Monochrome dark**            | Print, light backgrounds                                |
| **Wordmark "COACH"**           | Combined with logomark or standalone in navigation      |

### Logo Construction

- Built on a **512x512px** grid
- Icon sits within a **rounded rectangle** (rx: 100) with the deep navy gradient background
- Clear space: minimum **1x the height of the pulse dot** on all sides
- Minimum size: **32x32px** digital, **0.5" (12mm)** print

### Logo Don'ts

- Do not stretch, skew, or rotate the logo
- Do not change gradient colors or directions
- Do not place on busy/cluttered backgrounds without the dark container
- Do not add drop shadows, outlines, or effects beyond the defined spec
- Do not recreate or approximate the logomark — always use the source SVG/PNG assets

---

## 3. Color System

### Primary Palette

| Role                | Swatch                                                       | HEX       | RGB        | Usage                              |
| ------------------- | ------------------------------------------------------------ | --------- | ---------- | ---------------------------------- |
| **Deep Navy**       | ![#0f172a](https://via.placeholder.com/16/0f172a/0f172a.png) | `#0f172a` | 15, 23, 42 | Primary brand color, text, headers |
| **Dark Background** | ![#1A1A2E](https://via.placeholder.com/16/1A1A2E/1A1A2E.png) | `#1A1A2E` | 26, 26, 46 | Logo background, dark UI surfaces  |
| **Midnight**        | ![#16213E](https://via.placeholder.com/16/16213E/16213E.png) | `#16213E` | 22, 33, 62 | Gradient end, dark surfaces        |

### Accent Palette (Gradient System)

| Role       | Swatch                                                       | HEX       | RGB          | Usage                                    |
| ---------- | ------------------------------------------------------------ | --------- | ------------ | ---------------------------------------- |
| **Cyan**   | ![#00D2FF](https://via.placeholder.com/16/00D2FF/00D2FF.png) | `#00D2FF` | 0, 210, 255  | Primary accent, CTAs, active states      |
| **Violet** | ![#7B61FF](https://via.placeholder.com/16/7B61FF/7B61FF.png) | `#7B61FF` | 123, 97, 255 | Secondary accent, gradient endpoints     |
| **Mint**   | ![#00F5A0](https://via.placeholder.com/16/00F5A0/00F5A0.png) | `#00F5A0` | 0, 245, 160  | Tertiary accent, success/positive states |

**Signature Gradient:**
`linear-gradient(135deg, #7B61FF 0%, #00D2FF 60%, #00F5A0 100%)`

Used on the logomark, primary buttons, progress rings, and hero elements.

### App UI Palette (Light Mode)

| Token               | HEX       | Usage                          |
| ------------------- | --------- | ------------------------------ |
| `surface.app`       | `#f4f7fb` | App background                 |
| `surface.card`      | `#ffffff` | Card backgrounds               |
| `surface.secondary` | `#edf2f9` | Secondary backgrounds          |
| `surface.tertiary`  | `#e5ebf5` | Tertiary backgrounds, dividers |
| `surface.border`    | `#dde5f0` | Borders, separators            |
| `surface.muted`     | `#c3cedf` | Disabled states, placeholders  |
| `text.primary`      | `#0b1220` | Primary body text              |
| `text.secondary`    | `#51617a` | Secondary text, labels         |
| `text.tertiary`     | `#7687a2` | Muted text, timestamps         |

### Functional Accent Colors (In-App)

| Token              | HEX       | Usage                        |
| ------------------ | --------- | ---------------------------- |
| `accent.500`       | `#06b6d4` | Primary interactive elements |
| `accent.600`       | `#0891b2` | Hover/pressed states         |
| `accent.400`       | `#22d3ee` | Highlights, selected states  |
| `brand.orange.500` | `#f97316` | Fat macro, secondary actions |

### Status Colors

| Status    | HEX       | Usage                                            |
| --------- | --------- | ------------------------------------------------ |
| `danger`  | `#e11d48` | Errors, destructive actions, over-limit warnings |
| `warning` | `#f59e0b` | Warnings, approaching limits                     |
| `success` | `#16a34a` | Completed goals, positive feedback               |

### Accessibility

- All text on `surface.card` (#ffffff) meets **WCAG AA** (4.5:1+)
- `text.primary` (#0b1220) on white = **17.5:1** contrast ratio
- `text.secondary` (#51617a) on white = **5.4:1** contrast ratio
- `accent.500` (#06b6d4) on white = **3.1:1** — use only for large text or non-text indicators
- All status colors have been tested against both light and dark surfaces

---

## 4. Typography

### Typeface: Inter

**Inter** is the sole typeface across all Coach products — mobile, web, and marketing.

| Weight          | Font Name         | Usage                                            |
| --------------- | ----------------- | ------------------------------------------------ |
| Regular (400)   | `Inter`           | Body text, descriptions, form inputs             |
| Medium (500)    | `Inter-Medium`    | Labels, secondary headings, navigation items     |
| SemiBold (600)  | `Inter-SemiBold`  | Section headings, card titles, emphasis          |
| Bold (700)      | `Inter-Bold`      | Screen titles, primary headings, key metrics     |
| ExtraBold (800) | `Inter-ExtraBold` | Logo wordmark, hero numbers, marketing headlines |

### Type Scale (Mobile)

| Level          | Size | Weight   | Line Height | Letter Spacing | Usage                              |
| -------------- | ---- | -------- | ----------- | -------------- | ---------------------------------- |
| **Display**    | 32px | Bold     | 40px        | -0.5px         | Dashboard calorie number           |
| **H1**         | 24px | Bold     | 32px        | -0.3px         | Screen titles                      |
| **H2**         | 20px | SemiBold | 28px        | -0.2px         | Section headers                    |
| **H3**         | 17px | SemiBold | 24px        | 0              | Card titles                        |
| **Body**       | 15px | Regular  | 22px        | 0              | Primary content                    |
| **Body Small** | 13px | Regular  | 18px        | 0.1px          | Secondary content, timestamps      |
| **Caption**    | 11px | Medium   | 16px        | 0.3px          | Labels, badges, footnotes          |
| **Overline**   | 10px | SemiBold | 14px        | 1.5px          | Uppercase labels (e.g., "PROTEIN") |

### Mongolian Language Considerations

- Inter has full Cyrillic support, ensuring proper rendering of Mongolian text
- Minimum body text size for Cyrillic: **14px** (Mongolian characters are denser than Latin)
- Test all UI strings in both Mongolian and English — Mongolian translations are typically 10-20% longer

---

## 5. Iconography

### Style

- **Outline style**, 1.5px stroke weight
- Rounded line caps and joins
- 24x24px base grid
- Corner radius: 2px on geometric shapes

### Icon Sources

Use icons from a consistent set (e.g., Lucide, Heroicons Outline). Do not mix filled and outline styles within the same context.

### Macro Icons (Custom)

| Macro    | Color                        | Shape          |
| -------- | ---------------------------- | -------------- |
| Calories | `accent.500` (#06b6d4)       | Ring/circle    |
| Protein  | `success` (#16a34a)          | Circle segment |
| Carbs    | `warning` (#f59e0b)          | Circle segment |
| Fat      | `brand.orange.500` (#f97316) | Circle segment |

---

## 6. Spacing & Layout

### Base Unit

**8px grid system.** All spacing, padding, and sizing should be multiples of 8px.

| Token | Value | Usage                               |
| ----- | ----- | ----------------------------------- |
| `xs`  | 4px   | Tight spacing (icon-to-label gaps)  |
| `sm`  | 8px   | Compact spacing (within cards)      |
| `md`  | 16px  | Standard spacing (between elements) |
| `lg`  | 24px  | Section spacing                     |
| `xl`  | 32px  | Screen-level padding                |
| `2xl` | 48px  | Major section breaks                |

### Card System

- Border radius: **16px** (cards), **12px** (buttons, inputs), **9999px** (pills/badges)
- Card shadow: `0 1px 3px rgba(0,0,0,0.06)`
- Card padding: **16px** standard, **12px** compact
- Card gap (between cards): **12px**

### Mobile Layout Grid

- Screen padding: **16px** horizontal
- Maximum content width: **428px** (iPhone 16 Pro Max)
- Bottom tab bar height: **83px** (including safe area)
- Status bar offset: system-defined safe area

---

## 7. Brand Voice & Tone

### Voice Characteristics

| Attribute            | Description                        | Example                                                                     |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| **Supportive**       | Encouraging, never judgmental      | "Great start today!" not "You're behind on protein"                         |
| **Direct**           | Clear, concise — no filler         | "Add 200ml water" not "Would you maybe like to consider adding some water?" |
| **Smart**            | Data-backed, knowledgeable         | "You averaged 1,800 kcal this week — 200 under your target"                 |
| **Warm**             | Conversational, human              | Uses casual Mongolian phrasing, not formal/academic                         |
| **Culturally aware** | Understands Mongolian food culture | Knows buuz, tsuivan, airag — never suggests substituting them               |

### Tone Spectrum

| Context            | Tone                    | Example                                                                                        |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------- |
| **Daily logging**  | Neutral, efficient      | "Logged: Buuz x6 — 480 kcal"                                                                   |
| **Goal achieved**  | Celebratory, warm       | "You hit your protein target 5 days in a row!"                                                 |
| **Missed goal**    | Gentle, forward-looking | "Tomorrow's a new day. Want to plan your meals?"                                               |
| **Onboarding**     | Friendly, guiding       | "Let's set up your profile — it takes about 2 minutes"                                         |
| **Errors**         | Calm, helpful           | "Couldn't connect. Check your internet and try again."                                         |
| **Weekly summary** | Analytical, encouraging | "Strong week! Calories were consistent. Protein dipped on weekends — here's why that matters." |

### Language Guidelines

- **Primary language:** Mongolian (Cyrillic script)
- **Secondary language:** English
- Use informal/friendly Mongolian — avoid overly formal or academic phrasing
- Technical nutrition terms can remain in English where common (e.g., "калори", "протейн" are already loan words)
- All UI strings must have both Mongolian and English translations via i18n

### Writing Do's and Don'ts

| Do                                        | Don't                                       |
| ----------------------------------------- | ------------------------------------------- |
| Use active voice                          | Use passive constructions                   |
| Lead with the key information             | Bury the message in filler                  |
| Use numbers for data ("6 buuz, 480 kcal") | Spell out quantities ("six pieces of buuz") |
| Celebrate progress                        | Shame or guilt-trip                         |
| Be specific ("2g over fat target")        | Be vague ("you went a little over")         |

---

## 8. Imagery & Photography

### Style Direction

- **Clean, bright, natural lighting** — no heavy filters or artificial saturation
- Focus on **real Mongolian food** — buuz, khuushuur, tsuivan, bansh, airag, suutei tsai
- Show food in **everyday contexts** — home kitchens, local restaurants, office lunches
- People shots (if used): casual, authentic, diverse age range

### Photography Don'ts

- No overly styled/Western food photography
- No stock photos with watermarks
- No artificial bokeh or extreme close-ups
- No food that doesn't exist in the Mongolian market

---

## 9. App Icon

### Current App Icon

A stylized blue geometric **"A"** shape (representing an upward arrow / mountain peak) on a light blue (#E6F4FE) background. Clean, geometric, with subtle 3D depth through gradient shading.

### Icon Specifications

- iOS: 1024x1024px source, no transparency, rounded corners applied by OS
- Android adaptive icon: separate foreground/background layers
  - Background: `#E6F4FE`
  - Foreground: Blue geometric mark
  - Monochrome: Simplified single-color version
- Notification icon: Monochrome silhouette on `#1f2028`

---

## 10. Motion & Interaction

### Animation Principles

- **Purposeful**: Every animation communicates state change or provides feedback
- **Fast**: 200-300ms for micro-interactions, 400-500ms for screen transitions
- **Smooth**: Use ease-out curves for entrances, ease-in for exits

### Key Animations

| Element           | Animation                   | Duration       |
| ----------------- | --------------------------- | -------------- |
| Card press        | Scale to 0.97 + opacity 0.8 | 150ms          |
| Screen transition | Slide from right            | 350ms          |
| Bottom sheet      | Slide up with spring        | 400ms          |
| Progress ring     | Animated fill on mount      | 600ms ease-out |
| Skeleton loader   | Shimmer left-to-right       | 1500ms loop    |
| Success feedback  | Scale bounce + checkmark    | 300ms          |

---

## 11. Multi-Channel Application

### Mobile App

Primary brand touchpoint. Full color system, typography, and interaction patterns as defined above.

### Telegram Bot (Coach AI)

- Use the Coach logomark as the bot avatar
- Text-only interface — rely on brand voice, not visuals
- Use emoji sparingly and consistently (e.g., checkmark for logged, fire for streak)

### Website (coach.mn)

- Follow the same color and typography system
- Hero sections can use the signature gradient background
- Responsive: 12-column desktop, 4-column mobile grid

### App Store / Play Store Listing

- Screenshots should show real Mongolian food and Mongolian UI text
- Feature graphic: signature gradient background with logomark
- Description: lead with the Mongolian-first positioning

---

## 12. Asset Inventory

| Asset                 | Location                                          | Format        |
| --------------------- | ------------------------------------------------- | ------------- |
| Logomark (full)       | `/logo.svg`                                       | SVG           |
| App icon (iOS)        | `/apps/mobile/assets/icon.png`                    | PNG 1024x1024 |
| App icon (Android FG) | `/apps/mobile/assets/android-icon-foreground.png` | PNG           |
| App icon (Android BG) | `/apps/mobile/assets/android-icon-background.png` | PNG           |
| App icon (Monochrome) | `/apps/mobile/assets/android-icon-monochrome.png` | PNG           |
| Splash icon           | `/apps/mobile/assets/splash-icon.png`             | PNG           |
| Notification icon     | `/apps/mobile/assets/notification-icon.png`       | PNG           |
| Favicon               | `/apps/mobile/assets/favicon.png`                 | PNG           |
| Design tokens         | `/apps/mobile/src/theme/tokens.json`              | JSON          |
| Tailwind config       | `/apps/mobile/tailwind.config.js`                 | JS            |

---

## 13. Quick Reference Card

```
Brand:       Coach (Коуч)
Tagline:     Your AI nutrition coach for Mongolia
Domain:      coach.mn
Typeface:    Inter (400, 500, 600, 700, 800)

Primary:     #0f172a (Deep Navy)
Accent:      #06b6d4 (Cyan)
Gradient:    #7B61FF → #00D2FF → #00F5A0
Surface:     #f4f7fb (App BG) / #ffffff (Cards)
Text:        #0b1220 / #51617a / #7687a2

Status:      #16a34a (Success) / #f59e0b (Warning) / #e11d48 (Danger)
Macro:       #06b6d4 (Cal) / #16a34a (Protein) / #f59e0b (Carbs) / #f97316 (Fat)

Spacing:     8px base grid
Radius:      16px cards / 12px buttons / 9999px pills
Language:    Mongolian (primary) + English
Voice:       Supportive, direct, smart, warm, culturally aware
```

---

_These guidelines are a living document. Update as the brand evolves._
