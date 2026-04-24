---
name: ReliefSync Design System
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#b81a36'
  on-secondary: '#ffffff'
  secondary-container: '#ff5263'
  on-secondary-container: '#5b0013'
  tertiary: '#004e32'
  on-tertiary: '#ffffff'
  tertiary-container: '#006844'
  on-tertiary-container: '#72e9af'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#ffdad9'
  secondary-fixed-dim: '#ffb3b4'
  on-secondary-fixed: '#40000a'
  on-secondary-fixed-variant: '#920024'
  tertiary-fixed: '#82f9be'
  tertiary-fixed-dim: '#65dca4'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  h1:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.55'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style

This design system is built on the pillars of **reliability, urgency, and clarity**. As a civic-tech platform serving communities in crisis, the visual language prioritizes information density without sacrificing breathing room. The style is a "white-first" **Corporate Modern** aesthetic—utilizing expansive white space to reduce cognitive load during high-stress situations.

The target audience ranges from government officials and NGO coordinators to local volunteers. Therefore, the UI evokes a sense of institutional stability through structured layouts, while remaining accessible and "human" through soft geometry and high-legibility type. The goal is to move the user from a state of panic to a state of action through a calm, organized interface.

## Colors

The palette is engineered for high-contrast accessibility and semantic clarity. 

- **Primary Blue (#0052CC):** Reserved for primary actions, navigation, and brand-critical touchpoints. It represents authority and stability.
- **Emergency Red (#D73449):** Used sparingly but decisively for high-urgency alerts, SOS signals, and critical resource shortages.
- **Success Green (#36B37E):** Indicates completed missions, verified safety, and resolved requests.
- **Neutral Grays:** We use a "cool gray" scale. The base surface is `#F4F5F7`, allowing pure white `#FFFFFF` cards to "pop" and define the primary content areas. Text uses a dark navy-tinted gray (`#172B4D`) to ensure maximum readability against white backgrounds.

## Typography

The design system utilizes **Inter** exclusively to leverage its exceptional legibility in digital interfaces. 

- **Headlines:** Use a slightly tighter letter-spacing and heavier weights (600-700) to create a strong visual anchor for page titles.
- **Body Text:** Set with generous line-heights (1.5x) to prevent eye fatigue during long reading sessions (e.g., situational reports or field guides).
- **Labels:** Small, all-caps or bolded labels are used for metadata like timestamps, location coordinates, and status badges to ensure they are scannable at a glance.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** with fixed maximum constraints for desktop readability. 

- **Grid System:** A 12-column grid is used for desktop, 8-column for tablets, and 4-column for mobile. 
- **Rhythm:** An 8px base unit drives all spacing decisions. Consistent padding (typically 24px) inside cards creates the "premium" feel.
- **White Space:** Generous "macro-spacing" between sections (48px+) helps separate distinct relief efforts or data sets, preventing the user from feeling overwhelmed by information density.

## Elevation & Depth

To maintain the "clean" aesthetic, the design system uses **Ambient Shadows** rather than heavy borders.

- **Level 0 (Flat):** Used for the main background (`#F4F5F7`) and secondary input fields.
- **Level 1 (Raised):** Used for standard content cards. Shadow: `0px 2px 4px rgba(0, 0, 0, 0.05)`. This creates a subtle lift from the background.
- **Level 2 (Interactive/Overlay):** Used for hover states, dropdowns, and modals. Shadow: `0px 8px 16px rgba(0, 82, 204, 0.08)`. Note the subtle blue tint in the shadow to reinforce the primary brand color.
- **Tonal Layers:** High-priority alerts do not use shadows but rather solid, high-contrast fills (Emergency Red) to break the depth hierarchy and demand immediate attention.

## Shapes

The shape language is approachable and modern, moving away from harsh edges to foster a sense of community and support.

- **Standard Radius:** 8px (0.5rem) for buttons and input fields.
- **Large Radius:** 16px (1rem) for content cards and containers, providing a distinct "SaaS" appearance.
- **Extra Large Radius:** 24px (1.5rem) for featured promotional banners or search bars.
- **Pill Shapes:** Used exclusively for status tags and badges (e.g., "Active," "Resolved") to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid #0052CC with white text. 8px border radius.
- **Secondary:** Outline #0052CC with 1.5px border.
- **Urgent/Danger:** Solid #D73449. Used for "Report Incident" or "SOS."

### Cards
Cards are the primary container. They must have a white background, 16px border radius, and Level 1 elevation. Padding is strictly 24px to ensure internal elements breathe.

### Inputs & Forms
Inputs use a light gray border (#D1D5DB) that shifts to Primary Blue on focus. Labels are always positioned above the field in `label-bold` style for maximum accessibility.

### Status Badges
Small, pill-shaped indicators. They use 10% opacity fills of the semantic color with 100% opacity text of the same color (e.g., a light red background with dark red text for "Critical").

### Additional Components
- **Incident Feed Items:** List items with a vertical urgency-strip on the left (Red for critical, Blue for info).
- **Progress Trackers:** Slim, rounded bars using Success Green to show relief fund or resource distribution status.
- **Map Pins:** Custom outlined icons with a white core and a 2px colored halo corresponding to the incident type.