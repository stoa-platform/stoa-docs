import React, { useState } from 'react';

// Color palette - Security-focused dark theme with cyan accents
const colors = {
  bg: '#0a0f1a',
  bgSecondary: '#111827',
  bgTertiary: '#1f2937',
  border: '#374151',
  borderHighlight: '#06b6d4',
  text: '#f9fafb',
  textMuted: '#9ca3af',
  cyan: '#06b6d4',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  blue: '#3b82f6',
};

// ============================================================
// DIAGRAM 1: Global Architecture Overview
// ============================================================
const GlobalArchitecture = () => (
  <div style={{ padding: '24px', background: colors.bg, borderRadius: '12px' }}>
    <h3 style={{ color: colors.text, fontSize: '20px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--ifm-font-family-monospace)' }}>
      Architecture Globale
    </h3>
    <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '24px' }}>
      Vue d'ensemble des composants et flux de données
    </p>

    <svg viewBox="0 0 900 600" style={{ width: '100%', maxWidth: '900px' }}>
      <defs>
        <marker id="arrowhead-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.cyan} />
        </marker>
      </defs>

      {/* External Zone */}
      <rect x="20" y="20" width="860" height="80" rx="8" fill={colors.bgTertiary} stroke={colors.amber} strokeWidth="2" strokeDasharray="5,5" />
      <text x="40" y="45" fill={colors.amber} fontSize="11" fontWeight="600">EXTERNAL ZONE</text>
      
      <rect x="60" y="55" width="120" height="35" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="120" y="77" fill={colors.text} fontSize="12" textAnchor="middle" fontWeight="500">Claude.ai</text>
      
      <rect x="220" y="55" width="120" height="35" rx="6" fill={colors.bgSecondary} stroke={colors.blue} strokeWidth="2" />
      <text x="280" y="77" fill={colors.text} fontSize="12" textAnchor="middle" fontWeight="500">API Consumers</text>
      
      <rect x="380" y="55" width="120" height="35" rx="6" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="2" />
      <text x="440" y="77" fill={colors.text} fontSize="12" textAnchor="middle" fontWeight="500">Web Console</text>

      {/* DMZ */}
      <rect x="20" y="120" width="860" height="90" rx="8" fill={colors.bgTertiary} stroke={colors.cyan} strokeWidth="2" />
      <text x="40" y="145" fill={colors.cyan} fontSize="11" fontWeight="600">DMZ — INGRESS LAYER</text>
      
      <rect x="340" y="155" width="220" height="40" rx="6" fill={colors.bgSecondary} stroke={colors.borderHighlight} strokeWidth="2" />
      <text x="450" y="180" fill={colors.text} fontSize="13" textAnchor="middle" fontWeight="600">Nginx Ingress Controller</text>

      {/* Internal Zone */}
      <rect x="20" y="230" width="860" height="350" rx="8" fill={colors.bgTertiary} stroke={colors.green} strokeWidth="2" />
      <text x="40" y="255" fill={colors.green} fontSize="11" fontWeight="600">INTERNAL ZONE — KUBERNETES CLUSTER</text>

      {/* Control Plane */}
      <rect x="40" y="270" width="250" height="140" rx="6" fill={colors.bgSecondary} stroke={colors.cyan} strokeWidth="2" />
      <text x="165" y="295" fill={colors.cyan} fontSize="12" textAnchor="middle" fontWeight="600">STOA Control Plane</text>
      <rect x="55" y="305" width="100" height="30" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="105" y="324" fill={colors.text} fontSize="11" textAnchor="middle">FastAPI</text>
      <rect x="170" y="305" width="100" height="30" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="220" y="324" fill={colors.text} fontSize="11" textAnchor="middle">Admin API</text>
      <rect x="55" y="345" width="215" height="30" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="162" y="364" fill={colors.text} fontSize="11" textAnchor="middle">UAC Contract Manager</text>
      <rect x="55" y="380" width="215" height="20" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="162" y="394" fill={colors.textMuted} fontSize="9" textAnchor="middle">REST • GraphQL • gRPC • Kafka</text>

      {/* MCP Gateway */}
      <rect x="310" y="270" width="180" height="100" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="400" y="295" fill={colors.purple} fontSize="12" textAnchor="middle" fontWeight="600">MCP Gateway</text>
      <rect x="325" y="305" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="400" y="322" fill={colors.text} fontSize="10" textAnchor="middle">Tool Discovery</text>
      <rect x="325" y="335" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="400" y="352" fill={colors.text} fontSize="10" textAnchor="middle">JWT Context Injection</text>

      {/* webMethods Gateway */}
      <rect x="510" y="270" width="180" height="100" rx="6" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="600" y="295" fill={colors.amber} fontSize="12" textAnchor="middle" fontWeight="600">webMethods Gateway</text>
      <rect x="525" y="310" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="600" y="327" fill={colors.text} fontSize="10" textAnchor="middle">API Proxying</text>
      <rect x="525" y="340" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="600" y="357" fill={colors.text} fontSize="10" textAnchor="middle">Policy Enforcement</text>

      {/* Keycloak */}
      <rect x="710" y="270" width="150" height="100" rx="6" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="785" y="295" fill={colors.red} fontSize="12" textAnchor="middle" fontWeight="600">Keycloak</text>
      <rect x="725" y="310" width="120" height="50" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="785" y="332" fill={colors.text} fontSize="10" textAnchor="middle">OAuth2/OIDC</text>
      <text x="785" y="348" fill={colors.textMuted} fontSize="9" textAnchor="middle">Multi-tenant RBAC</text>

      {/* Data Layer */}
      <rect x="40" y="420" width="820" height="140" rx="6" fill={colors.bg} stroke={colors.border} strokeWidth="1" strokeDasharray="3,3" />
      <text x="60" y="445" fill={colors.textMuted} fontSize="10" fontWeight="600">DATA LAYER</text>

      {/* Databases */}
      <rect x="60" y="460" width="140" height="80" rx="6" fill={colors.bgSecondary} stroke={colors.blue} strokeWidth="2" />
      <text x="130" y="490" fill={colors.blue} fontSize="12" textAnchor="middle" fontWeight="600">PostgreSQL</text>
      <text x="130" y="510" fill={colors.textMuted} fontSize="10" textAnchor="middle">Contracts • Tenants</text>

      <rect x="220" y="460" width="140" height="80" rx="6" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="290" y="490" fill={colors.amber} fontSize="12" textAnchor="middle" fontWeight="600">OpenSearch</text>
      <text x="290" y="510" fill={colors.textMuted} fontSize="10" textAnchor="middle">API Logs • Analytics</text>

      <rect x="380" y="460" width="140" height="80" rx="6" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="450" y="490" fill={colors.red} fontSize="12" textAnchor="middle" fontWeight="600">Redis</text>
      <text x="450" y="510" fill={colors.textMuted} fontSize="10" textAnchor="middle">Cache • Sessions</text>

      {/* Kafka - HIGHLIGHTED */}
      <rect x="540" y="460" width="160" height="80" rx="6" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="3" />
      <text x="620" y="490" fill={colors.green} fontSize="12" textAnchor="middle" fontWeight="600">Kafka/Redpanda</text>
      <text x="620" y="510" fill={colors.textMuted} fontSize="10" textAnchor="middle">Events • Audit</text>
      <text x="620" y="525" fill={colors.green} fontSize="9" textAnchor="middle" fontWeight="600">🔒 INTERNAL ONLY</text>

      <rect x="720" y="460" width="120" height="80" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="780" y="490" fill={colors.purple} fontSize="12" textAnchor="middle" fontWeight="600">Vault</text>
      <text x="780" y="510" fill={colors.textMuted} fontSize="10" textAnchor="middle">Secrets</text>

      {/* Arrows */}
      <line x1="120" y1="90" x2="350" y2="155" stroke={colors.purple} strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
      <line x1="280" y1="90" x2="400" y2="155" stroke={colors.blue} strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
      <line x1="440" y1="90" x2="480" y2="155" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
      <line x1="380" y1="195" x2="165" y2="270" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
      <line x1="450" y1="195" x2="400" y2="270" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
      <line x1="520" y1="195" x2="600" y2="270" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
    </svg>

    <div style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {[
        { color: colors.cyan, label: 'Control Plane' },
        { color: colors.purple, label: 'MCP Gateway' },
        { color: colors.green, label: 'Internal Only' },
        { color: colors.red, label: 'Authentication' },
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '3px' }} />
          <span style={{ color: colors.textMuted, fontSize: '11px' }}>{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================
// DIAGRAM 2: Security Architecture (ADR-017 Focus)
// ============================================================
const SecurityArchitecture = () => (
  <div style={{ padding: '24px', background: colors.bg, borderRadius: '12px' }}>
    <h3 style={{ color: colors.text, fontSize: '20px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--ifm-font-family-monospace)' }}>
      Architecture Sécurité — Zero Trust Network
    </h3>
    <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
      ADR-017: Kafka/Redpanda Internal-Only — Zero External Exposure
    </p>
    <div style={{ 
      display: 'inline-block', 
      background: colors.green + '20', 
      border: `1px solid ${colors.green}`,
      borderRadius: '4px',
      padding: '4px 12px',
      marginBottom: '20px'
    }}>
      <span style={{ color: colors.green, fontSize: '12px', fontWeight: 600 }}>🔒 SECURITY-FIRST BY DESIGN</span>
    </div>

    <svg viewBox="0 0 900 500" style={{ width: '100%', maxWidth: '900px' }}>
      <defs>
        <marker id="arrow-green-sec" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.green} />
        </marker>
        <marker id="arrow-cyan-sec" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.cyan} />
        </marker>
        <linearGradient id="firewall-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.red} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.red} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Untrusted Zone */}
      <rect x="20" y="20" width="180" height="460" rx="8" fill={colors.red + '10'} stroke={colors.red} strokeWidth="2" strokeDasharray="8,4" />
      <text x="110" y="50" fill={colors.red} fontSize="11" textAnchor="middle" fontWeight="700">☠️ UNTRUSTED</text>

      <rect x="35" y="80" width="150" height="45" rx="6" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="110" y="107" fill={colors.text} fontSize="11" textAnchor="middle">External Clients</text>

      <rect x="35" y="140" width="150" height="45" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="110" y="167" fill={colors.text} fontSize="11" textAnchor="middle">Claude.ai MCP</text>

      <rect x="35" y="210" width="150" height="45" rx="6" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="110" y="232" fill={colors.text} fontSize="11" textAnchor="middle">Attackers 🎯</text>
      <text x="110" y="248" fill={colors.red} fontSize="9" textAnchor="middle">Port Scan • DDoS</text>

      {/* Blocked arrow */}
      <line x1="185" y1="232" x2="210" y2="350" stroke={colors.red} strokeWidth="3" strokeDasharray="5,5" />
      <text x="195" y="300" fill={colors.red} fontSize="10" fontWeight="700" transform="rotate(70, 195, 290)">❌ BLOCKED</text>

      {/* Firewall */}
      <rect x="210" y="20" width="25" height="460" rx="4" fill="url(#firewall-grad)" stroke={colors.red} strokeWidth="3" />
      <text x="222" y="250" fill={colors.red} fontSize="9" fontWeight="700" transform="rotate(-90, 222, 250)">FIREWALL</text>

      {/* DMZ */}
      <rect x="245" y="20" width="180" height="460" rx="8" fill={colors.amber + '10'} stroke={colors.amber} strokeWidth="2" />
      <text x="335" y="50" fill={colors.amber} fontSize="11" textAnchor="middle" fontWeight="700">⚠️ DMZ</text>

      <rect x="260" y="80" width="150" height="55" rx="6" fill={colors.bgSecondary} stroke={colors.cyan} strokeWidth="2" />
      <text x="335" y="105" fill={colors.cyan} fontSize="11" textAnchor="middle" fontWeight="600">Nginx Ingress</text>
      <text x="335" y="122" fill={colors.textMuted} fontSize="9" textAnchor="middle">TLS • Rate Limit</text>

      <rect x="260" y="150" width="150" height="55" rx="6" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="335" y="175" fill={colors.amber} fontSize="11" textAnchor="middle" fontWeight="600">API Gateway</text>
      <text x="335" y="192" fill={colors.textMuted} fontSize="9" textAnchor="middle">Policy Enforcement</text>

      <rect x="260" y="220" width="150" height="55" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="335" y="245" fill={colors.purple} fontSize="11" textAnchor="middle" fontWeight="600">MCP Gateway</text>
      <text x="335" y="262" fill={colors.textMuted} fontSize="9" textAnchor="middle">JWT • Tenant Isolation</text>

      {/* Trusted Zone */}
      <rect x="435" y="20" width="445" height="460" rx="8" fill={colors.green + '10'} stroke={colors.green} strokeWidth="2" />
      <text x="657" y="50" fill={colors.green} fontSize="11" textAnchor="middle" fontWeight="700">✅ TRUSTED ZONE</text>

      {/* Control Plane */}
      <rect x="455" y="80" width="140" height="70" rx="6" fill={colors.bgSecondary} stroke={colors.cyan} strokeWidth="2" />
      <text x="525" y="105" fill={colors.cyan} fontSize="11" textAnchor="middle" fontWeight="600">Control Plane</text>
      <text x="525" y="125" fill={colors.textMuted} fontSize="9" textAnchor="middle">Business Logic</text>
      <text x="525" y="140" fill={colors.textMuted} fontSize="9" textAnchor="middle">UAC Management</text>

      {/* Keycloak */}
      <rect x="615" y="80" width="120" height="70" rx="6" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="675" y="105" fill={colors.red} fontSize="11" textAnchor="middle" fontWeight="600">Keycloak</text>
      <text x="675" y="125" fill={colors.textMuted} fontSize="9" textAnchor="middle">OAuth2/OIDC</text>
      <text x="675" y="140" fill={colors.textMuted} fontSize="9" textAnchor="middle">Token Validation</text>

      {/* Kafka - MAIN FOCUS */}
      <rect x="475" y="180" width="220" height="100" rx="8" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="4" />
      <text x="585" y="210" fill={colors.green} fontSize="13" textAnchor="middle" fontWeight="700">🔒 Kafka / Redpanda</text>
      <text x="585" y="230" fill={colors.text} fontSize="10" textAnchor="middle">ZERO EXTERNAL EXPOSURE</text>
      
      <rect x="495" y="245" width="75" height="25" rx="4" fill={colors.bg} stroke={colors.green} strokeWidth="1" />
      <text x="532" y="262" fill={colors.green} fontSize="9" textAnchor="middle">No Ingress</text>
      
      <rect x="580" y="245" width="95" height="25" rx="4" fill={colors.bg} stroke={colors.green} strokeWidth="1" />
      <text x="627" y="262" fill={colors.green} fontSize="9" textAnchor="middle">ClusterIP Only</text>

      {/* Database Layer */}
      <rect x="455" y="310" width="100" height="55" rx="6" fill={colors.bgSecondary} stroke={colors.blue} strokeWidth="2" />
      <text x="505" y="335" fill={colors.blue} fontSize="10" textAnchor="middle" fontWeight="600">PostgreSQL</text>
      <text x="505" y="352" fill={colors.textMuted} fontSize="8" textAnchor="middle">ClusterIP</text>

      <rect x="570" y="310" width="100" height="55" rx="6" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="620" y="335" fill={colors.amber} fontSize="10" textAnchor="middle" fontWeight="600">OpenSearch</text>
      <text x="620" y="352" fill={colors.textMuted} fontSize="8" textAnchor="middle">ClusterIP</text>

      <rect x="685" y="310" width="80" height="55" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="725" y="335" fill={colors.purple} fontSize="10" textAnchor="middle" fontWeight="600">Vault</text>
      <text x="725" y="352" fill={colors.textMuted} fontSize="8" textAnchor="middle">ClusterIP</text>

      {/* Debug Access */}
      <rect x="455" y="395" width="405" height="45" rx="6" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" strokeDasharray="4,4" />
      <text x="657" y="418" fill={colors.cyan} fontSize="10" textAnchor="middle" fontWeight="500">🔧 Debug: kubectl port-forward | Ephemeral Pods</text>
      <text x="657" y="432" fill={colors.textMuted} fontSize="8" textAnchor="middle">Audit Logged • Time-Limited • RBAC Controlled</text>

      {/* Flow Arrows */}
      <line x1="185" y1="102" x2="260" y2="102" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrow-cyan-sec)" />
      <line x1="185" y1="162" x2="260" y2="245" stroke={colors.purple} strokeWidth="2" markerEnd="url(#arrow-cyan-sec)" />
      <line x1="410" y1="107" x2="455" y2="107" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrow-green-sec)" />
      <line x1="410" y1="177" x2="455" y2="120" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrow-green-sec)" />
      <line x1="410" y1="247" x2="455" y2="130" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrow-green-sec)" />
      <line x1="525" y1="150" x2="550" y2="180" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrow-green-sec)" />
    </svg>

    <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
      <div style={{ background: colors.bgSecondary, border: `1px solid ${colors.green}`, borderRadius: '8px', padding: '12px' }}>
        <div style={{ color: colors.green, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>✅ Mesures Implémentées</div>
        <ul style={{ color: colors.textMuted, fontSize: '11px', margin: 0, paddingLeft: '16px', lineHeight: 1.6 }}>
          <li>Service type: ClusterIP uniquement</li>
          <li>Pas d'Ingress Resource pour Kafka</li>
          <li>Network Policies restrictives</li>
          <li>mTLS interne entre services</li>
        </ul>
      </div>
      <div style={{ background: colors.bgSecondary, border: `1px solid ${colors.amber}`, borderRadius: '8px', padding: '12px' }}>
        <div style={{ color: colors.amber, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>🔧 Accès Debug Sécurisé</div>
        <ul style={{ color: colors.textMuted, fontSize: '11px', margin: 0, paddingLeft: '16px', lineHeight: 1.6 }}>
          <li>kubectl port-forward (temporaire)</li>
          <li>Ephemeral debug pods</li>
          <li>Audit logging obligatoire</li>
          <li>RBAC avec least-privilege</li>
        </ul>
      </div>
    </div>
  </div>
);

// ============================================================
// DIAGRAM 3: CI/CD GitOps Pipeline
// ============================================================
const CICDPipeline = () => (
  <div style={{ padding: '24px', background: colors.bg, borderRadius: '12px' }}>
    <h3 style={{ color: colors.text, fontSize: '20px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--ifm-font-family-monospace)' }}>
      Pipeline CI/CD GitOps
    </h3>
    <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '24px' }}>
      Continuous Integration & Deployment avec GitLab CI et Argo CD
    </p>

    <svg viewBox="0 0 900 450" style={{ width: '100%', maxWidth: '900px' }}>
      <defs>
        <marker id="arrow-flow-ci" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.cyan} />
        </marker>
        <marker id="arrow-sync-ci" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.green} />
        </marker>
      </defs>

      {/* Phase Labels */}
      <text x="100" y="25" fill={colors.cyan} fontSize="10" textAnchor="middle" fontWeight="600">CODE</text>
      <text x="300" y="25" fill={colors.amber} fontSize="10" textAnchor="middle" fontWeight="600">BUILD & TEST</text>
      <text x="520" y="25" fill={colors.purple} fontSize="10" textAnchor="middle" fontWeight="600">PACKAGE</text>
      <text x="740" y="25" fill={colors.green} fontSize="10" textAnchor="middle" fontWeight="600">DEPLOY</text>

      {/* Vertical separators */}
      <line x1="200" y1="40" x2="200" y2="420" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
      <line x1="420" y1="40" x2="420" y2="420" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
      <line x1="640" y1="40" x2="640" y2="420" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />

      {/* Developer */}
      <rect x="20" y="60" width="160" height="55" rx="8" fill={colors.bgSecondary} stroke={colors.cyan} strokeWidth="2" />
      <text x="100" y="87" fill={colors.text} fontSize="12" textAnchor="middle" fontWeight="600">👨‍💻 Developer</text>
      <text x="100" y="104" fill={colors.textMuted} fontSize="10" textAnchor="middle">git push / MR</text>

      {/* GitLab */}
      <rect x="20" y="135" width="160" height="70" rx="8" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="100" y="165" fill={colors.amber} fontSize="12" textAnchor="middle" fontWeight="600">GitLab</text>
      <text x="100" y="183" fill={colors.textMuted} fontSize="10" textAnchor="middle">Source Code</text>
      <text x="100" y="198" fill={colors.textMuted} fontSize="10" textAnchor="middle">Helm Charts</text>

      {/* CI Pipeline */}
      <rect x="220" y="60" width="180" height="170" rx="8" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="310" y="85" fill={colors.amber} fontSize="12" textAnchor="middle" fontWeight="600">GitLab CI Pipeline</text>
      
      <rect x="235" y="100" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" />
      <text x="310" y="117" fill={colors.cyan} fontSize="10" textAnchor="middle">🔍 Lint & Format</text>
      
      <rect x="235" y="130" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.green} strokeWidth="1" />
      <text x="310" y="147" fill={colors.green} fontSize="10" textAnchor="middle">🧪 Unit Tests</text>
      
      <rect x="235" y="160" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.purple} strokeWidth="1" />
      <text x="310" y="177" fill={colors.purple} fontSize="10" textAnchor="middle">🔒 Security Scan</text>
      
      <rect x="235" y="190" width="150" height="25" rx="4" fill={colors.bg} stroke={colors.blue} strokeWidth="1" />
      <text x="310" y="207" fill={colors.blue} fontSize="10" textAnchor="middle">🏗️ Build Image</text>

      {/* Security Box */}
      <rect x="220" y="250" width="180" height="80" rx="8" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="310" y="275" fill={colors.red} fontSize="11" textAnchor="middle" fontWeight="600">🛡️ Supply Chain</text>
      <text x="310" y="295" fill={colors.textMuted} fontSize="9" textAnchor="middle">SBOM • Cosign • SLSA</text>
      <text x="310" y="315" fill={colors.textMuted} fontSize="9" textAnchor="middle">Attestations</text>

      {/* Container Registry */}
      <rect x="440" y="60" width="180" height="90" rx="8" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="530" y="90" fill={colors.purple} fontSize="12" textAnchor="middle" fontWeight="600">📦 Container Registry</text>
      <text x="530" y="110" fill={colors.textMuted} fontSize="10" textAnchor="middle">Docker Images</text>
      <text x="530" y="128" fill={colors.green} fontSize="10" textAnchor="middle">✓ Signed & Verified</text>
      <text x="530" y="143" fill={colors.textMuted} fontSize="8" textAnchor="middle">ghcr.io/hlfh/stoa-*</text>

      {/* Helm Registry */}
      <rect x="440" y="165" width="180" height="70" rx="8" fill={colors.bgSecondary} stroke={colors.blue} strokeWidth="2" />
      <text x="530" y="195" fill={colors.blue} fontSize="12" textAnchor="middle" fontWeight="600">📊 Helm Repository</text>
      <text x="530" y="215" fill={colors.textMuted} fontSize="10" textAnchor="middle">Charts Versioned</text>
      <text x="530" y="228" fill={colors.textMuted} fontSize="10" textAnchor="middle">values-*.yaml</text>

      {/* Argo CD */}
      <rect x="660" y="60" width="180" height="100" rx="8" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="2" />
      <text x="750" y="90" fill={colors.green} fontSize="13" textAnchor="middle" fontWeight="700">🔄 Argo CD</text>
      <text x="750" y="112" fill={colors.text} fontSize="11" textAnchor="middle">GitOps Controller</text>
      <text x="750" y="130" fill={colors.textMuted} fontSize="10" textAnchor="middle">Continuous Sync</text>
      <text x="750" y="148" fill={colors.textMuted} fontSize="10" textAnchor="middle">Auto-Healing</text>

      {/* Kubernetes Cluster */}
      <rect x="660" y="180" width="180" height="160" rx="8" fill={colors.bgSecondary} stroke={colors.cyan} strokeWidth="2" />
      <text x="750" y="205" fill={colors.cyan} fontSize="12" textAnchor="middle" fontWeight="600">☸️ Kubernetes</text>
      
      <rect x="680" y="220" width="140" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="750" y="235" fill={colors.text} fontSize="9" textAnchor="middle">stoa-control-plane</text>
      
      <rect x="680" y="247" width="140" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="750" y="262" fill={colors.text} fontSize="9" textAnchor="middle">stoa-mcp-gateway</text>
      
      <rect x="680" y="274" width="140" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="750" y="289" fill={colors.text} fontSize="9" textAnchor="middle">observability-stack</text>
      
      <rect x="680" y="301" width="140" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="750" y="316" fill={colors.text} fontSize="9" textAnchor="middle">security-stack</text>

      {/* Environments */}
      <rect x="660" y="360" width="180" height="50" rx="8" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="750" y="382" fill={colors.textMuted} fontSize="10" textAnchor="middle" fontWeight="500">Environments</text>
      <text x="700" y="400" fill={colors.amber} fontSize="10" textAnchor="middle">dev</text>
      <text x="750" y="400" fill={colors.blue} fontSize="10" textAnchor="middle">staging</text>
      <text x="800" y="400" fill={colors.green} fontSize="10" textAnchor="middle">prod</text>

      {/* Flow Arrows */}
      <line x1="100" y1="115" x2="100" y2="135" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrow-flow-ci)" />
      <line x1="180" y1="170" x2="220" y2="145" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrow-flow-ci)" />
      <line x1="400" y1="145" x2="440" y2="110" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrow-flow-ci)" />
      <line x1="400" y1="165" x2="440" y2="195" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arrow-flow-ci)" />
      <line x1="620" y1="110" x2="660" y2="110" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrow-sync-ci)" />
      <line x1="750" y1="160" x2="750" y2="180" stroke={colors.green} strokeWidth="2" markerEnd="url(#arrow-sync-ci)" />

      {/* Sync indicator */}
      <rect x="530" y="275" width="90" height="25" rx="12" fill={colors.green + '20'} stroke={colors.green} strokeWidth="1" />
      <text x="575" y="292" fill={colors.green} fontSize="9" textAnchor="middle" fontWeight="500">↻ GitOps Sync</text>
      <line x1="575" y1="300" x2="575" y2="340" stroke={colors.green} strokeWidth="1" strokeDasharray="4,4" />
      <line x1="575" y1="340" x2="660" y2="340" stroke={colors.green} strokeWidth="1" strokeDasharray="4,4" markerEnd="url(#arrow-sync-ci)" />
    </svg>

    <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
      {[
        { icon: '🔍', label: 'Lint', desc: 'Ruff, Black' },
        { icon: '🧪', label: 'Tests', desc: 'Coverage >80%' },
        { icon: '🔒', label: 'Security', desc: 'Trivy, Bandit' },
        { icon: '📦', label: 'Build', desc: 'Multi-arch' },
        { icon: '✍️', label: 'Sign', desc: 'Cosign, SBOM' },
        { icon: '🔄', label: 'Deploy', desc: 'Argo CD' },
      ].map((item, i) => (
        <div key={i} style={{ background: colors.bgSecondary, borderRadius: '6px', padding: '10px', border: `1px solid ${colors.border}` }}>
          <span style={{ fontSize: '14px' }}>{item.icon}</span>
          <span style={{ color: colors.text, fontSize: '11px', marginLeft: '6px', fontWeight: 500 }}>{item.label}</span>
          <div style={{ color: colors.textMuted, fontSize: '9px', marginTop: '2px' }}>{item.desc}</div>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================
// DIAGRAM 4: MCP Gateway Flow
// ============================================================
const MCPGatewayFlow = () => (
  <div style={{ padding: '24px', background: colors.bg, borderRadius: '12px' }}>
    <h3 style={{ color: colors.text, fontSize: '20px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--ifm-font-family-monospace)' }}>
      MCP Gateway — Flux d'Exécution
    </h3>
    <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '24px' }}>
      Model Context Protocol: Comment Claude.ai interagit avec les APIs via STOA
    </p>

    <svg viewBox="0 0 900 420" style={{ width: '100%', maxWidth: '900px' }}>
      <defs>
        <marker id="arr-purple-mcp" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.purple} />
        </marker>
        <marker id="arr-cyan-mcp" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.cyan} />
        </marker>
        <marker id="arr-green-mcp" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.green} />
        </marker>
        <marker id="arr-amber-mcp" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.amber} />
        </marker>
      </defs>

      {/* Step numbers */}
      {[1, 2, 3, 4, 5, 6].map((n, i) => (
        <g key={n}>
          <circle cx={50 + i * 145} cy="25" r="14" fill={colors.cyan} />
          <text x={50 + i * 145} y="30" fill={colors.bg} fontSize="11" fontWeight="700" textAnchor="middle">{n}</text>
        </g>
      ))}

      {/* Claude.ai */}
      <rect x="15" y="60" width="115" height="90" rx="8" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="72" y="85" fill={colors.purple} fontSize="12" textAnchor="middle" fontWeight="600">Claude.ai</text>
      <text x="72" y="105" fill={colors.textMuted} fontSize="9" textAnchor="middle">User: Parzival</text>
      <text x="72" y="120" fill={colors.textMuted} fontSize="9" textAnchor="middle">Tenant: IOI</text>
      <text x="72" y="140" fill={colors.cyan} fontSize="8" textAnchor="middle">tools/call</text>

      {/* MCP Gateway */}
      <rect x="160" y="50" width="130" height="115" rx="8" fill={colors.bgSecondary} stroke={colors.cyan} strokeWidth="2" />
      <text x="225" y="75" fill={colors.cyan} fontSize="12" textAnchor="middle" fontWeight="600">MCP Gateway</text>
      <rect x="172" y="85" width="106" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="225" y="100" fill={colors.text} fontSize="9" textAnchor="middle">JWT Decode</text>
      <rect x="172" y="112" width="106" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="225" y="127" fill={colors.text} fontSize="9" textAnchor="middle">Tenant Extract</text>
      <rect x="172" y="139" width="106" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="225" y="154" fill={colors.text} fontSize="9" textAnchor="middle">Tool Routing</text>

      {/* Keycloak */}
      <rect x="320" y="60" width="110" height="70" rx="8" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="375" y="85" fill={colors.red} fontSize="11" textAnchor="middle" fontWeight="600">Keycloak</text>
      <text x="375" y="105" fill={colors.textMuted} fontSize="9" textAnchor="middle">Token Validation</text>
      <text x="375" y="120" fill={colors.textMuted} fontSize="9" textAnchor="middle">RBAC Check</text>

      {/* Control Plane */}
      <rect x="460" y="50" width="130" height="115" rx="8" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="2" />
      <text x="525" y="75" fill={colors.green} fontSize="12" textAnchor="middle" fontWeight="600">Control Plane</text>
      <rect x="472" y="85" width="106" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="525" y="100" fill={colors.text} fontSize="9" textAnchor="middle">Business Logic</text>
      <rect x="472" y="112" width="106" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="525" y="127" fill={colors.text} fontSize="9" textAnchor="middle">UAC Validation</text>
      <rect x="472" y="139" width="106" height="22" rx="4" fill={colors.bg} stroke={colors.border} strokeWidth="1" />
      <text x="525" y="154" fill={colors.text} fontSize="9" textAnchor="middle">API Execution</text>

      {/* Backend API */}
      <rect x="620" y="60" width="110" height="70" rx="8" fill={colors.bgSecondary} stroke={colors.amber} strokeWidth="2" />
      <text x="675" y="85" fill={colors.amber} fontSize="11" textAnchor="middle" fontWeight="600">Backend API</text>
      <text x="675" y="105" fill={colors.textMuted} fontSize="9" textAnchor="middle">Billing Service</text>
      <text x="675" y="120" fill={colors.textMuted} fontSize="9" textAnchor="middle">Inventory API</text>

      {/* Response */}
      <rect x="760" y="60" width="75" height="70" rx="8" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="2" />
      <text x="797" y="90" fill={colors.green} fontSize="14" textAnchor="middle" fontWeight="600">✓</text>
      <text x="797" y="108" fill={colors.text} fontSize="10" textAnchor="middle">Response</text>
      <text x="797" y="122" fill={colors.textMuted} fontSize="8" textAnchor="middle">+ Trace ID</text>

      {/* Arrows */}
      <line x1="130" y1="105" x2="160" y2="105" stroke={colors.purple} strokeWidth="2" markerEnd="url(#arr-purple-mcp)" />
      <line x1="290" y1="95" x2="320" y2="95" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arr-cyan-mcp)" />
      <line x1="290" y1="130" x2="460" y2="130" stroke={colors.cyan} strokeWidth="2" markerEnd="url(#arr-cyan-mcp)" />
      <line x1="590" y1="95" x2="620" y2="95" stroke={colors.green} strokeWidth="2" markerEnd="url(#arr-green-mcp)" />
      <line x1="730" y1="95" x2="760" y2="95" stroke={colors.amber} strokeWidth="2" markerEnd="url(#arr-amber-mcp)" />

      {/* Tool Discovery Section */}
      <rect x="15" y="190" width="820" height="210" rx="8" fill={colors.bgTertiary} stroke={colors.border} strokeWidth="1" />
      <text x="35" y="215" fill={colors.cyan} fontSize="11" fontWeight="600">TOOL DISCOVERY — Multi-Tenant Isolation</text>

      {/* Tenant A - Parzival */}
      <rect x="30" y="235" width="240" height="145" rx="6" fill={colors.bgSecondary} stroke={colors.purple} strokeWidth="2" />
      <text x="150" y="258" fill={colors.purple} fontSize="11" textAnchor="middle" fontWeight="600">👤 Parzival (IOI)</text>
      <text x="150" y="275" fill={colors.textMuted} fontSize="9" textAnchor="middle">Available Tools:</text>
      <rect x="45" y="285" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" />
      <text x="97" y="299" fill={colors.cyan} fontSize="8" textAnchor="middle">stoa_catalog</text>
      <rect x="155" y="285" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" />
      <text x="207" y="299" fill={colors.cyan} fontSize="8" textAnchor="middle">stoa_subscription</text>
      <rect x="45" y="310" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.amber} strokeWidth="1" />
      <text x="97" y="324" fill={colors.amber} fontSize="8" textAnchor="middle">ioi:billing:*</text>
      <rect x="155" y="310" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.amber} strokeWidth="1" />
      <text x="207" y="324" fill={colors.amber} fontSize="8" textAnchor="middle">ioi:inventory:*</text>
      <rect x="45" y="340" width="215" height="20" rx="4" fill={colors.bg} stroke={colors.green} strokeWidth="1" />
      <text x="152" y="354" fill={colors.green} fontSize="8" textAnchor="middle">🔒 Cannot see Gregarious tools</text>

      {/* Tenant B - Sorrento */}
      <rect x="290" y="235" width="240" height="145" rx="6" fill={colors.bgSecondary} stroke={colors.red} strokeWidth="2" />
      <text x="410" y="258" fill={colors.red} fontSize="11" textAnchor="middle" fontWeight="600">🎯 Sorrento (Gregarious)</text>
      <text x="410" y="275" fill={colors.textMuted} fontSize="9" textAnchor="middle">Available Tools:</text>
      <rect x="305" y="285" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" />
      <text x="357" y="299" fill={colors.cyan} fontSize="8" textAnchor="middle">stoa_catalog</text>
      <rect x="415" y="285" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" />
      <text x="467" y="299" fill={colors.cyan} fontSize="8" textAnchor="middle">stoa_metrics</text>
      <rect x="305" y="310" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.red} strokeWidth="1" />
      <text x="357" y="324" fill={colors.red} fontSize="8" textAnchor="middle">greg:oasis:*</text>
      <rect x="415" y="310" width="105" height="20" rx="4" fill={colors.bg} stroke={colors.red} strokeWidth="1" />
      <text x="467" y="324" fill={colors.red} fontSize="8" textAnchor="middle">greg:sixers:*</text>
      <rect x="305" y="340" width="215" height="20" rx="4" fill={colors.bg} stroke={colors.green} strokeWidth="1" />
      <text x="412" y="354" fill={colors.green} fontSize="8" textAnchor="middle">🔒 Cannot see IOI tools</text>

      {/* Admin - Halliday */}
      <rect x="550" y="235" width="270" height="145" rx="6" fill={colors.bgSecondary} stroke={colors.green} strokeWidth="2" />
      <text x="685" y="258" fill={colors.green} fontSize="11" textAnchor="middle" fontWeight="600">🛡️ Halliday (Admin)</text>
      <text x="685" y="275" fill={colors.textMuted} fontSize="9" textAnchor="middle">Platform-wide visibility:</text>
      <rect x="565" y="285" width="75" height="20" rx="4" fill={colors.bg} stroke={colors.cyan} strokeWidth="1" />
      <text x="602" y="299" fill={colors.cyan} fontSize="8" textAnchor="middle">stoa_*</text>
      <rect x="645" y="285" width="75" height="20" rx="4" fill={colors.bg} stroke={colors.purple} strokeWidth="1" />
      <text x="682" y="299" fill={colors.purple} fontSize="8" textAnchor="middle">ioi:*</text>
      <rect x="725" y="285" width="75" height="20" rx="4" fill={colors.bg} stroke={colors.red} strokeWidth="1" />
      <text x="762" y="299" fill={colors.red} fontSize="8" textAnchor="middle">greg:*</text>
      <rect x="565" y="315" width="235" height="20" rx="4" fill={colors.bg} stroke={colors.amber} strokeWidth="1" />
      <text x="682" y="329" fill={colors.amber} fontSize="8" textAnchor="middle">Cross-tenant audit & compliance</text>
      <rect x="565" y="340" width="235" height="20" rx="4" fill={colors.bg} stroke={colors.green} strokeWidth="1" />
      <text x="682" y="354" fill={colors.green} fontSize="8" textAnchor="middle">✓ Full platform oversight</text>
    </svg>
  </div>
);

// ============================================================
// MAIN COMPONENT with Tabs
// ============================================================
export default function ArchitectureDiagrams() {
  const [activeTab, setActiveTab] = useState(0);

  const diagrams = [
    { name: 'Global', component: GlobalArchitecture },
    { name: 'Sécurité', component: SecurityArchitecture },
    { name: 'CI/CD', component: CICDPipeline },
    { name: 'MCP Flow', component: MCPGatewayFlow },
  ];

  const ActiveComponent = diagrams[activeTab].component;

  return (
    <div style={{ marginTop: '24px', marginBottom: '24px' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {diagrams.map((d, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '8px 16px',
              background: activeTab === i ? colors.cyan + '20' : colors.bgSecondary,
              border: `1px solid ${activeTab === i ? colors.cyan : colors.border}`,
              borderRadius: '6px',
              color: activeTab === i ? colors.cyan : colors.textMuted,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <ActiveComponent />
    </div>
  );
}
