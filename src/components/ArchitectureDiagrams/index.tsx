import React, { useState } from 'react';
import Mermaid from '@theme/Mermaid';

type DiagramKey = 'comparison' | 'architecture' | 'gitops';

interface Diagram {
  key: DiagramKey;
  title: string;
  description: string;
  icon: string;
  mermaid: string;
}

const diagrams: Diagram[] = [
  {
    key: 'comparison',
    title: 'STOA vs Traditional Gateway',
    description: 'See how STOA optimizes for "Time to First Agent Call" vs traditional "Time to First API Call"',
    icon: '⚡',
    mermaid: `flowchart TB
    subgraph Traditional["Traditional API Gateway"]
        direction TB
        Dev1["👨‍💻 Developer"]
        Docs1["📚 Read Docs"]
        Portal1["🖥️ Dev Portal"]
        Key1["🔑 Get API Key"]
        Code1["💻 Write Code"]
        Test1["🧪 Test"]
        Prod1["🚀 Production"]
        
        Dev1 --> Docs1
        Docs1 --> Portal1
        Portal1 --> Key1
        Key1 --> Code1
        Code1 --> Test1
        Test1 --> Prod1
    end
    
    subgraph STOA["STOA + MCP Gateway"]
        direction TB
        Agent["🤖 AI Agent"]
        Discover["🔍 MCP Discovery"]
        Auto["⚡ Auto-Subscribe"]
        Call["📞 API Call"]
        
        Agent --> Discover
        Discover --> Auto
        Auto --> Call
    end
    
    Traditional ~~~ STOA
    
    Note1["⏱️ Days to Weeks"]
    Note2["⏱️ Seconds"]
    
    Prod1 -.- Note1
    Call -.- Note2
    
    style Traditional fill:#fee2e2,stroke:#dc2626
    style STOA fill:#d1fae5,stroke:#10b981
    style Note1 fill:#fef3c7,stroke:#f59e0b
    style Note2 fill:#d1fae5,stroke:#10b981`,
  },
  {
    key: 'architecture',
    title: 'STOA Platform Architecture',
    description: 'Complete platform architecture with all components and data flows',
    icon: '🏗️',
    mermaid: `flowchart TB
    subgraph External["External Zone"]
        Clients["🌐 API Clients"]
        Claude["🤖 Claude.ai"]
        Console["💻 Web Console"]
    end
    
    subgraph DMZ["DMZ Zone"]
        Ingress["Nginx Ingress"]
        
        subgraph Gateways["Gateway Layer"]
            MCP["MCP Gateway<br/>Rust + Tokio"]
            API["API Gateway<br/>webMethods"]
            AI["AI Gateway<br/>Token Metering"]
        end
    end
    
    subgraph Internal["Internal Zone"]
        subgraph Control["Control Plane"]
            CP["FastAPI<br/>Control Plane"]
            UAC["UAC Engine"]
            Catalog["API Catalog"]
        end
        
        subgraph Auth["Auth Layer"]
            KC["Keycloak<br/>OIDC/SAML"]
            Vault["HashiCorp<br/>Vault"]
        end
        
        subgraph Data["Data Layer"]
            PG["PostgreSQL"]
            OS["OpenSearch"]
            Redis["Redis"]
            Kafka["Kafka<br/>🔒 Internal Only"]
        end
        
        subgraph Observability["Observability"]
            Prom["Prometheus"]
            Graf["Grafana"]
            Loki["Loki"]
        end
    end
    
    Clients --> Ingress
    Claude --> Ingress
    Console --> Ingress
    
    Ingress --> MCP
    Ingress --> API
    Ingress --> AI
    
    MCP --> CP
    API --> CP
    AI --> CP
    
    CP --> UAC
    CP --> Catalog
    CP --> KC
    CP --> Vault
    
    CP --> PG
    CP --> OS
    CP --> Redis
    CP --> Kafka
    
    Gateways --> Prom
    CP --> Prom
    Prom --> Graf
    CP --> Loki
    
    style MCP fill:#10b981,color:#fff
    style CP fill:#6366f1,color:#fff
    style KC fill:#f43f5e,color:#fff
    style Kafka fill:#f97316,color:#fff`,
  },
  {
    key: 'gitops',
    title: 'GitOps CI/CD Pipeline',
    description: 'End-to-end GitOps workflow with ArgoCD and security scanning',
    icon: '🔄',
    mermaid: `flowchart LR
    subgraph Source["Source"]
        Git["GitLab<br/>📁 Helm Charts"]
    end
    
    subgraph CI["CI Pipeline"]
        Lint["🔍 Lint"]
        Test["🧪 Tests"]
        Scan["🛡️ Security Scan"]
        Build["🏗️ Build Image"]
    end
    
    subgraph Registry["Artifact Registry"]
        Container["📦 Container<br/>(Cosign signed)"]
        Helm["⎈ Helm Repo"]
        SBOM["📋 SBOM"]
    end
    
    subgraph CD["CD - ArgoCD"]
        Argo["ArgoCD<br/>Continuous Sync"]
    end
    
    subgraph K8s["Kubernetes"]
        subgraph Tenants["Tenant Namespaces"]
            T1["tenant-a"]
            T2["tenant-b"]
            T3["tenant-c"]
        end
    end
    
    Git --> Lint
    Lint --> Test
    Test --> Scan
    Scan --> Build
    
    Build --> Container
    Build --> Helm
    Scan --> SBOM
    
    Container --> Argo
    Helm --> Argo
    
    Argo --> T1
    Argo --> T2
    Argo --> T3
    
    style Git fill:#fc6d26,color:#fff
    style Argo fill:#ef7b4d,color:#fff
    style Container fill:#0db7ed,color:#fff
    style Scan fill:#10b981,color:#fff`,
  },
];

