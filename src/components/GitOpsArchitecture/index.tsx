// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingenierie / Christophe ABOULICAM
import React, { useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

type TabId = 'architecture' | 'promotion' | 'tenants' | 'roadmap';
type EnvId = 'dev' | 'staging' | 'prod';

interface Colors {
  bg: string;
  surface: string;
  surfaceLight: string;
  border: string;
  borderActive: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentGlow: string;
  git: string;
  gitGlow: string;
  argocd: string;
  argocdGlow: string;
  console: string;
  consoleGlow: string;
  tenant: string;
  tenantGlow: string;
  success: string;
  warning: string;
  danger: string;
}

const darkColors: Colors = {
  bg: '#0a0e17',
  surface: '#111827',
  surfaceLight: '#1a2332',
  border: '#1e3a5f',
  borderActive: '#3b82f6',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#475569',
  accent: '#3b82f6',
  accentGlow: 'rgba(59, 130, 246, 0.15)',
  git: '#f97316',
  gitGlow: 'rgba(249, 115, 22, 0.12)',
  argocd: '#10b981',
  argocdGlow: 'rgba(16, 185, 129, 0.12)',
  console: '#8b5cf6',
  consoleGlow: 'rgba(139, 92, 246, 0.12)',
  tenant: '#06b6d4',
  tenantGlow: 'rgba(6, 182, 212, 0.12)',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const lightColors: Colors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceLight: '#f1f5f9',
  border: '#e2e8f0',
  borderActive: '#4f46e5',
  text: '#1e293b',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  accent: '#4f46e5',
  accentGlow: 'rgba(79, 70, 229, 0.08)',
  git: '#ea580c',
  gitGlow: 'rgba(234, 88, 12, 0.08)',
  argocd: '#059669',
  argocdGlow: 'rgba(5, 150, 105, 0.08)',
  console: '#7c3aed',
  consoleGlow: 'rgba(124, 58, 237, 0.08)',
  tenant: '#0891b2',
  tenantGlow: 'rgba(8, 145, 178, 0.08)',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

type BadgeVariant = 'git' | 'argocd' | 'console' | 'tenant' | 'accent';

function Badge({ variant, children, C }: { variant: BadgeVariant; children: React.ReactNode; C: Colors }) {
  const colorMap: Record<BadgeVariant, string> = {
    git: C.git,
    argocd: C.argocd,
    console: C.console,
    tenant: C.tenant,
    accent: C.accent,
  };
  const c = colorMap[variant];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      fontFamily: 'var(--ifm-font-family-monospace)',
      background: `${c}20`,
      color: c,
      border: `1px solid ${c}40`,
    }}>
      {children}
    </span>
  );
}

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'architecture', label: 'Architecture', icon: '\u{1F3D7}' },
  { id: 'promotion', label: 'Promotion', icon: '\u{1F680}' },
  { id: 'tenants', label: 'Multi-Tenant', icon: '\u{1F3E2}' },
  { id: 'roadmap', label: 'Roadmap', icon: '\u{1F4C5}' },
];

interface EnvConfig {
  id: EnvId;
  name: string;
  consoleMode: string;
  uiWrite: boolean;
  gitWrite: string;
  approval: string;
  color: string;
}

const envs: EnvConfig[] = [
  { id: 'dev', name: 'Development', consoleMode: 'Full Write', uiWrite: true, gitWrite: 'Optional', approval: 'None', color: '#10b981' },
  { id: 'staging', name: 'Staging', consoleMode: 'Full Write', uiWrite: true, gitWrite: 'Optional', approval: 'PR optional', color: '#f59e0b' },
  { id: 'prod', name: 'Production', consoleMode: 'Read + Promote', uiWrite: false, gitWrite: 'PR mandatory', approval: 'PR + CODEOWNERS', color: '#ef4444' },
];

interface PromotionStep {
  number: number;
  title: string;
  description: string;
  detail: string;
  icon: string;
}

const promotionSteps: PromotionStep[] = [
  { number: 1, title: 'Generate PR', description: 'Console creates a Git PR', detail: 'Copy staging UAC overlay to prod overlay. Apply env-specific transformations (URLs, replicas). Attach staging health report (latency, error rate, uptime).', icon: '\u{1F4DD}' },
  { number: 2, title: 'Review & Approve', description: 'Human reviews the diff', detail: 'PR created with full diff visible. CODEOWNERS review required. Staging metrics attached as PR comment. Console shows PR status in real-time.', icon: '\u{1F50D}' },
  { number: 3, title: 'Merge & Deploy', description: 'ArgoCD reconciles to cluster', detail: 'Squash merge to main. ArgoCD detects change in prod overlay. Gateway config updated. Progressive delivery: canary 10% \u2192 50% \u2192 100%.', icon: '\u{2699}' },
  { number: 4, title: 'Verify & Rollback', description: 'Metrics-driven validation', detail: 'Prometheus monitors error rate and latency. If degradation detected: automatic rollback via git revert + ArgoCD sync. Console shows deployment progress with live metrics.', icon: '\u{2705}' },
];

