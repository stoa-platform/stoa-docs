// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingenierie / Christophe ABOULICAM
import React, { useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

type TabId = 'timeline' | 'shadow' | 'parity';

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
  python: string;
  pythonGlow: string;
  rust: string;
  rustGlow: string;
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
  python: '#3776ab',
  pythonGlow: 'rgba(55, 118, 171, 0.12)',
  rust: '#f74c00',
  rustGlow: 'rgba(247, 76, 0, 0.12)',
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
  python: '#306998',
  pythonGlow: 'rgba(48, 105, 152, 0.08)',
  rust: '#c83200',
  rustGlow: 'rgba(200, 50, 0, 0.08)',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'timeline', label: 'Migration Timeline', icon: '\u{1F4C5}' },
  { id: 'shadow', label: 'Shadow Validation', icon: '\u{1F50D}' },
  { id: 'parity', label: 'Feature Parity', icon: '\u{2705}' },
];

interface Phase {
  id: string;
  quarter: string;
  title: string;
  language: 'python' | 'rust' | 'both';
  percentage: string;
  description: string;
  scope: string;
  validation: string;
}

const phases: Phase[] = [
  { id: 'p1', quarter: 'Q1 2026', title: 'Python Production', language: 'python', percentage: '100% Python', description: 'Python mcp-gateway handles all production traffic. Baseline metrics established.', scope: 'Baseline metrics', validation: 'Performance benchmarks recorded' },
  { id: 'p2', quarter: 'Q2 2026', title: 'Rust Edge-MCP', language: 'both', percentage: 'Canary', description: 'Rust stoa-gateway deployed as canary. Shadow mirror validates request/response parity.', scope: 'Rust edge-mcp mode', validation: 'Shadow mirror comparison' },
  { id: 'p3', quarter: 'Q3 2026', title: 'Rust Majority', language: 'rust', percentage: 'Majority', description: 'Rust handles proxy and sidecar modes. Python enters feature freeze.', scope: 'Rust proxy + sidecar', validation: 'Canary deployment' },
  { id: 'p4', quarter: 'Q4 2026', title: 'Rust Complete', language: 'rust', percentage: '100% Rust', description: 'Full migration complete. Shadow mode implemented in Rust. Python deprecated.', scope: 'Rust shadow mode', validation: 'Full migration' },
];

interface FeatureRow {
  name: string;
  python: 'done' | 'na';
  rust: 'done' | 'progress' | 'planned';
}

const features: FeatureRow[] = [
  { name: 'MCP SSE Transport', python: 'done', rust: 'done' },
  { name: 'Tool Registry', python: 'done', rust: 'done' },
  { name: 'OPA Policy Evaluation', python: 'done', rust: 'done' },
  { name: 'Keycloak JWT', python: 'done', rust: 'done' },
  { name: 'OpenTelemetry', python: 'done', rust: 'done' },
  { name: 'Semantic Cache', python: 'done', rust: 'planned' },
  { name: 'Error Snapshots', python: 'done', rust: 'planned' },
  { name: 'K8s CRD Watcher', python: 'done', rust: 'planned' },
];

interface PerfMetric {
  metric: string;
  python: string;
  rustTarget: string;
  improvement: string;
}

const perfMetrics: PerfMetric[] = [
  { metric: 'P50 latency', python: '15ms', rustTarget: '5ms', improvement: '3x' },
  { metric: 'P99 latency', python: '80ms', rustTarget: '20ms', improvement: '4x' },
  { metric: 'RPS per pod', python: '1,000', rustTarget: '5,000', improvement: '5x' },
  { metric: 'Memory', python: '512MB', rustTarget: '64MB', improvement: '8x' },
  { metric: 'Cold start', python: '3s', rustTarget: '100ms', improvement: '30x' },
];