export default function ArchitectureDiagrams(): JSX.Element {
  const [activeDiagram, setActiveDiagram] = useState<DiagramKey>('comparison');
  
  const currentDiagram = diagrams.find(d => d.key === activeDiagram)!;

  return (
    <div className="architecture-container">
      {/* Diagram Selector */}
      <div className="diagram-tabs">
        {diagrams.map((diagram) => (
          <button
            key={diagram.key}
            className={`diagram-tab ${activeDiagram === diagram.key ? 'active' : ''}`}
            onClick={() => setActiveDiagram(diagram.key)}
          >
            <span className="tab-icon">{diagram.icon}</span>
            <span className="tab-title">{diagram.title}</span>
          </button>
        ))}
      </div>

      {/* Diagram Content */}
      <div className="diagram-content">
        <div className="diagram-header">
          <h3>
            <span className="header-icon">{currentDiagram.icon}</span>
            {currentDiagram.title}
          </h3>
          <p className="diagram-description">{currentDiagram.description}</p>
        </div>
        
        <div className="diagram-wrapper">
          <Mermaid value={currentDiagram.mermaid} />
        </div>
      </div>

      {/* Legend */}
      <div className="diagram-legend">
        <div className="legend-title">Technology Stack</div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#10b981' }}></span>
            <span>Rust + Tokio (Gateway)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#6366f1' }}></span>
            <span>Python + FastAPI (API)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#f43f5e' }}></span>
            <span>Keycloak + Vault (Auth)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#f97316' }}></span>
            <span>Kafka (Internal Only)</span>
          </div>
        </div>
      </div>

      <style>{`
        .architecture-container {
          margin: 2rem 0;
          border: 1px solid var(--ifm-color-emphasis-300);
          border-radius: 12px;
          overflow: hidden;
          background: var(--ifm-background-surface-color);
        }
        
        .diagram-tabs {
          display: flex;
          gap: 0;
          background: var(--ifm-color-emphasis-100);
          border-bottom: 1px solid var(--ifm-color-emphasis-300);
          overflow-x: auto;
        }
        
        .diagram-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.95rem;
          color: var(--ifm-color-emphasis-700);
          transition: all 0.2s ease;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
        }
        
        .diagram-tab:hover {
          background: var(--ifm-color-emphasis-200);
        }
        
        .diagram-tab.active {
          background: var(--ifm-background-surface-color);
          color: var(--ifm-color-primary);
          font-weight: 600;
          border-bottom-color: var(--ifm-color-primary);
        }
        
        .tab-icon {
          font-size: 1.25rem;
        }
        
        .diagram-content {
          padding: 1.5rem;
        }
        
        .diagram-header {
          margin-bottom: 1.5rem;
          text-align: center;
        }
        
        .diagram-header h3 {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
        }
        
        .header-icon {
          font-size: 1.5rem;
        }
        
        .diagram-description {
          color: var(--ifm-color-emphasis-600);
          margin: 0;
          font-size: 1rem;
        }
        
        .diagram-wrapper {
          display: flex;
          justify-content: center;
          overflow-x: auto;
          padding: 1rem;
          background: var(--ifm-color-emphasis-100);
          border-radius: 8px;
        }
        
        .diagram-legend {
          padding: 1rem 1.5rem;
          background: var(--ifm-color-emphasis-100);
          border-top: 1px solid var(--ifm-color-emphasis-300);
        }
        
        .legend-title {
          font-weight: 600;
          margin-bottom: 0.75rem;
          font-size: 0.85rem;
          color: var(--ifm-color-emphasis-700);
        }
        
        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--ifm-color-emphasis-800);
        }
        
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }
        
        @media (max-width: 768px) {
          .diagram-tab {
            padding: 0.75rem 1rem;
          }
          
          .tab-title {
            display: none;
          }
          
          .tab-icon {
            font-size: 1.5rem;
          }
          
          .diagram-header h3 {
            font-size: 1.25rem;
          }
          
          .legend-items {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