interface RoadmapPhase {
  id: string;
  title: string;
  timeline: string;
  items: string[];
  status: 'done' | 'planned' | 'future';
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: 'p1', title: 'Foundation', timeline: 'Q1 2026',
    items: ['UAC CRD schema with Kustomize overlay support', 'stoa-config/ repository structure (base + overlays)', 'ArgoCD ApplicationSet for multi-env', 'Console environment selector (tab-based UI)'],
    status: 'done',
  },
  {
    id: 'p2', title: 'Console Modes', timeline: 'Q2 2026',
    items: ['Console read-only mode for production', '"Edit" button generates Git PR via GitHub API', 'PR status tracking in Console', 'Staging health report on promotion PRs'],
    status: 'planned',
  },
  {
    id: 'p3', title: 'Promote with Confidence', timeline: 'Q2-Q3 2026',
    items: ['"Promote to Prod" button with env transforms', 'CODEOWNERS integration for approval routing', 'Drift detection dashboard in Console', 'Progressive delivery (Argo Rollouts canary)'],
    status: 'planned',
  },
  {
    id: 'p4', title: 'Enterprise', timeline: 'Q3-Q4 2026',
    items: ['Multi-tenant environment isolation', 'Configurable approval policies per tenant', 'Automated rollback on metric degradation', 'Audit log export (DORA, SOC 2)'],
    status: 'future',
  },
];

