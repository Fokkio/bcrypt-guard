# Accessibility QA

## Automated release gate

`npm run a11y` checks the packaged HTML/CSS source for:

- skip link, main and navigation landmarks;
- one top-level heading;
- polite dynamic status announcements;
- visible focus styling and no positive `tabindex`;
- no non-semantic inline click targets;
- reduced-motion handling; and
- WCAG AA contrast for core text and action color pairs.

The installed `a11y-audit` skill scanner was also run directly against
`desktop/index.html` on 2026-08-13 and reported no issue after remediation.
Its CSS batch contrast check reported all detected pairs passing AA normal-text
contrast.

## Source-level keyboard and focus review

- Navigation, actions, inputs, disclosure widgets, and links use native HTML
  controls in DOM reading order.
- Every text input has a visible label; authorization uses a fieldset and legend.
- The first focusable control is “Skip to main content.”
- Focus uses a three-pixel visible outline and is not removed.
- View changes move focus to the visible page heading.
- Progress and error changes use a polite live region.
- There is no modal, custom listbox, drag interaction, or keyboard trap.

## Final artifact checks still required

Before public release, repeat keyboard-only navigation and 200% text scaling on
the downloaded GitHub Actions executable. A Windows screen-reader pass is also
recommended but is not claimed by the automated gate.
