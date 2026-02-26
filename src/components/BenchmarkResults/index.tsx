// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingenierie / Christophe ABOULICAM
import React, { useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';

type TabId = 'layer0' | 'layer1' | 'methodology';

interface Colors {
  bg: string;
  surface: string;
  surfaceLight: string;
  border: string;
  borderActive: string;
  text: string;
  textMuted: string;
  accent: string;
  accentGlow: string;
  stoa: string;
  stoaGlow: string;
  kong: string;
  kongGlow: string;
  gravitee: string;
  graviteeGlow: string;
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
  accent: '#3b82f6',
  accentGlow: 'rgba(59, 130, 246, 0.15)',
  stoa: '#10b981',
  stoaGlow: 'rgba(16, 185, 129, 0.12)',
  kong: '#003459',
  kongGlow: 'rgba(0, 52, 89, 0.12)',
  gravitee: '#86198f',
  graviteeGlow: 'rgba(134, 25, 143, 0.12)',
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
  accent: '#4f46e5',
  accentGlow: 'rgba(79, 70, 229, 0.08)',
  stoa: '#059669',
  stoaGlow: 'rgba(5, 150, 105, 0.08)',
  kong: '#003459',
  kongGlow: 'rgba(0, 52, 89, 0.08)',
  gravitee: '#86198f',
  graviteeGlow: 'rgba(134, 25, 143, 0.08)',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

interface ScenarioWeight {
  name: string;
  weight: number;
  description: string;
  cap?: string;
}

const LAYER0_SCENARIOS: ScenarioWeight[] = [
  { name: 'Sequential', weight: 0.10, description: 'Baseline latency (1 VU, 20 requests)', cap: '400ms' },
  { name: 'Burst 50', weight: 0.20, description: 'Medium burst (50 VUs, ramping)', cap: '2.5s' },
  { name: 'Burst 100', weight: 0.20, description: 'Heavy burst (100 VUs, ramping)', cap: '4s' },
  { name: 'Availability', weight: 0.15, description: 'Health check success rate', cap: '100%' },
  { name: 'Error Rate', weight: 0.10, description: 'Request success rate under load', cap: '100%' },
  { name: 'Consistency', weight: 0.10, description: 'IQR-based latency stability', cap: 'IQR CV' },
  { name: 'Ramp-up', weight: 0.15, description: 'Throughput ceiling (10→100 req/s)', cap: '100 rps' },
];

const LAYER1_DIMENSIONS: ScenarioWeight[] = [
  { name: 'MCP Discovery', weight: 0.15, description: 'GET /mcp/capabilities', cap: '500ms' },
  { name: 'MCP Tool Exec', weight: 0.20, description: 'POST /mcp/tools/list (JSON-RPC)', cap: '500ms' },
  { name: 'Auth Chain', weight: 0.15, description: 'JWT + authenticated tool call', cap: '1s' },
  { name: 'Policy Engine', weight: 0.15, description: 'OPA policy evaluation overhead', cap: '200ms' },
  { name: 'AI Guardrails', weight: 0.10, description: 'PII detection and redaction', cap: '1s' },
  { name: 'Rate Limiting', weight: 0.10, description: '429 enforcement accuracy', cap: '1s' },
  { name: 'Resilience', weight: 0.10, description: 'Bad input → 4xx (not 500)', cap: '1s' },
  { name: 'Governance', weight: 0.05, description: 'Session and circuit-breaker endpoints', cap: '2s' },
];

function ScoreBar({ score, color, C }: { score: number; color: string; C: Colors }) {
  const width = Math.max(0, Math.min(100, score));
  return (
    <div style={{
      width: '100%',
      height: 8,
      borderRadius: 4,
      background: C.surfaceLight,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${width}%`,
        height: '100%',
        borderRadius: 4,
        background: color,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

function WeightTable({ items, C }: { items: ScenarioWeight[]; C: Colors }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--ifm-font-family-base)',
        fontSize: '0.9rem',
      }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted, fontWeight: 600 }}>Dimension</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', color: C.textMuted, fontWeight: 600 }}>Weight</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted, fontWeight: 600 }}>Description</th>
            <th style={{ padding: '10px 12px', textAlign: 'center', color: C.textMuted, fontWeight: 600 }}>Cap</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{
              borderBottom: `1px solid ${C.border}`,
              background: i % 2 === 0 ? 'transparent' : C.surfaceLight,
            }}>
              <td style={{ padding: '10px 12px', color: C.text, fontWeight: 500 }}>{item.name}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: C.accent, fontFamily: 'var(--ifm-font-family-monospace)', fontWeight: 600 }}>
                {(item.weight * 100).toFixed(0)}%
              </td>
              <td style={{ padding: '10px 12px', color: C.textMuted }}>{item.description}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: C.textMuted, fontFamily: 'var(--ifm-font-family-monospace)' }}>
                {item.cap || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormulaCard({ title, formula, notes, C }: { title: string; formula: string; notes: string[]; C: Colors }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 20,
      marginBottom: 16,
    }}>
      <h4 style={{ margin: '0 0 12px', color: C.text, fontSize: '1rem' }}>{title}</h4>
      <div style={{
        background: C.surfaceLight,
        borderRadius: 6,
        padding: '12px 16px',
        fontFamily: 'var(--ifm-font-family-monospace)',
        fontSize: '0.85rem',
        color: C.accent,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        marginBottom: 12,
      }}>
        {formula}
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 20px', color: C.textMuted, fontSize: '0.85rem' }}>
        {notes.map((note, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function GatewayComparisonCard({ C }: { C: Colors }) {
  const gateways = [
    { name: 'STOA Gateway', lang: 'Rust + Tokio', mcp: true, license: 'Apache 2.0', color: C.stoa },
    { name: 'Kong', lang: 'Lua + Nginx', mcp: false, license: 'Apache 2.0 (OSS)', color: C.kong },
    { name: 'Gravitee', lang: 'Java + Vert.x', mcp: true, license: 'Apache 2.0', color: C.gravitee },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 12,
      marginBottom: 20,
    }}>
      {gateways.map((gw) => (
        <div key={gw.name} style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: `3px solid ${gw.color}`,
          borderRadius: 8,
          padding: 16,
        }}>
          <h4 style={{ margin: '0 0 8px', color: C.text, fontSize: '0.95rem' }}>{gw.name}</h4>
          <div style={{ fontSize: '0.85rem', color: C.textMuted, lineHeight: 1.6 }}>
            <div><strong>Stack:</strong> {gw.lang}</div>
            <div><strong>MCP:</strong> {gw.mcp ? 'Yes' : 'No (OSS)'}</div>
            <div><strong>License:</strong> {gw.license}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BenchmarkResults(): React.ReactElement {
  const { colorMode } = useColorMode();
  const C = colorMode === 'dark' ? darkColors : lightColors;
  const [activeTab, setActiveTab] = useState<TabId>('layer0');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'layer0', label: 'Layer 0: Proxy Baseline', icon: '⚡' },
    { id: 'layer1', label: 'Layer 1: Enterprise AI', icon: '🧠' },
    { id: 'methodology', label: 'Methodology', icon: '📐' },
  ];

  return (
    <div style={{ fontFamily: 'var(--ifm-font-family-base)', color: C.text }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: `2px solid ${C.border}`,
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: `3px solid ${activeTab === tab.id ? C.accent : 'transparent'}`,
              background: activeTab === tab.id ? C.accentGlow : 'transparent',
              color: activeTab === tab.id ? C.accent : C.textMuted,
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.9rem',
              fontFamily: 'var(--ifm-font-family-base)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Layer 0 */}
      <div style={{ display: activeTab === 'layer0' ? 'block' : 'none' }}>
        <p style={{ color: C.textMuted, marginBottom: 20 }}>
          Measures raw proxy performance: latency, throughput, burst handling, and consistency.
          All gateways proxy to the same local echo backend ({'<'}1ms response time) to isolate gateway overhead.
        </p>

        <h3 style={{ color: C.text, marginBottom: 12 }}>Scoring Weights</h3>
        <WeightTable items={LAYER0_SCENARIOS} C={C} />

        <h3 style={{ color: C.text, margin: '24px 0 12px' }}>7 Test Scenarios</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Scenario</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>k6 Executor</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>VUs / Load</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Scored?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1', 'Warmup', 'shared-iterations', '10 VUs × 50 iter', 'Discarded'],
                ['2', 'Health', 'shared-iterations', '1 VU × 1 iter', 'Availability'],
                ['3', 'Sequential', 'shared-iterations', '1 VU × 20 iter', 'P95 latency'],
                ['4', 'Burst 10', 'shared-iterations', '10 VUs × 10 iter', 'Error rate'],
                ['5', 'Burst 50', 'ramping-vus', '0→50 VUs (18s)', 'P95 latency'],
                ['6', 'Burst 100', 'ramping-vus', '0→100 VUs (18s)', 'P95 latency'],
                ['7', 'Sustained', 'shared-iterations', '1 VU × 100 iter', 'IQR consistency'],
                ['8', 'Ramp-up', 'ramping-arrival-rate', '10→100 req/s (60s)', 'Throughput'],
              ].map((row, i) => (
                <tr key={i} style={{
                  borderBottom: `1px solid ${C.border}`,
                  background: i % 2 === 0 ? 'transparent' : C.surfaceLight,
                  opacity: i === 0 ? 0.6 : 1,
                }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '8px 12px', color: j === 0 ? C.textMuted : C.text }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <FormulaCard
          title="Composite Score"
          formula={`Score = 0.10×Sequential + 0.20×Burst50 + 0.20×Burst100
     + 0.15×Availability + 0.10×ErrorRate
     + 0.10×Consistency + 0.15×Ramp-up`}
          notes={[
            'Latency score: max(0, 100 × (1 − P95 / cap))',
            'Consistency: IQR-based CV = (P75 − P25) / P50',
            'Ramp-up: effective throughput × success rate',
            'Score range: 0–100',
          ]}
          C={C}
        />
      </div>

      {/* Layer 1 */}
      <div style={{ display: activeTab === 'layer1' ? 'block' : 'none' }}>
        <p style={{ color: C.textMuted, marginBottom: 20 }}>
          Measures enterprise AI readiness across 8 dimensions. Gateways without MCP support
          score <strong>0</strong> on MCP-dependent dimensions (not N/A). The spec is open — any
          gateway can implement and re-run.
        </p>

        <h3 style={{ color: C.text, marginBottom: 12 }}>Participating Gateways</h3>
        <GatewayComparisonCard C={C} />

        <h3 style={{ color: C.text, marginBottom: 12 }}>8 Enterprise Dimensions</h3>
        <WeightTable items={LAYER1_DIMENSIONS} C={C} />

        <FormulaCard
          title="Per-Dimension Score"
          formula={`dimension = 0.6 × availability_score + 0.4 × latency_score

availability = (passes / total) × 100
latency      = max(0, 100 × (1 − P95 / cap))`}
          notes={[
            'Gateways without MCP score 0 on MCP dimensions (dimensions 1–5, 7)',
            'Rate limiting (dim 6) and Governance (dim 8) do not require MCP',
            'Score range per dimension: 0–100',
          ]}
          C={C}
        />

        <FormulaCard
          title="Enterprise Readiness Index"
          formula="ERI = Σ(weight_i × dimension_i) for all 8 dimensions"
          notes={[
            'Total weight: 1.0 (100%)',
            'MCP-dependent dimensions: 75% of total weight',
            'Score range: 0–100',
          ]}
          C={C}
        />

        <h3 style={{ color: C.text, margin: '24px 0 12px' }}>MCP Protocol Variants</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Gateway</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>MCP Protocol</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Endpoint Pattern</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['STOA', 'REST API', 'GET /capabilities, POST /tools/list, POST /tools/call'],
                ['Gravitee 4.8', 'Streamable HTTP (JSON-RPC 2.0)', 'POST /mcp with JSON-RPC body'],
                ['Kong OSS', 'None (Enterprise-only plugin)', 'N/A'],
              ].map((row, i) => (
                <tr key={i} style={{
                  borderBottom: `1px solid ${C.border}`,
                  background: i % 2 === 0 ? 'transparent' : C.surfaceLight,
                }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '8px 12px', color: C.text }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology */}
      <div style={{ display: activeTab === 'methodology' ? 'block' : 'none' }}>
        <h3 style={{ color: C.text, marginBottom: 12 }}>Test Infrastructure</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Parameter</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Layer 0</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted }}>Layer 1</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Tool', 'k6 v0.54.0', 'k6 v0.54.0'],
                ['Schedule', 'Every 30 min', 'Hourly'],
                ['Runs per gateway', '5 (discard 1st)', '3 (discard 1st)'],
                ['Scored runs', '4 (n=4)', '2 (n=2)'],
                ['Statistical method', 'Median + CI95 (t-distribution)', 'Median + CI95 (t-distribution)'],
                ['Backend', 'Local echo server (nginx, <1ms)', 'Local echo server (nginx, <1ms)'],
                ['CPU (guaranteed)', '1 core', '500m–1 core'],
                ['Memory (guaranteed)', '512 MiB', '256–512 MiB'],
                ['Cluster', 'OVH MKS (Managed K8s)', 'OVH MKS (Managed K8s)'],
              ].map((row, i) => (
                <tr key={i} style={{
                  borderBottom: `1px solid ${C.border}`,
                  background: i % 2 === 0 ? 'transparent' : C.surfaceLight,
                }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{
                      padding: '8px 12px',
                      color: j === 0 ? C.textMuted : C.text,
                      fontWeight: j === 0 ? 500 : 400,
                    }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <FormulaCard
          title="CI95 Confidence Intervals"
          formula={`CI95 = mean ± t(α/2, n-1) × (stddev / √n)

where:
  n       = number of scored runs (4 for L0, 2 for L1)
  t-value = Student's t-distribution critical value
  α       = 0.05 (95% confidence)`}
          notes={[
            'df=3 (L0): t = 3.182',
            'df=1 (L1): t = 12.706',
            'Wider intervals with fewer runs — by design (conservative)',
            'Warmup run always discarded (JVM, cache priming)',
          ]}
          C={C}
        />

        <h3 style={{ color: C.text, margin: '24px 0 12px' }}>Fairness Guarantees</h3>
        <ul style={{ color: C.textMuted, fontSize: '0.9rem', lineHeight: 1.8 }}>
          <li><strong>Same backend:</strong> All gateways proxy to the same nginx echo server (static JSON, {'<'}1ms)</li>
          <li><strong>Same cluster:</strong> All K8s gateways run on OVH MKS with identical resource limits</li>
          <li><strong>Same tool:</strong> k6 v0.54.0 for all scenarios, all gateways</li>
          <li><strong>Same scoring:</strong> Identical formulas applied to all gateways — no per-gateway adjustments</li>
          <li><strong>Open methodology:</strong> All scripts are open-source in the STOA repository</li>
          <li><strong>MCP = 0 (not N/A):</strong> Gateways without MCP score 0 on MCP dimensions, maintaining a single 0–100 scale</li>
        </ul>
      </div>

      {/* Disclaimer */}
      <div style={{
        marginTop: 32,
        padding: '12px 16px',
        background: C.surfaceLight,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        fontSize: '0.8rem',
        color: C.textMuted,
        lineHeight: 1.6,
      }}>
        Benchmark results are from a controlled test environment using methodology v2.0.
        Real-world performance depends on hardware, network, configuration, and workload.
        We encourage readers to reproduce these benchmarks using the published scripts.
        Product names and logos are trademarks of their respective owners.
        STOA Platform is not affiliated with or endorsed by any mentioned vendor.
      </div>
    </div>
  );
}