export default function GitOpsArchitecture(): React.ReactElement {
  const { colorMode } = useColorMode();
  const C = colorMode === 'dark' ? darkColors : lightColors;
  const [activeTab, setActiveTab] = useState<TabId>('architecture');
  const [activeEnv, setActiveEnv] = useState<EnvId>('prod');
  const [activeStep, setActiveStep] = useState(0);

  const containerStyle: React.CSSProperties = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    overflow: 'hidden',
    fontFamily: 'var(--ifm-font-family-base)',
    marginBottom: '1.5rem',
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: `1px solid ${C.border}`,
    background: C.surface,
    padding: '0 8px',
    overflowX: 'auto',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
  };

  const panelStyle = (isActive: boolean): React.CSSProperties => ({
    gridRow: 1,
    gridColumn: 1,
    visibility: isActive ? 'visible' : 'hidden',
    padding: '24px',
  });

  // Tab: Architecture
  function ArchitecturePanel() {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Git Is the Control Plane
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            All API configuration stored in Git as declarative YAML. Database caches what Git declares.
          </div>
        </div>

        {/* Git Repository box */}
        <div style={{
          background: C.gitGlow,
          border: `1px solid ${C.git}40`,
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px' }}>{'\u{1F4C2}'}</span>
            <span style={{ fontWeight: 700, color: C.git, fontSize: '14px' }}>Git Repository</span>
            <Badge variant="git" C={C}>Source of Truth</Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              padding: '10px',
            }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: C.text, marginBottom: '4px', fontFamily: 'var(--ifm-font-family-monospace)' }}>base/</div>
              <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5 }}>
                apis/ &middot; gateways/ &middot; policies/ &middot; consumers/
              </div>
              <div style={{ fontSize: '10px', color: C.textDim, marginTop: '4px' }}>Shared across all envs</div>
            </div>
            {envs.map(env => (
              <div key={env.id} style={{
                background: C.surface,
                border: `1px solid ${activeEnv === env.id ? env.color : C.border}`,
                borderRadius: '6px',
                padding: '10px',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }} onClick={() => setActiveEnv(env.id)}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: C.text, marginBottom: '4px', fontFamily: 'var(--ifm-font-family-monospace)' }}>overlays/{env.id}/</div>
                <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5 }}>
                  kustomization.yaml &middot; patches/
                </div>
                <div style={{ fontSize: '10px', color: env.color, marginTop: '4px' }}>{env.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ArgoCD Sync arrows */}
        <div style={{ textAlign: 'center', padding: '8px 0', color: C.argocd, fontSize: '12px', fontWeight: 600 }}>
          {'\u25BC'} ArgoCD Sync {'\u25BC'}
        </div>

        {/* Environment clusters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {envs.map(env => (
            <div key={env.id} style={{
              background: activeEnv === env.id ? `${env.color}15` : C.surface,
              border: `1px solid ${activeEnv === env.id ? env.color : C.border}`,
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onClick={() => setActiveEnv(env.id)}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: env.color, marginBottom: '4px' }}>
                {env.name}
              </div>
              <div style={{ fontSize: '11px', color: C.textMuted }}>Cluster</div>
              <div style={{
                marginTop: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: `${env.color}20`,
                fontSize: '10px',
                fontWeight: 600,
                color: env.color,
              }}>
                {env.consoleMode}
              </div>
            </div>
          ))}
        </div>

        {/* Console mode details for selected env */}
        <div style={{
          marginTop: '16px',
          background: C.surfaceLight,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          padding: '14px',
        }}>
          {(() => {
            const env = envs.find(e => e.id === activeEnv);
            if (!env) return null;
            return (
              <>
                <div style={{ fontWeight: 700, fontSize: '13px', color: env.color, marginBottom: '8px' }}>
                  Console in {env.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: C.textMuted }}>UI Write: </span>
                    <span style={{ color: env.uiWrite ? C.success : C.danger, fontWeight: 600 }}>
                      {env.uiWrite ? 'Direct API call' : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: C.textMuted }}>Git Write: </span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{env.gitWrite}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: C.textMuted }}>Approval: </span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{env.approval}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Tab: Promotion
  function PromotionPanel() {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Promote with Confidence
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            Console automates the promotion workflow while keeping Git as the authority.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {promotionSteps.map((step, i) => (
            <div key={step.number} style={{
              background: activeStep === i ? C.accentGlow : C.surface,
              border: `1px solid ${activeStep === i ? C.borderActive : C.border}`,
              borderRadius: '8px',
              padding: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onClick={() => setActiveStep(i)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: activeStep === i ? C.accent : C.surfaceLight,
                  color: activeStep === i ? '#fff' : C.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  flexShrink: 0,
                }}>
                  {step.number}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>
                    {step.icon} {step.title}
                  </div>
                  <div style={{ fontSize: '12px', color: C.textMuted }}>{step.description}</div>
                </div>
                {i < promotionSteps.length - 1 && (
                  <div style={{ color: C.textDim, fontSize: '16px' }}>{'\u25B6'}</div>
                )}
              </div>
              {activeStep === i && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: `1px solid ${C.border}`,
                  fontSize: '12px',
                  color: C.textMuted,
                  lineHeight: 1.6,
                }}>
                  {step.detail}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Console workflow visibility */}
        <div style={{
          marginTop: '16px',
          background: C.consoleGlow,
          border: `1px solid ${C.console}40`,
          borderRadius: '8px',
          padding: '14px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: C.console, marginBottom: '8px' }}>
            Console Workflow Visibility
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { label: 'PR Created', icon: '\u{1F4DD}' },
              { label: 'Approved', icon: '\u2705' },
              { label: 'Merged', icon: '\u{1F500}' },
              { label: 'Syncing', icon: '\u{1F504}' },
              { label: 'Live', icon: '\u{1F7E2}' },
            ].map((state, i, arr) => (
              <React.Fragment key={state.label}>
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: C.text,
                  fontWeight: 500,
                }}>
                  {state.icon} {state.label}
                </div>
                {i < arr.length - 1 && (
                  <span style={{ color: C.textDim, alignSelf: 'center', fontSize: '12px' }}>{'\u2192'}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tab: Multi-Tenant
  function TenantsPanel() {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Multi-Tenant Environment Isolation
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            Each tenant owns its environment progression, scoped by namespace. Approvers are tenant-managed, not platform-wide.
          </div>
        </div>

        {/* Tenant directory structure */}
        <div style={{
          background: C.tenantGlow,
          border: `1px solid ${C.tenant}40`,
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px' }}>{'\u{1F4C2}'}</span>
            <span style={{ fontWeight: 700, color: C.tenant, fontSize: '14px' }}>stoa-config/tenants/</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {['acme-corp', 'globex'].map(tenant => (
              <div key={tenant} style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                padding: '12px',
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: C.text, marginBottom: '8px', fontFamily: 'var(--ifm-font-family-monospace)' }}>
                  {tenant}/
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'var(--ifm-font-family-monospace)' }}>
                    {'\u251C\u2500'} base/
                  </div>
                  <div style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'var(--ifm-font-family-monospace)' }}>
                    {'\u2514\u2500'} overlays/
                  </div>
                  <div style={{ display: 'flex', gap: '4px', paddingLeft: '16px', flexWrap: 'wrap' }}>
                    {envs.map(env => (
                      <span key={env.id} style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        background: `${env.color}20`,
                        color: env.color,
                        fontFamily: 'var(--ifm-font-family-monospace)',
                        fontWeight: 600,
                      }}>
                        {env.id}/
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3-layer approval routing */}
        <div style={{ fontWeight: 700, fontSize: '14px', color: C.text, marginBottom: '10px' }}>
          Tenant-Owned Approval Routing (3 Layers)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            {
              layer: 'Control Plane API',
              badge: 'Source of Truth',
              color: C.console,
              glow: C.consoleGlow,
              detail: 'Tenant owner manages approvers via Console UI. Self-service, API-driven, changes tracked in audit log.',
            },
            {
              layer: 'GitHub Actions',
              badge: 'Enforcement',
              color: C.git,
              glow: C.gitGlow,
              detail: 'On PR to prod overlay: queries CP API for approvers, checks PR approvals match, blocks merge if no match.',
            },
            {
              layer: 'ArgoCD AppProject',
              badge: 'Defense in Depth',
              color: C.argocd,
              glow: C.argocdGlow,
              detail: 'Per-tenant project with scoped destinations (namespace: tenant-*). Even if GH Actions bypassed, unauthorized syncs blocked.',
            },
          ].map((l, i) => (
            <div key={i} style={{
              background: l.glow,
              border: `1px solid ${l.color}40`,
              borderRadius: '8px',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: l.color }}>Layer {i + 1}: {l.layer}</span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: `${l.color}20`,
                  color: l.color,
                  fontWeight: 600,
                }}>
                  {l.badge}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: C.textMuted, lineHeight: 1.5 }}>{l.detail}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Tab: Roadmap
  function RoadmapPanel() {
    const statusColors = {
      done: C.success,
      planned: C.warning,
      future: C.textDim,
    };
    const statusLabels = {
      done: 'Completed',
      planned: 'In Progress',
      future: 'Planned',
    };

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Implementation Roadmap
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            4-phase rollout from foundation to enterprise multi-tenancy.
          </div>
        </div>

        {/* Phase status legend */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
          {(['done', 'planned', 'future'] as const).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: statusColors[s],
              }} />
              <span style={{ fontSize: '11px', color: C.textMuted }}>{statusLabels[s]}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {roadmapPhases.map((phase, i) => (
            <div key={phase.id} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              padding: '14px',
              position: 'relative',
              borderLeft: `3px solid ${statusColors[phase.status]}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>
                    Phase {i + 1}: {phase.title}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: `${statusColors[phase.status]}20`,
                    color: statusColors[phase.status],
                    fontWeight: 600,
                  }}>
                    {statusLabels[phase.status]}
                  </span>
                </div>
                <Badge variant="accent" C={C}>{phase.timeline}</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                {phase.items.map((item, j) => (
                  <div key={j} style={{
                    fontSize: '12px',
                    color: C.textMuted,
                    padding: '6px 8px',
                    background: C.surfaceLight,
                    borderRadius: '4px',
                    lineHeight: 1.4,
                  }}>
                    <span style={{ color: statusColors[phase.status], marginRight: '4px' }}>
                      {phase.status === 'done' ? '\u2713' : '\u25CB'}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Key differentiators */}
        <div style={{
          marginTop: '16px',
          background: C.gitGlow,
          border: `1px solid ${C.git}40`,
          borderRadius: '8px',
          padding: '14px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: C.git, marginBottom: '8px' }}>
            Born GitOps Differentiators
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px', fontSize: '12px', color: C.textMuted }}>
            {[
              'Git = primary control plane (not sync target)',
              'PR reviews = native approval workflow',
              'git revert = instant rollback',
              'Kustomize overlays = env-specific config',
              'ArgoCD = continuous reconciliation',
              'Console generates YAML (users never write it)',
            ].map((d, i) => (
              <div key={i} style={{ padding: '4px 0' }}>
                <span style={{ color: C.git, marginRight: '4px' }}>{'\u25B8'}</span>{d}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Tab bar */}
      <div style={tabBarStyle}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? C.accent : C.textMuted,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'var(--ifm-font-family-base)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Panels — CSS Grid overlay for stable height */}
      <div style={gridStyle}>
        <div style={panelStyle(activeTab === 'architecture')}>
          <ArchitecturePanel />
        </div>
        <div style={panelStyle(activeTab === 'promotion')}>
          <PromotionPanel />
        </div>
        <div style={panelStyle(activeTab === 'tenants')}>
          <TenantsPanel />
        </div>
        <div style={panelStyle(activeTab === 'roadmap')}>
          <RoadmapPanel />
        </div>
      </div>
    </div>
  );
}
