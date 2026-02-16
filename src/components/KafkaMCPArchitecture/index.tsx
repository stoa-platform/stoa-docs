// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingenierie / Christophe ABOULICAM
import React, { useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

type TabId = 'architecture' | 'topics' | 'phases' | 'usecases';
type PhaseId = 'p1' | 'p2' | 'p3' | 'p4';
type BadgeColor = 'kafka' | 'mcp' | 'sse' | 'uac' | 'accent';

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
  kafka: string;
  kafkaGlow: string;
  mcp: string;
  mcpGlow: string;
  sse: string;
  sseGlow: string;
  uac: string;
  uacGlow: string;
  danger: string;
  success: string;
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
  kafka: '#e67e22',
  kafkaGlow: 'rgba(230, 126, 34, 0.12)',
  mcp: '#10b981',
  mcpGlow: 'rgba(16, 185, 129, 0.12)',
  sse: '#8b5cf6',
  sseGlow: 'rgba(139, 92, 246, 0.12)',
  uac: '#f59e0b',
  uacGlow: 'rgba(245, 158, 11, 0.12)',
  danger: '#ef4444',
  success: '#10b981',
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
  kafka: '#d97706',
  kafkaGlow: 'rgba(217, 119, 6, 0.08)',
  mcp: '#059669',
  mcpGlow: 'rgba(5, 150, 105, 0.08)',
  sse: '#7c3aed',
  sseGlow: 'rgba(124, 58, 237, 0.08)',
  uac: '#d97706',
  uacGlow: 'rgba(217, 119, 6, 0.08)',
  danger: '#dc2626',
  success: '#059669',
};

