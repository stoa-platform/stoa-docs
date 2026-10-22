// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React from 'react';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';

const commands = `git clone https://github.com/stoa-platform/stoa.git
cd stoa/quickstart
timeout 300 docker compose up --wait
./verify.sh`;

export default function QuickStartCode() {
  return (
    <div>
      <p><Translate id="homepage.quickstart.local.scope">This transitional path uses the current Rust gateway. It declares a contract directly on the gateway; publication through the control plane and the Envoy migration remain to be validated.</Translate></p>
      <CodeBlock language="bash">{commands}</CodeBlock>
      <Link className="button button--primary" to="/docs/guides/quickstart/">
        <Translate id="homepage.quickstart.local.guide">Prerequisites, expected checks and cleanup</Translate>
      </Link>
    </div>
  );
}
