Dark-ink sidebar navigation (Parchment OS signature). Place on `--uwe-sidebar-bg`. Active item gets a terracotta left-border. Items take an optional Lucide `icon` and a `badge` count.

```jsx
<SidebarNav sections={[
  { title: "Welt", items: [
    { label: "Übersicht", href: "#", icon: <Home size={16}/>, active: true },
    { label: "NPCs", href: "#", badge: 14 },
    { label: "Orte", href: "#" },
  ]},
]} />
```