function Badge({ color, children, C }: { color: BadgeColor; children: React.ReactNode; C: Colors }) {
  const colorMap: Record<BadgeColor, { bg: string; fg: string; border: string }> = {
    kafka: { bg: C.kafkaGlow, fg: C.kafka, border: `${C.kafka}4d` },
    mcp: { bg: C.mcpGlow, fg: C.mcp, border: `${C.mcp}4d` },
    sse: { bg: C.sseGlow, fg: C.sse, border: `${C.sse}4d` },
    uac: { bg: C.uacGlow, fg: C.uac, border: `${C.uac}4d` },
    accent: { bg: C.accentGlow, fg: C.accent, border: `${C.accent}4d` },
  };
  const s = colorMap[color];
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

function ComponentBox({ title, subtitle, icon, color, items, glow, C }: {
  title: string; subtitle: string; icon: string; color: string;
  items: string[]; glow?: string; C: Colors;
}) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${color}33`, borderRadius: '8px',
      padding: '16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(to right, transparent, ${color}, transparent)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: '10px', color: C.textMuted, fontFamily: 'var(--ifm-font-family-monospace)' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            fontSize: '11px', color: C.textMuted, padding: '3px 8px',
            background: glow || C.surfaceLight, borderRadius: '4px',
            fontFamily: 'var(--ifm-font-family-monospace)',
          }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

const topics = [
  { name: 'stoa.api.lifecycle', desc: 'API created / updated / deprecated / retired', status: 'Planned' },
  { name: 'stoa.subscription.events', desc: 'Request \u2192 Approved \u2192 Revoked', status: 'Planned' },
  { name: 'stoa.security.alerts', desc: 'Rate limit breach, anomaly detected', status: 'Planned' },
  { name: 'stoa.metering.events', desc: 'Usage tracking, billing events', status: 'LIVE' },
  { name: 'stoa.audit.trail', desc: 'All config changes, who/what/when', status: 'Planned' },
  { name: 'stoa.gateway.metrics', desc: 'Latency P95, error rates, throughput', status: 'Planned' },
  { name: 'stoa.deployment.events', desc: 'ArgoCD sync, CLI deploy, rollback', status: 'Planned' },
  { name: 'stoa.resource.lifecycle', desc: 'TTL expiry, extension, cleanup', status: 'Planned' },
];

const phases = [
  {
    id: 'p1' as PhaseId,
    title: 'Phase 1 \u2014 Kafka Event Backbone',
    badge: 'Foundation',
    badgeColor: 'kafka' as BadgeColor,
    points: '8 pts',
    desc: 'Kafka/Redpanda as internal STOA backbone. All lifecycle events flow through dedicated topics.',
    items: [
      'Control Plane \u2192 Kafka producers (8 topic families)',
      'Kafka \u2192 PostgreSQL sink (audit, replay)',
      'Kafka \u2192 Prometheus metrics bridge',
      'Topic policies versioned in Git (delivery semantics per topic)',
      'JSON Schema defined for each topic',
    ],
  },
  {
    id: 'p2' as PhaseId,
    title: 'Phase 2 \u2014 Kafka \u2192 SSE Bridge',
    badge: 'Bridge',
    badgeColor: 'sse' as BadgeColor,
    points: '5 pts',
    desc: 'Kafka Consumer that transforms events into SSE stream for the MCP Gateway.',
    items: [
      'KafkaConsumer \u2192 SSE EventSource adapter',
      'Per-tenant filtering (multi-tenant isolation)',
      'Backpressure handling (token-bucket per connection)',
      'Reconnection logic with offset tracking',
      'Health check + circuit breaker',
    ],
  },
  {
    id: 'p3' as PhaseId,
    title: 'Phase 3 \u2014 MCP Notifications',
    badge: 'AI-Native',
    badgeColor: 'mcp' as BadgeColor,
    points: '5 pts',
    desc: 'AI agents connected via MCP receive events in real-time via the notifications protocol.',
    items: [
      'MCP notifications/send for critical events',
      'Agent subscription model (opt-in per event type)',
      'Event \u2192 Tool hint (api.created \u2192 tools/list refresh)',
      'AsyncAPI 3.0 contract generation from UAC',
    ],
  },
  {
    id: 'p4' as PhaseId,
    title: 'Phase 4 \u2014 Event-Driven Governance',
    badge: 'Enterprise',
    badgeColor: 'uac' as BadgeColor,
    points: '8 pts',
    desc: 'Kafka events feed automatic governance rules and CQRS projections.',
    items: [
      'Policy-as-Event: policy change \u2192 instant propagation',
      'CQRS: write path (Control Plane) / read path (event-sourced)',
      'Saga patterns for multi-step workflows (approval chains)',
      'Dead Letter Queue + retry policies per tenant',
    ],
  },
];

const useCases = [
  {
    title: 'Agent receives "new API available"',
    flow: 'Control Plane \u2192 Kafka api.lifecycle \u2192 SSE Bridge \u2192 MCP notification \u2192 Agent refresh tools/list',
    icon: '\ud83e\udd16',
  },
  {
    title: 'Real-time security alert',
    flow: 'Gateway metrics \u2192 Kafka security.alerts \u2192 SSE Bridge \u2192 MCP notification \u2192 Agent escalates incident',
    icon: '\ud83d\udee1\ufe0f',
  },
  {
    title: 'Event-driven approval workflow',
    flow: 'Portal request \u2192 Kafka subscription.events \u2192 Saga orchestrator \u2192 Owner notification \u2192 Kafka approval \u2192 Credentials generated',
    icon: '\u2705',
  },
  {
    title: 'Immutable audit trail',
    flow: 'Any config change \u2192 Kafka audit.trail \u2192 PostgreSQL sink (append-only) \u2192 Grafana dashboard',
    icon: '\ud83d\udccb',
  },
];

const competitors = [
  { name: 'Kong', eventDriven: '\u274c', agentPush: '\u274c', kafka: 'Plugin' },
  { name: 'Gravitee', eventDriven: '\u26a0\ufe0f basic', agentPush: '\u274c', kafka: 'Connector' },
  { name: 'Apigee', eventDriven: '\u26a0\ufe0f Pub/Sub', agentPush: '\u274c', kafka: '\u274c' },
  { name: 'STOA', eventDriven: '\u2705 Native', agentPush: '\u2705 MCP', kafka: '\u2705 Core' },
];

export default function KafkaMCPArchitecture(): JSX.Element {
  const { colorMode } = useColorMode();
  const C = colorMode === 'dark' ? darkColors : lightColors;
  const [activePhase, setActivePhase] = useState<PhaseId>('p1');
  const [activeTab, setActiveTab] = useState<TabId>('architecture');

  const topicColors = [C.accent, C.mcp, C.danger, C.uac, C.sse, C.accent, C.mcp, C.uac];

  return (
    <div style={{
      fontFamily: 'var(--ifm-font-family-base)', background: C.bg, color: C.text,
      padding: '24px', borderRadius: '12px', margin: '1.5rem 0',
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px' }}>{'\u26a1'}</span>
          <h3 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: C.text }}>
            Kafka {'\u2192'} MCP Event Bridge
          </h3>
        </div>
        <p style={{ color: C.textMuted, fontSize: '14px', margin: 0, maxWidth: '700px', lineHeight: 1.6 }}>
          Event-driven architecture for STOA Platform — Kafka as internal backbone,
          SSE as transport to AI agents via MCP. Event-driven API Management.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <Badge color="kafka" C={C}>Kafka/Redpanda</Badge>
          <Badge color="sse" C={C}>SSE Transport</Badge>
          <Badge color="mcp" C={C}>MCP Protocol</Badge>
          <Badge color="uac" C={C}>UAC Contracts</Badge>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {([
          { id: 'architecture' as TabId, label: 'Architecture' },
          { id: 'topics' as TabId, label: 'Kafka Topics' },
          { id: 'phases' as TabId, label: 'Roadmap' },
          { id: 'usecases' as TabId, label: 'Use Cases' },
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

      {/* Tab Content — fixed height to prevent layout shift */}
      <div style={{ minHeight: '520px' }}>

      {/* Architecture Tab */}
      {activeTab === 'architecture' && (
        <div>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px',
            padding: '24px', marginBottom: '24px', overflowX: 'auto',
          }}>
            <div style={{
              fontSize: '11px', color: C.textDim, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: '16px',
            }}>
              Event Flow Architecture
            </div>

            {/* Main row: 4 boxes with arrows */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 40px 1fr 40px 1fr 40px 1fr',
              alignItems: 'center', gap: '8px', marginBottom: '16px', minWidth: '700px',
            }}>
              <ComponentBox C={C} title="Control Plane" subtitle="api.lifecycle events" icon={'\ud83c\udf9b\ufe0f'}
                color={C.accent} items={['API CRUD', 'Policy changes', 'Config updates']} glow={C.accentGlow} />
              <span style={{ color: C.kafka, textAlign: 'center', fontSize: '16px' }}>{'\u2192'}</span>
              <ComponentBox C={C} title="Kafka / Redpanda" subtitle="event backbone" icon={'\ud83d\udce1'}
                color={C.kafka} items={['8 topic families', 'Multi-partition', 'Retention 7d']} glow={C.kafkaGlow} />
              <span style={{ color: C.sse, textAlign: 'center', fontSize: '16px' }}>{'\u2192'}</span>
              <ComponentBox C={C} title="SSE Bridge" subtitle="kafka \u2192 sse adapter" icon={'\ud83d\udd17'}
                color={C.sse} items={['Tenant filtering', 'Backpressure', 'Reconnection']} glow={C.sseGlow} />
              <span style={{ color: C.mcp, textAlign: 'center', fontSize: '16px' }}>{'\u2192'}</span>
              <ComponentBox C={C} title="MCP Gateway" subtitle="agent notifications" icon={'\ud83e\udd16'}
                color={C.mcp} items={['notifications/send', 'tools/list refresh', 'Real-time push']} glow={C.mcpGlow} />
            </div>

            {/* Sinks row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 40px 1fr 1fr 1fr',
              gap: '8px', marginTop: '8px', minWidth: '700px',
            }}>
              <div />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ color: C.textDim, fontSize: '10px' }}>fan-out</span>
                <span style={{ color: C.textDim }}>{'\u2193'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { icon: '\ud83d\uddc4\ufe0f', name: 'PostgreSQL', role: 'audit sink' },
                  { icon: '\ud83d\udcca', name: 'Prometheus', role: 'metrics' },
                  { icon: '\ud83d\udccb', name: 'Grafana', role: 'dashboards' },
                ].map((sink, i) => (
                  <div key={i} style={{
                    background: C.surfaceLight, borderRadius: '6px', padding: '8px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '14px' }}>{sink.icon}</div>
                    <div style={{ fontSize: '10px', color: C.textMuted }}>{sink.name}</div>
                    <div style={{ fontSize: '9px', color: C.textDim }}>{sink.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div style={{
            background: `linear-gradient(135deg, ${C.kafkaGlow}, ${C.mcpGlow})`,
            border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: C.text }}>
              {'\ud83d\udca1'} Why this is a kill feature
            </div>
            <p style={{ fontSize: '12px', color: C.textMuted, margin: 0, lineHeight: 1.7 }}>
              No APIM platform (Kong, Gravitee, Apigee) offers{' '}
              <strong style={{ color: C.mcp }}>push event-driven delivery to AI agents</strong>.
              The state of the art is polling. With Kafka {'\u2192'} SSE {'\u2192'} MCP, STOA becomes the first platform
              where an AI agent is <strong style={{ color: C.kafka }}>notified in real-time</strong> when the API catalog changes,
              when a subscription is approved, or when a security alert fires.
              It bridges <strong style={{ color: C.sse }}>event-driven architecture</strong> and{' '}
              <strong style={{ color: C.mcp }}>AI-native API management</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Topics Tab */}
      {activeTab === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topics.map((topic, i) => (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px',
            }}>
              <div style={{
                width: '4px', height: '36px', borderRadius: '2px',
                background: topicColors[i % topicColors.length], flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '13px',
                  fontWeight: 500, color: topicColors[i % topicColors.length],
                }}>
                  {topic.name}
                </div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{topic.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {topic.status === 'LIVE' ? (
                  <Badge color="mcp" C={C}>LIVE</Badge>
                ) : (
                  <Badge color="accent" C={C}>Planned</Badge>
                )}
              </div>
            </div>
          ))}

          <div style={{
            marginTop: '12px', padding: '12px 16px', background: C.surfaceLight, borderRadius: '8px',
          }}>
            <div style={{
              fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '11px',
              color: C.textDim, marginBottom: '6px',
            }}>
              # topic policy example (Git-versioned)
            </div>
            <pre style={{
              fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '11px',
              color: C.textMuted, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
{`topic: stoa.api.lifecycle
deliverySemantics: EXACTLY_ONCE
partitions: 6
retention: 7d
consumers:
  - sse-bridge (group: stoa-sse)
  - audit-sink (group: stoa-audit)
  - metrics-bridge (group: stoa-metrics)`}
            </pre>
          </div>
        </div>
      )}

      {/* Phases Tab */}
      {activeTab === 'phases' && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* Phase selector */}
          <div style={{
            width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            {phases.map((phase) => (
              <button key={phase.id} onClick={() => setActivePhase(phase.id)} style={{
                textAlign: 'left', padding: '12px',
                border: `1px solid ${activePhase === phase.id ? C[phase.badgeColor] + '55' : C.border}`,
                borderRadius: '8px',
                background: activePhase === phase.id ? C[phase.badgeColor] + '11' : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', color: 'inherit',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 600,
                    color: activePhase === phase.id ? C[phase.badgeColor] : C.textMuted,
                  }}>
                    {phase.badge}
                  </span>
                  <span style={{
                    fontSize: '10px', color: C.textDim,
                    fontFamily: 'var(--ifm-font-family-monospace)',
                  }}>
                    {phase.points}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                  {phase.title.split(' \u2014 ')[0]}
                </div>
              </button>
            ))}
            <div style={{ padding: '12px', borderTop: `1px solid ${C.border}`, marginTop: '4px' }}>
              <div style={{
                fontSize: '10px', color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Total
              </div>
              <div style={{
                fontSize: '18px', fontWeight: 700, color: C.accent,
                fontFamily: 'var(--ifm-font-family-monospace)',
              }}>
                26 pts
              </div>
            </div>
          </div>

          {/* Phase detail */}
          {phases.filter(p => p.id === activePhase).map((phase) => (
            <div key={phase.id} style={{
              flex: 1, minWidth: '300px', background: C.surface,
              border: `1px solid ${C[phase.badgeColor]}33`, borderRadius: '12px', padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Badge color={phase.badgeColor} C={C}>{phase.badge}</Badge>
                <span style={{
                  fontSize: '10px', color: C.textDim,
                  fontFamily: 'var(--ifm-font-family-monospace)',
                }}>
                  {phase.points}
                </span>
              </div>
              <h4 style={{
                fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0', color: C[phase.badgeColor],
              }}>
                {phase.title}
              </h4>
              <p style={{ fontSize: '13px', color: C.textMuted, lineHeight: 1.6, margin: '0 0 16px 0' }}>
                {phase.desc}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {phase.items.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px',
                    background: C.surfaceLight, borderRadius: '6px', fontSize: '12px',
                    color: C.text, lineHeight: 1.5,
                  }}>
                    <span style={{ color: C[phase.badgeColor], flexShrink: 0, marginTop: '1px' }}>{'\u25b8'}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Use Cases Tab */}
      {activeTab === 'usecases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {useCases.map((uc, i) => (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>{uc.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{uc.title}</span>
              </div>
              <div style={{
                fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '11px', color: C.textMuted,
                background: C.surfaceLight, padding: '10px 12px', borderRadius: '6px',
                lineHeight: 1.8, wordBreak: 'break-word',
              }}>
                {uc.flow.split(' \u2192 ').map((step, j, arr) => (
                  <span key={j}>
                    <span style={{
                      color: step.includes('Kafka') ? C.kafka :
                             step.includes('SSE') ? C.sse :
                             step.includes('MCP') ? C.mcp :
                             step.includes('Agent') ? C.mcp :
                             step.includes('Portal') ? C.accent :
                             step.includes('Gateway') ? C.uac :
                             C.text,
                    }}>
                      {step}
                    </span>
                    {j < arr.length - 1 && <span style={{ color: C.textDim }}> {'\u2192'} </span>}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Competitor comparison */}
          <div style={{
            marginTop: '8px', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: C.text }}>
              {'\ud83c\udfc1'} Competitive landscape
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {competitors.map((c, i) => (
                <div key={i} style={{
                  padding: '10px', borderRadius: '6px', textAlign: 'center',
                  background: c.name === 'STOA' ? C.mcpGlow : C.surfaceLight,
                  border: c.name === 'STOA' ? `1px solid ${C.mcp}33` : '1px solid transparent',
                }}>
                  <div style={{
                    fontSize: '12px', fontWeight: 600, marginBottom: '8px',
                    color: c.name === 'STOA' ? C.mcp : C.text,
                  }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px' }}>
                    Event-driven: {c.eventDriven}
                  </div>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px' }}>
                    Agent push: {c.agentPush}
                  </div>
                  <div style={{ fontSize: '10px', color: C.textMuted }}>
                    Kafka: {c.kafka}
                  </div>
                </div>
              ))}
            </div>
            <p style={{
              fontSize: '10px', color: C.textDim, margin: '12px 0 0 0', lineHeight: 1.5, fontStyle: 'italic',
            }}>
              Feature comparisons based on publicly available documentation as of 2026-02.
              Product capabilities change frequently. Trademarks belong to their respective owners.
            </p>
          </div>
        </div>
      )}

      </div>{/* end tab content wrapper */}

      {/* Footer */}
      <div style={{
        marginTop: '24px', padding: '12px 0', borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
      }}>
        <span style={{ fontSize: '11px', color: C.textDim }}>
          STOA Platform {'\u2014'} Kafka {'\u2192'} MCP Event Bridge Architecture
        </span>
        <span style={{ fontSize: '11px', color: C.textDim, fontFamily: 'var(--ifm-font-family-monospace)' }}>
          ADR-043 {'\u00b7'} Feb 2026
        </span>
      </div>
    </div>
  );
}
