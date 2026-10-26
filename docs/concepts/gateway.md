---
title: "STOA Gateway"
description: "Current Rust gateway and target Envoy engine."
sidebar_position: 5
---

# STOA Gateway

:::info Current state and target direction
R1 currently uses the **Rust gateway**. **Envoy is the decided target**; migration remains ahead. This page does not attest availability or performance. See [the Envoy ADR](/docs/architecture/adr/adr-073-adopt-envoy-data-plane/).
:::

## Overview

The gateway is a capability within STOA Sovereign iPaaS. It executes API calls according to contracts and policies; MCP services project these capabilities to agents.

## Architecture Vision

Envoy is intended to handle transport, routing, upstream connections and resilience. Business decisions and specific processing remain in STOA services. MCP and OAuth remain application services. The `ext_authz`, `ext_proc` and xDS interfaces describe a direction to implement and qualify.

## Deployment Modes

Modes in the [historical ADR](/docs/architecture/adr/adr-024-gateway-unified-modes/) do not establish equivalence in the Envoy target. No availability dates for modes are announced here.

## Configuration

For the [R1 quickstart](/docs/guides/quickstart/), use Compose and its verification script from the public repository. For your environment, supply `STOA_GATEWAY_URL`, `STOA_AUTH_URL` and identity parameters through your local configuration rather than copying operational addresses.

## Implementation

| Scope | State |
|---|---|
| R1 gateway | Rust, transitional local path |
| Target engine | Envoy, migration ahead |
| Contracts and policies | STOA model to preserve during migration |
| Envoy parity and performance | To validate; no measurements published here |

## Related Documentation

- [Architecture](/docs/concepts/architecture/)
- [Implementation status](/docs/concepts/implementation-status/)
- [UAC contracts](/docs/concepts/uac/)
