---
sidebar_position: 33
title: "ADR-033 : Composants UI Partagés"
description: "Décide de l'abstraction de thème et des patterns de composants réutilisables partagés entre les applications React Console et Portal."
keywords: [composants partagés, UI, abstraction de thème, React, Console, Portal, design system]
---

# ADR-033 : Composants UI Partagés — Abstraction de Thème & Patterns Réutilisables

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-06 |
| **Linear** | CAB-1100 |

## Contexte

STOA dispose de deux frontends React :
- **Console (control-plane-ui)** — Pour les fournisseurs d'API et les administrateurs de plateforme
- **Portal** — Pour les consommateurs d'API et les développeurs

Les deux applications ont besoin de :
- Cohérence visuelle et d'expérience
- Support des thèmes sombre/clair
- Patterns UI communs (toasts, dialogues, états vides)

### Le Problème

> « Nous dupliquons des composants UI entre la console et le portal. Les modifications nécessitent de mettre à jour les deux. »

## Décision

Créer une **bibliothèque de composants partagés** dans `shared/` que les deux frontends importent.

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

## Composants

### ThemeContext

Gestion centralisée du thème :

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

Recherche et navigation globales :

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

Système de notifications :

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

Affichages d'état vide cohérents :

```typescript
<EmptyState
  icon={<FolderOpen />}
  title="No APIs found"
  description="Create your first API to get started"
  action={<Button onClick={createApi}>Create API</Button>}
/>
```

## Pattern d'Import

Les frontends importent depuis un chemin relatif :

```typescript
// control-plane-ui/src/App.tsx
import { ThemeProvider } from '../../shared/contexts/ThemeContext';
import { Toast } from '../../shared/components/Toast';
import { CommandPalette } from '../../shared/components/CommandPalette';
```

## Principes du Design System

| Principe | Implémentation |
|----------|---------------|
| **Cohérence** | Mêmes composants dans les deux applications |
| **Accessibilité** | Labels ARIA, navigation au clavier |
| **Responsive** | Mobile-first, breakpoints |
| **Mode Sombre** | Variables CSS, préférence système |

## Conséquences

### Positives

- **DRY** — Pas de code de composant dupliqué
- **Cohérence** — UX identique entre les applications
- **Maintenabilité** — Source unique de vérité
- **Synchronisation du thème** — Le mode sombre fonctionne partout

### Négatives

- **Couplage** — Les modifications affectent les deux applications
- **Complexité de build** — Code partagé dans le monorepo
- **Versionning** — Pas de releases indépendantes

### Atténuations

| Défi | Atténuation |
|------|-------------|
| Changements majeurs | La PR nécessite de tester les deux applications |
| Complexité de build | Configuration d'alias Vite |
| Versionning | Le monorepo assure la synchronisation |

## Références

- [shared/components/](https://github.com/stoa-platform/stoa/tree/main/shared/components/)
- [shared/contexts/](https://github.com/stoa-platform/stoa/tree/main/shared/contexts/)
- [ADR-003 — Architecture Monorepo](./adr-003-monorepo-architecture.md)
