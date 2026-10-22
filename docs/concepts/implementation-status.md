---
title: "Implementation Status"
description: "Scope established by source review and remaining validation."
sidebar_position: 10
---

# Implementation Status

:::info Current state and target direction
R1 currently uses the **Rust gateway**. **Envoy is the decided target**; migration remains ahead. This page does not attest availability or performance. See [the Envoy ADR](/docs/architecture/adr/adr-098-envoy-data-plane/).
:::

## Core Components

| Item | Finding | Limit |
|---|---|---|
| R1 quickstart | Compose and script present | Execution not attested |
| Gateway | Rust in the R1 path | No delivered Envoy inferred |
| Control plane | Service and health check | API publication not demonstrated by this path |
| Keycloak and PostgreSQL | Present in Compose | Images and behaviour need execution validation |
| Console and Portal | Absent from R1 path | No local management interface promised in this path |

## Gateway Capabilities

The script expects contract declaration, rejection without a token or with an invalid token, and success with a Keycloak token. These are expected outcomes without execution evidence. See [the canonical guide](/docs/guides/quickstart/).

## Gateway Adapters

Migration requires an Envoy rendering of contracts, configuration tracking and policy parity tests. Historical adapters do not establish that parity.

## Deployment Environments

This page is not an operational inventory or support matrix. Supported resources and versions need evidence tied to the release actually tested.

## Test Coverage

No execution or coverage report for the R1 quickstart is attested here. Source review does not replace running it.

## Roadmap

The Envoy target is accepted; migration criteria are in the ADR. No migration date or numerical promise is published.
