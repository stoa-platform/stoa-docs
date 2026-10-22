---
title: "STOA — Sovereign iPaaS"
description: "European integration with its gateway and control plane, API and MCP capabilities."
sidebar_position: 1
---

# STOA — Sovereign iPaaS

STOA is a **Sovereign iPaaS** with a European focus. Explore STOA **with its gateway and control plane**: integration contracts, API management and agent access through MCP.

## What is STOA?

The control plane manages UAC contracts and policies. The gateway applies rules to calls; MCP lets agents discover and use exposed capabilities. These capabilities belong to a broader integration platform.

## Architecture at a Glance

R1 currently uses a **Rust gateway**. **Envoy is the decided target data plane**; migration remains ahead. This choice does not establish delivery, functional parity or performance. See [the Envoy decision](/docs/architecture/adr/adr-098-envoy-data-plane/).

## Quick Start

Start with the [local R1 quickstart](/docs/guides/quickstart/) in the `quickstart/` directory of the public [stoa](https://github.com/stoa-platform/stoa) repository. It uses Docker Compose; execution validation is still pending. It declares a contract directly on the gateway and does not demonstrate publication through the control plane.

The public [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart) repository remains a separate path. Components that are not published are not presented as public repositories.

## Key Differentiators

- UAC contracts describe integration and policies.
- API management and MCP projections support agent access.
- The control plane is separate from request execution.

Management interfaces and deployment capabilities depend on the chosen path; the local quickstart includes neither Console nor Portal.

## Licence

STOA's published code is open source under the Apache 2.0 licence.

This statement does not cover services, unpublished components or branding. Documentation content remains under CC BY 4.0.

## Next Steps

- [Architecture](/docs/concepts/architecture/)
- [Current gateway and target](/docs/concepts/gateway/)
- [Implementation status](/docs/concepts/implementation-status/)
- [Enterprise: tailored quotation](https://www.gostoa.dev/contact/)
