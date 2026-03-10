// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingenierie / Christophe ABOULICAM
import React, { useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

type TabId = 'architecture' | 'modes' | 'migration' | 'status';
type ModeId = 'edge-mcp' | 'sidecar' | 'proxy' | 'shadow';

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
  edgeMcp: string;
  edgeMcpGlow: string;
  sidecar: string;
  sidecarGlow: string;
  proxy: string;
  proxyGlow: string;
  shadow: string;
  shadowGlow: string;
  success: string;
  warning: string;
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
  edgeMcp: '#10b981',
  edgeMcpGlow: 'rgba(16, 185, 129, 0.12)',
  sidecar: '#f59e0b',
  sidecarGlow: 'rgba(245, 158, 11, 0.12)',
  proxy: '#3b82f6',
  proxyGlow: 'rgba(59, 130, 246, 0.12)',
  shadow: '#8b5cf6',
  shadowGlow: 'rgba(139, 92, 246, 0.12)',
  success: '#10b981',
  warning: '#f59e0b',
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
  edgeMcp: '#059669',
  edgeMcpGlow: 'rgba(5, 150, 105, 0.08)',
  sidecar: '#d97706',
  sidecarGlow: 'rgba(217, 119, 6, 0.08)',
  proxy: '#4f46e5',
  proxyGlow: 'rgba(79, 70, 229, 0.08)',
  shadow: '#7c3aed',
  shadowGlow: 'rgba(124, 58, 237, 0.08)',
  success: '#059669',
  warning: '#d97706',
};

type BadgeVariant = 'edgeMcp' | 'sidecar' | 'proxy' | 'shadow' | 'accent';

function Badge({ variant, children, C }: { variant: BadgeVariant; children: React.ReactNode; C: Colors }) {
  const map: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
    edgeMcp: { bg: C.edgeMcpGlow, fg: C.edgeMcp, border: `${C.edgeMcp}4d` },
    sidecar: { bg: C.sidecarGlow, fg: C.sidecar, border: `${C.sidecar}4d` },
    proxy: { bg: C.proxyGlow, fg: C.proxy, border: `${C.proxy}4d` },
    shadow: { bg: C.shadowGlow, fg: C.shadow, border: `${C.shadow}4d` },
    accent: { bg: C.accentGlow, fg: C.accent, border: `${C.accent}4d` },
  };
  const s = map[variant];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
}

interface ModeData {
  id: ModeId;
  title: string;
  icon: string;
  badge: BadgeVariant;
  status: string;
  statusColor: string;
  position: string;
  pitch: string;
  features: string[];
  cli: string;
  targets: string;
}

