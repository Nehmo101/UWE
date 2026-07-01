Ink/terracotta button matching UWE's Parchment OS. Use `primary` for the main action (solid ink), `accent` for the signature terracotta call-to-action, `secondary`/`subtle`/`ghost` for lesser actions, `danger` for destructive.

```jsx
<Button variant="accent" icon={<Plus size={16} />}>Welt anlegen</Button>
<Button variant="primary">Speichern</Button>
<Button variant="ghost" size="sm">Abbrechen</Button>
```

Render as a link with `as="a" href="…"`. Sizes: `sm` · `md` (default) · `lg`.
