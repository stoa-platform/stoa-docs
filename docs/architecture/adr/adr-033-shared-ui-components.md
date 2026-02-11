---
sidebar_position: 33
title: "ADR-033: Shared UI Components"
description: "Decides the theme abstraction and reusable component patterns shared between Console and Portal React applications."
keywords: [shared components, UI, theme abstraction, React, Console, Portal, design system]
---

# ADR-033: Shared UI Components — Theme Abstraction & Reusable Patterns

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | CAB-1100 |

## Context

STOA has two React frontends:
- **Console (control-plane-ui)** — For API providers and platform admins
- **Portal** — For API consumers and developers

Both applications need:
- Consistent look and feel
- Dark/light theme support
- Common UI patterns (toasts, dialogs, empty states)

### The Problem

> "We're duplicating UI components across console and portal. Changes require updating both."

## Decision

Create a **shared component library** in `shared/` that both frontends import.

### Structure

```
shared/
├── components/
│   ├── Breadcrumb/
│   │   └── Breadcrumb.tsx
│   ├── Celebration/
│   │   └── Celebration.tsx
│   ├── Collapsible/
│   │   └── Collapsible.tsx
│   ├── CommandPalette/
│   │   ├── CommandPalette.tsx
│   │   └── CommandPalette.css
│   ├── ConfirmDialog/
│   │   └── ConfirmDialog.tsx
│   ├── EmptyState/
│   │   └── EmptyState.tsx
│   ├── FormWizard/
│   │   └── FormWizard.tsx
│   ├── Skeleton/
│   │   └── Skeleton.tsx
│   ├── ThemeToggle/
│   │   └── ThemeToggle.tsx
│   └── Toast/
│       ├── Toast.tsx
│       └── Toast.css
│
└── contexts/
    └── ThemeContext.tsx
```

## Components

### ThemeContext

Centralized theme management:

```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const resolvedTheme = useResolvedTheme(theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### CommandPalette

Global search and navigation:

```typescript
interface CommandPaletteProps {
  commands: Command[];
  onSelect: (command: Command) => void;
  placeholder?: string;
}

// Usage
<CommandPalette
  commands={[
    { id: 'apis', label: 'Go to APIs', action: () => navigate('/apis') },
    { id: 'tenants', label: 'Go to Tenants', action: () => navigate('/tenants') },
  ]}
  onSelect={(cmd) => cmd.action()}
/>
```

### Toast

Notification system:

```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onClose: () => void;
}

// Usage via hook
const { toast } = useToast();
toast.success('API created successfully');
toast.error('Failed to delete tenant');
```

### EmptyState

Consistent empty state displays:

```typescript
<EmptyState
  icon={<FolderOpen />}
  title="No APIs found"
  description="Create your first API to get started"
  action={<Button onClick={createApi}>Create API</Button>}
/>
```

## Import Pattern

Frontends import from relative path:

```typescript
// control-plane-ui/src/App.tsx
import { ThemeProvider } from '../../shared/contexts/ThemeContext';
import { Toast } from '../../shared/components/Toast';
import { CommandPalette } from '../../shared/components/CommandPalette';
```

## Design System Principles

| Principle | Implementation |
|-----------|----------------|
| **Consistency** | Same components in both apps |
| **Accessibility** | ARIA labels, keyboard navigation |
| **Responsive** | Mobile-first, breakpoints |
| **Dark Mode** | CSS variables, system preference |

## Consequences

### Positive

- **DRY** — No duplicate component code
- **Consistency** — Identical UX across apps
- **Maintainability** — Single source of truth
- **Theme Sync** — Dark mode works everywhere

### Negative

- **Coupling** — Changes affect both apps
- **Build Complexity** — Shared code in monorepo
- **Versioning** — No independent releases

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Breaking changes | PR requires testing both apps |
| Build complexity | Vite alias configuration |
| Versioning | Monorepo ensures sync |

## References

- [shared/components/](https://github.com/stoa-platform/stoa/tree/main/shared/components/)
- [shared/contexts/](https://github.com/stoa-platform/stoa/tree/main/shared/contexts/)
- [ADR-003 — Monorepo Architecture](./adr-003-monorepo-architecture.md)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