const modes: ModeData[] = [
  {
    id: 'edge-mcp',
    title: 'Edge-MCP',
    icon: '\ud83e\udd16',
    badge: 'edgeMcp',
    status: 'Production',
    statusColor: 'success',
    position: 'AI agents front',
    pitch: 'AI-native API gateway implementing Model Context Protocol. SSE transport, JSON-RPC 2.0, dynamic tool registry from K8s CRDs.',
    features: [
      'SSE transport for real-time streaming',
      'JSON-RPC 2.0 message handling',
      'Dynamic tool registry from K8s CRDs',
      'OAuth2/OIDC via Keycloak',
      'OPA policy evaluation',
    ],
    cli: 'stoa-gateway --mode=edge-mcp --port=3001',
    targets: 'Claude, GPT, custom LLM agents',
  },
  {
    id: 'sidecar',
    title: 'Sidecar',
    icon: '\ud83d\udd17',
    badge: 'sidecar',
    status: 'Q2 2026',
    statusColor: 'warning',
    position: 'Behind 3rd-party GW',
    pitch: 'Deploy behind existing API gateways to add STOA capabilities without replacing infrastructure. Zero disruption.',
    features: [
      'Observability injection (OpenTelemetry)',
      'Metering events to Kafka for billing',
      'UAC compliance validation',
      'Error snapshot capture for debugging',
      'PII masking (RGPD compliance)',
    ],
    cli: 'stoa-gateway --mode=sidecar --primary-gateway=kong',
    targets: 'Kong, webMethods, Apigee, Envoy',
  },
  {
    id: 'proxy',
    title: 'Proxy',
    icon: '\ud83d\udee1\ufe0f',
    badge: 'proxy',
    status: 'Q3 2026',
    statusColor: 'warning',
    position: 'Inline active',
    pitch: 'Classic API gateway with full policy enforcement. For greenfield deployments or full gateway replacement.',
    features: [
      'OPA policy evaluation (blocking)',
      'Rate limiting per tenant/consumer',
      'Request/response transformation',
      'Circuit breaker patterns',
      'mTLS termination',
    ],
    cli: 'stoa-gateway --mode=proxy --upstream=http://backend:8080',
    targets: 'Internal APIs, new deployments',
  },
  {
    id: 'shadow',
    title: 'Shadow',
    icon: '\ud83d\udd0d',
    badge: 'shadow',
    status: 'Deferred',
    statusColor: 'warning',
    position: 'Passive observer',
    pitch: 'Passive traffic observation for legacy API discovery. Deploy for 2 weeks, auto-generate interface contracts. Zero code changes.',
    features: [
      'Zero modification to requests/responses',
      'Capture traffic patterns',
      'Auto-generate UAC contracts',
      'Human-in-the-loop validation',
      'PII detection before storage',
    ],
    cli: 'stoa-gateway --mode=shadow --target=http://legacy-erp:8080',
    targets: 'Legacy ERPs, undocumented APIs',
  },
];

const migrationSteps = [
  { week: '1-2', phase: 'Shadow', desc: 'Observe traffic, generate UAC drafts', color: 'shadow' as BadgeVariant },
  { week: '3', phase: 'Review', desc: 'Human validates contracts, adjusts', color: 'accent' as BadgeVariant },
  { week: '4', phase: 'Canary 10%', desc: '10% through Proxy, 90% direct', color: 'proxy' as BadgeVariant },
  { week: '5-6', phase: 'Ramp Up', desc: '50% \u2192 80% \u2192 100% through Proxy', color: 'proxy' as BadgeVariant },
  { week: '7+', phase: 'Full Proxy', desc: 'Full enforcement, Shadow for audit', color: 'edgeMcp' as BadgeVariant },
];

