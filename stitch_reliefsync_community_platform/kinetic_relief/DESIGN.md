---
name: Kinetic Relief
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fd'
  surface-container: '#ededf8'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#f0f0fb'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#bc000a'
  on-secondary: '#ffffff'
  secondary-container: '#e2241f'
  on-secondary-container: '#fffbff'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4aa'
  on-secondary-fixed: '#410001'
  on-secondary-fixed-variant: '#930005'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  section-gap: 120px
---

## Brand & Style

This design system is built on the principle of **Cinematic Utility**. It merges the high-fidelity aesthetics of premium consumer electronics with the mission-critical reliability of civic infrastructure. The visual narrative centers on clarity and calm amidst crisis, utilizing a "White-First" philosophy to ensure maximum legibility and a sense of institutional stability.

The design style is a sophisticated blend of **Glassmorphism** and **Minimalism**. It uses translucent layers to imply depth and organizational hierarchy without clutter. 3D realistic visuals serve as the primary storytelling medium, featuring hyper-detailed, soft-lit coordination illustrations (e.g., matte-finish medical kits, translucent logistics drones, and glowing data nodes) to evoke a futuristic yet tangible feel.

## Colors

The palette is engineered for high-stakes environments where visual priority is paramount. 

*   **Primary Blue (#0052CC):** Used for core navigation, primary actions, and branding. It represents deep-seated trust and systemic stability.
*   **Emergency Red (#FF3B30):** Reserved exclusively for alerts, critical status updates, and "Immediate Action Required" triggers.
*   **Surface Foundation:** A pristine white base is augmented by ultra-subtle cool grays to define structural boundaries. 
*   **Gradients:** Use modern, soft-transition gradients for 3D elements and primary call-to-actions to add a premium, "illuminated" depth.

## Typography

This design system utilizes **Inter** exclusively to achieve a systematic, utilitarian, yet modern appearance. The typographic scale is highly contrasted.

Headlines should utilize tight letter-spacing and bold weights to command attention, while body copy remains generous in line-height for maximum readability during high-stress operations. Labels and metadata should be rendered in semi-bold uppercase or medium-weight small caps to differentiate system information from user-generated content.

## Layout & Spacing

The layout follows a **Fixed-Width Grid** model for the desktop experience to maintain a premium "editorial" feel. A 12-column grid is used with generous 24px gutters.

The spacing rhythm is based on a strict 8px linear scale. Large-scale white space (Section Gaps) is intentionally used to separate high-level concepts, preventing the user from feeling overwhelmed by data. On interior dashboards, the density may increase, but the outer product pages must maintain "breathing room" consistent with Apple-level polish.

## Elevation & Depth

Depth is the defining characteristic of this design system. It is achieved through three specific techniques:

1.  **Glassmorphism:** Secondary surfaces (like sidebars and floating menus) use a 20px Backdrop Blur with a 1px white inner-border at 40% opacity.
2.  **Ambient Shadows:** Objects do not use "black" shadows. Instead, use long, diffused shadows with a tint of the primary blue (e.g., `rgba(0, 82, 204, 0.08)`) and a 40px–60px blur radius for high-elevation components like cards.
3.  **Z-Axis Stacking:** 3D illustrations should physically overlap UI panels to break the 2D plane, creating a "holographic" coordination effect.

## Shapes

The shape language is "Sophisticated Organic." While the core structure is mathematical and grid-aligned, all corners are softened to evoke friendliness and accessibility. 

Standard components (inputs, buttons) use a **0.5rem (8px)** radius. High-level containers and cards use **1rem (16px)** to create a distinct "pod" look. 3D assets should follow these curves, avoiding sharp edges in favor of chamfered, premium finishes.

## Components

*   **Primary Buttons:** Large, pill-shaped or rounded-lg with a subtle top-down gradient. On hover, they should emit a soft glow matching the primary blue.
*   **Glass Cards:** Used for information modules. Must include a 1px border stroke (semi-transparent white) to define the edge against the white background.
*   **Input Fields:** Ghost-style with a subtle gray background (#F5F7FA). On focus, the border transitions to Primary Blue with a soft outer glow.
*   **Emergency Chips:** Vibrant Red (#FF3B30) backgrounds with white text. These should have a subtle "pulse" animation for active critical alerts.
*   **3D Illustration Placeholders:** Strategic "Hero" zones where 3D realistic renders interact with the text, often using "z-index" layering to appear as if they are floating in front of the typography.
*   **Status Indicators:** Small, glowing "breathing" dots to indicate real-time connectivity and active relief efforts.