export default function MigrationArchitecture(): React.ReactElement {
  const { colorMode } = useColorMode();
  const C = colorMode === 'dark' ? darkColors : lightColors;
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [activePhase, setActivePhase] = useState(0);

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

  const gridStyle: React.CSSProperties = { display: 'grid' };

  const panelStyle = (isActive: boolean): React.CSSProperties => ({
    gridRow: 1,
    gridColumn: 1,
    visibility: isActive ? 'visible' : 'hidden',
    padding: '24px',
  });

  function langColor(lang: 'python' | 'rust' | 'both') {
    if (lang === 'python') return C.python;
    if (lang === 'rust') return C.rust;
    return C.accent;
  }

  // Tab: Timeline
  function TimelinePanel() {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Python {'\u2192'} Rust Migration Timeline
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            Phased migration with shadow validation. No disruption to production.
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          display: 'flex',
          height: '8px',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '16px',
          background: C.surfaceLight,
        }}>
          {phases.map((p, i) => (
            <div key={p.id} style={{
              flex: 1,
              background: langColor(p.language),
              opacity: i <= activePhase ? 1 : 0.2,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }} onClick={() => setActivePhase(i)} />
          ))}
        </div>

        {/* Phase cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {phases.map((phase, i) => (
            <div key={phase.id} style={{
              background: activePhase === i ? `${langColor(phase.language)}10` : C.surface,
              border: `1px solid ${activePhase === i ? langColor(phase.language) : C.border}`,
              borderRadius: '8px',
              padding: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onClick={() => setActivePhase(i)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: activePhase === i ? '10px' : '0' }}>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: `${langColor(phase.language)}20`,
                  color: langColor(phase.language),
                  fontWeight: 700,
                  fontSize: '12px',
                  fontFamily: 'var(--ifm-font-family-monospace)',
                  flexShrink: 0,
                }}>
                  {phase.quarter}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{phase.title}</span>
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: C.textMuted }}>{phase.percentage}</span>
                </div>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: langColor(phase.language),
                  flexShrink: 0,
                }} />
              </div>
              {activePhase === i && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: C.textMuted, lineHeight: 1.6, marginBottom: '8px' }}>
                    {phase.description}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                    <span><span style={{ color: C.textDim }}>Scope:</span> <span style={{ color: C.text }}>{phase.scope}</span></span>
                    <span><span style={{ color: C.textDim }}>Validation:</span> <span style={{ color: C.text }}>{phase.validation}</span></span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.python }} />
            <span style={{ fontSize: '11px', color: C.textMuted }}>Python</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.rust }} />
            <span style={{ fontSize: '11px', color: C.textMuted }}>Rust</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.accent }} />
            <span style={{ fontSize: '11px', color: C.textMuted }}>Both (shadow)</span>
          </div>
        </div>
      </div>
    );
  }

  // Tab: Shadow Validation
  function ShadowPanel() {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Shadow Mirror Validation
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            During Phase 2, both implementations run in parallel. Python serves traffic; Rust shadows and compares.
          </div>
        </div>

        {/* Request flow diagram */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          {/* Request */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: C.accentGlow,
              border: `1px solid ${C.accent}40`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: C.accent,
            }}>
              {'\u{1F4E8}'} Incoming Request
            </div>
          </div>
          <div style={{ textAlign: 'center', color: C.textDim, fontSize: '16px', marginBottom: '8px' }}>{'\u25BC'}</div>

          {/* Load Balancer */}
          <div style={{
            background: C.surfaceLight,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: '12px', color: C.textMuted }}>Load Balancer</span>
          </div>

          {/* Python + Rust side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'stretch' }}>
            {/* Python */}
            <div style={{
              background: C.pythonGlow,
              border: `1px solid ${C.python}40`,
              borderRadius: '8px',
              padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: C.python, marginBottom: '6px' }}>
                {'\u{1F40D}'} Python
              </div>
              <div style={{
                padding: '3px 8px',
                borderRadius: '4px',
                background: `${C.python}20`,
                color: C.python,
                fontSize: '10px',
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: '8px',
              }}>
                PRIMARY
              </div>
              <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5 }}>
                Response returned to client
              </div>
            </div>

            {/* Mirror arrow */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: C.textDim, marginBottom: '2px' }}>mirror</div>
                <div style={{ color: C.textDim }}>{'\u2194'}</div>
              </div>
            </div>

            {/* Rust */}
            <div style={{
              background: C.rustGlow,
              border: `1px solid ${C.rust}40`,
              borderRadius: '8px',
              padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: C.rust, marginBottom: '6px' }}>
                {'\u{2699}'} Rust
              </div>
              <div style={{
                padding: '3px 8px',
                borderRadius: '4px',
                background: `${C.rust}20`,
                color: C.rust,
                fontSize: '10px',
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: '8px',
              }}>
                SHADOW
              </div>
              <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5 }}>
                Response compared, not returned
              </div>
            </div>
          </div>

          {/* Comparison metrics */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Response body diff', 'Latency delta', 'Error rate'].map(m => (
              <div key={m} style={{
                padding: '4px 10px',
                borderRadius: '4px',
                background: C.surfaceLight,
                border: `1px solid ${C.border}`,
                fontSize: '11px',
                color: C.textMuted,
              }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Rollback plan */}
        <div style={{
          background: C.surfaceLight,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          padding: '14px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: C.text, marginBottom: '8px' }}>Rollback Plan</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['Route 100% to Python', 'Investigate shadow logs', 'Patch Rust & redeploy', '48h re-validation', 'Resume migration'].map((step, i, arr) => (
              <React.Fragment key={step}>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  fontSize: '11px',
                  color: C.text,
                }}>
                  {i + 1}. {step}
                </div>
                {i < arr.length - 1 && (
                  <span style={{ color: C.textDim, alignSelf: 'center', fontSize: '10px' }}>{'\u2192'}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tab: Feature Parity
  function ParityPanel() {
    const statusIcon = (s: 'done' | 'progress' | 'planned' | 'na') => {
      if (s === 'done') return { icon: '\u2713', color: C.success };
      if (s === 'progress') return { icon: '\u{1F504}', color: C.warning };
      if (s === 'planned') return { icon: '\u25CB', color: C.textDim };
      return { icon: '\u2713', color: C.success };
    };

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Feature Parity & Performance Targets
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            Tracking Python feature coverage in Rust and expected performance improvements.
          </div>
        </div>

        {/* Feature table */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px',
            padding: '8px 14px',
            background: C.surfaceLight,
            borderBottom: `1px solid ${C.border}`,
            fontSize: '11px',
            fontWeight: 700,
            color: C.textMuted,
          }}>
            <div>Feature</div>
            <div style={{ textAlign: 'center', color: C.python }}>Python</div>
            <div style={{ textAlign: 'center', color: C.rust }}>Rust</div>
          </div>
          {features.map((f, i) => {
            const rs = statusIcon(f.rust);
            return (
              <div key={f.name} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px',
                padding: '8px 14px',
                borderBottom: i < features.length - 1 ? `1px solid ${C.border}` : 'none',
                fontSize: '12px',
              }}>
                <div style={{ color: C.text }}>{f.name}</div>
                <div style={{ textAlign: 'center', color: C.success }}>{'\u2713'}</div>
                <div style={{ textAlign: 'center', color: rs.color }}>{rs.icon}</div>
              </div>
            );
          })}
        </div>

        {/* Performance targets */}
        <div style={{ fontWeight: 700, fontSize: '14px', color: C.text, marginBottom: '10px' }}>
          Performance Targets
        </div>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px 80px',
            padding: '8px 14px',
            background: C.surfaceLight,
            borderBottom: `1px solid ${C.border}`,
            fontSize: '11px',
            fontWeight: 700,
            color: C.textMuted,
          }}>
            <div>Metric</div>
            <div style={{ textAlign: 'center', color: C.python }}>Python</div>
            <div style={{ textAlign: 'center', color: C.rust }}>Rust</div>
            <div style={{ textAlign: 'center' }}>Gain</div>
          </div>
          {perfMetrics.map((m, i) => (
            <div key={m.metric} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 80px',
              padding: '8px 14px',
              borderBottom: i < perfMetrics.length - 1 ? `1px solid ${C.border}` : 'none',
              fontSize: '12px',
            }}>
              <div style={{ color: C.text }}>{m.metric}</div>
              <div style={{ textAlign: 'center', color: C.textMuted }}>{m.python}</div>
              <div style={{ textAlign: 'center', color: C.rust, fontWeight: 600 }}>{m.rustTarget}</div>
              <div style={{ textAlign: 'center', color: C.success, fontWeight: 700 }}>{m.improvement}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
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

      <div style={gridStyle}>
        <div style={panelStyle(activeTab === 'timeline')}>
          <TimelinePanel />
        </div>
        <div style={panelStyle(activeTab === 'shadow')}>
          <ShadowPanel />
        </div>
        <div style={panelStyle(activeTab === 'parity')}>
          <ParityPanel />
        </div>
      </div>
    </div>
  );
}