export default function GatewayModesArchitecture() {
  const { colorMode } = useColorMode();
  const C = colorMode === 'dark' ? darkColors : lightColors;
  const [activeTab, setActiveTab] = useState<TabId>('architecture');
  const [activeMode, setActiveMode] = useState<ModeId>('edge-mcp');

  const modeColor = (id: ModeId): string => {
    const map: Record<ModeId, string> = {
      'edge-mcp': C.edgeMcp,
      'sidecar': C.sidecar,
      'proxy': C.proxy,
      'shadow': C.shadow,
    };
    return map[id];
  };

  const modeGlow = (id: ModeId): string => {
    const map: Record<ModeId, string> = {
      'edge-mcp': C.edgeMcpGlow,
      'sidecar': C.sidecarGlow,
      'proxy': C.proxyGlow,
      'shadow': C.shadowGlow,
    };
    return map[id];
  };

  return (
    <div style={{
      fontFamily: 'var(--ifm-font-family-base)', background: C.bg, color: C.text,
      padding: '24px', borderRadius: '12px', margin: '1.5rem 0',
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px' }}>{'\ud83c\udf10'}</span>
          <h3 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: C.text }}>
            Unified Gateway Architecture
          </h3>
        </div>
        <p style={{ color: C.textMuted, fontSize: '14px', margin: 0, maxWidth: '700px', lineHeight: 1.6 }}>
          Single <code style={{ fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '13px', color: C.accent }}>stoa-gateway</code> binary
          with 4 deployment modes via <code style={{ fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '13px', color: C.accent }}>--mode</code> flag.
          From passive observation to full AI-native gateway.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <Badge variant="edgeMcp" C={C}>Edge-MCP</Badge>
          <Badge variant="sidecar" C={C}>Sidecar</Badge>
          <Badge variant="proxy" C={C}>Proxy</Badge>
          <Badge variant="shadow" C={C}>Shadow</Badge>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {([
          { id: 'architecture' as TabId, label: 'Architecture' },
          { id: 'modes' as TabId, label: 'Mode Details' },
          { id: 'migration' as TabId, label: 'Migration Path' },
          { id: 'status' as TabId, label: 'Roadmap' },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 16px',
            border: `1px solid ${activeTab === tab.id ? C.borderActive : C.border}`,
            borderRadius: '6px',
            background: activeTab === tab.id ? C.accentGlow : 'transparent',
            color: activeTab === tab.id ? C.accent : C.textMuted,
            fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content — CSS Grid overlay */}
      <div style={{ display: 'grid' }}>

      {/* Architecture Tab */}
      <div style={{
        gridRow: 1, gridColumn: 1,
        visibility: activeTab === 'architecture' ? 'visible' : 'hidden',
      }}>
        <div>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px',
            padding: '24px', marginBottom: '16px', overflowX: 'auto',
          }}>
            <div style={{
              fontSize: '11px', color: C.textDim, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: '16px',
            }}>
              Deployment Modes Overview
            </div>

            {/* Central binary */}
            <div style={{
              background: C.surfaceLight, border: `1px solid ${C.accent}33`, borderRadius: '8px',
              padding: '12px 16px', textAlign: 'center', marginBottom: '16px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: C.accent }}>stoa-gateway</div>
              <div style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'var(--ifm-font-family-monospace)' }}>
                Rust + Tokio + Axum
              </div>
            </div>

            <div style={{ textAlign: 'center', color: C.textDim, marginBottom: '12px', fontSize: '16px' }}>
              {'\u2193'} --mode=
            </div>

            {/* 4 mode boxes */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px', minWidth: '600px',
            }}>
              {modes.map((m) => (
                <div key={m.id} style={{
                  background: C.surface, border: `1px solid ${modeColor(m.id)}33`,
                  borderRadius: '8px', padding: '14px', position: 'relative', overflow: 'hidden',
                  cursor: 'pointer', transition: 'all 0.2s',
                }} onClick={() => { setActiveMode(m.id); setActiveTab('modes'); }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                    background: `linear-gradient(to right, transparent, ${modeColor(m.id)}, transparent)`,
                  }} />
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '24px' }}>{m.icon}</span>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: modeColor(m.id), marginTop: '4px' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '2px' }}>{m.position}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px' }}>
                    {m.features.slice(0, 3).map((f, i) => (
                      <div key={i} style={{
                        fontSize: '10px', color: C.textMuted, padding: '2px 6px',
                        background: modeGlow(m.id), borderRadius: '3px',
                        fontFamily: 'var(--ifm-font-family-monospace)',
                      }}>
                        {f.split('(')[0].trim()}
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <span style={{ color: C.textDim, fontSize: '10px' }}>{'\u2193'}</span>
                    <div style={{ fontSize: '10px', color: C.textDim, marginTop: '2px' }}>{m.targets}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complexity gradient */}
          <div style={{
            background: `linear-gradient(135deg, ${C.shadowGlow}, ${C.edgeMcpGlow})`,
            border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: C.text }}>
              {'\ud83d\udcc8'} Complexity Progression
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}>
              {modes.map((m, i) => (
                <React.Fragment key={m.id}>
                  <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                    <Badge variant={m.badge} C={C}>{m.title}</Badge>
                    <div style={{ fontSize: '10px', color: C.textDim, marginTop: '4px' }}>
                      {['Read-only', '+ Transforms', '+ Adapters', '+ MCP layer'][i]}
                    </div>
                  </div>
                  {i < modes.length - 1 && (
                    <span style={{ color: C.textDim, fontSize: '14px', margin: '0 4px' }}>{'\u2192'}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Details Tab */}
      <div style={{
        gridRow: 1, gridColumn: 1,
        visibility: activeTab === 'modes' ? 'visible' : 'hidden',
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* Mode selector */}
          <div style={{
            width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            {modes.map((m) => (
              <button key={m.id} onClick={() => setActiveMode(m.id)} style={{
                textAlign: 'left', padding: '12px',
                border: `1px solid ${activeMode === m.id ? modeColor(m.id) + '55' : C.border}`,
                borderRadius: '8px',
                background: activeMode === m.id ? modeGlow(m.id) : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', color: 'inherit',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{m.icon}</span>
                  <div>
                    <div style={{
                      fontSize: '12px', fontWeight: 600,
                      color: activeMode === m.id ? modeColor(m.id) : C.textMuted,
                    }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: '10px', color: C.textDim }}>{m.status}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Mode detail panel */}
          {modes.filter(m => m.id === activeMode).map((m) => (
            <div key={m.id} style={{
              flex: 1, minWidth: '300px', background: C.surface,
              border: `1px solid ${modeColor(m.id)}33`, borderRadius: '12px', padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>{m.icon}</span>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: modeColor(m.id) }}>
                    {m.title} Mode
                  </h4>
                  <div style={{ fontSize: '11px', color: C.textMuted }}>{m.position}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <Badge variant={m.badge} C={C}>{m.status}</Badge>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: C.textMuted, lineHeight: 1.6, margin: '0 0 16px 0' }}>
                {m.pitch}
              </p>

              <div style={{
                fontSize: '11px', color: C.textDim, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '8px',
              }}>
                Features
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {m.features.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px',
                    background: C.surfaceLight, borderRadius: '6px', fontSize: '12px',
                    color: C.text, lineHeight: 1.5,
                  }}>
                    <span style={{ color: modeColor(m.id), flexShrink: 0, marginTop: '1px' }}>{'\u25b8'}</span>
                    {f}
                  </div>
                ))}
              </div>

              <div style={{
                fontSize: '11px', color: C.textDim, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '8px',
              }}>
                Usage
              </div>
              <div style={{
                fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '12px',
                color: modeColor(m.id), background: C.surfaceLight, padding: '10px 12px',
                borderRadius: '6px',
              }}>
                $ {m.cli}
              </div>

              <div style={{
                marginTop: '12px', fontSize: '11px', color: C.textDim,
              }}>
                Targets: <span style={{ color: C.text }}>{m.targets}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Migration Tab */}
      <div style={{
        gridRow: 1, gridColumn: 1,
        visibility: activeTab === 'migration' ? 'visible' : 'hidden',
      }}>
        <div>
          <div style={{
            fontSize: '11px', color: C.textDim, textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '16px',
          }}>
            Shadow {'\u2192'} Proxy Migration Path
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {migrationSteps.map((step, i) => (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <div style={{
                  width: '60px', textAlign: 'center', flexShrink: 0,
                  fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '12px', color: C.textMuted,
                }}>
                  Week {step.week}
                </div>
                <div style={{
                  width: '4px', height: '36px', borderRadius: '2px', flexShrink: 0,
                  background: (() => {
                    const map: Record<string, string> = {
                      edgeMcp: C.edgeMcp, sidecar: C.sidecar, proxy: C.proxy, shadow: C.shadow, accent: C.accent,
                    };
                    return map[step.color] || C.accent;
                  })(),
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{step.phase}</div>
                  <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{step.desc}</div>
                </div>
                <Badge variant={step.color} C={C}>{step.phase.split(' ')[0]}</Badge>
              </div>
            ))}
          </div>

          {/* Key insight */}
          <div style={{
            background: `linear-gradient(135deg, ${C.shadowGlow}, ${C.proxyGlow})`,
            border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: C.text }}>
              {'\ud83d\udca1'} The killer feature
            </div>
            <p style={{ fontSize: '12px', color: C.textMuted, margin: 0, lineHeight: 1.7 }}>
              Got legacy APIs with no docs? Deploy STOA in{' '}
              <strong style={{ color: C.shadow }}>Shadow mode</strong> for 2 weeks.
              It observes traffic and <strong style={{ color: C.shadow }}>auto-generates interface contracts</strong>.
              Then you decide: keep just the docs, or activate{' '}
              <strong style={{ color: C.proxy }}>governance</strong>.
              Your backends don&apos;t change a single line of code.
            </p>
          </div>
        </div>
      </div>

      {/* Roadmap Tab */}
      <div style={{
        gridRow: 1, gridColumn: 1,
        visibility: activeTab === 'status' ? 'visible' : 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {([
            { phase: 'Phase 1', time: 'Now', title: 'ADR + Documentation', done: true },
            { phase: 'Phase 2', time: 'Q2 2026', title: 'Rust gateway + edge-mcp port', done: false },
            { phase: 'Phase 3', time: 'Q3 2026', title: 'Proxy + Sidecar modes', done: false },
            { phase: 'Phase 4', time: 'Q4 2026', title: 'Shadow mode (after security review)', done: false },
          ]).map((p, i) => (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
              padding: '16px', display: 'flex', alignItems: 'center', gap: '16px',
              opacity: p.done ? 0.7 : 1,
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: p.done ? C.edgeMcpGlow : C.surfaceLight,
                border: `2px solid ${p.done ? C.edgeMcp : C.border}`,
                fontSize: '14px',
              }}>
                {p.done ? '\u2705' : '\ud83d\udcc5'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{p.phase}</span>
                  <span style={{
                    fontSize: '10px', color: C.textDim,
                    fontFamily: 'var(--ifm-font-family-monospace)',
                  }}>
                    {p.time}
                  </span>
                </div>
                <div style={{
                  fontSize: '12px', color: C.textMuted, marginTop: '4px',
                  textDecoration: p.done ? 'line-through' : 'none',
                }}>
                  {p.title}
                </div>
              </div>
            </div>
          ))}

          {/* Mode status grid */}
          <div style={{
            marginTop: '8px', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: C.text }}>
              Mode Implementation Status
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {modes.map((m) => (
                <div key={m.id} style={{
                  padding: '12px', borderRadius: '6px', textAlign: 'center',
                  background: m.status === 'Production' ? C.edgeMcpGlow : C.surfaceLight,
                  border: `1px solid ${m.status === 'Production' ? C.edgeMcp + '33' : 'transparent'}`,
                }}>
                  <span style={{ fontSize: '20px' }}>{m.icon}</span>
                  <div style={{
                    fontSize: '12px', fontWeight: 600, marginTop: '4px',
                    color: modeColor(m.id),
                  }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '4px' }}>
                    {m.status === 'Production' ? '\u2705 Production' :
                     m.status === 'Deferred' ? '\u23f8\ufe0f Deferred' :
                     `\ud83d\udccb ${m.status}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      </div>{/* end tab content grid */}

      {/* Footer */}
      <div style={{
        marginTop: '24px', padding: '12px 0', borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
      }}>
        <span style={{ fontSize: '11px', color: C.textDim }}>
          STOA Platform {'\u2014'} Unified Gateway Architecture
        </span>
        <span style={{ fontSize: '11px', color: C.textDim, fontFamily: 'var(--ifm-font-family-monospace)' }}>
          ADR-024 {'\u00b7'} Jan 2026
        </span>
      </div>
    </div>
  );
}
