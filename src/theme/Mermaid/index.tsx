// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React, {type ReactNode} from 'react';
import Mermaid from '@theme-original/Mermaid';
import type {Props} from '@theme/Mermaid';
import useVisualMotion from '../../components/useVisualMotion';

export default function AnimatedMermaid(props: Props): ReactNode {
  const ref = useVisualMotion(props.value, 'svg');

  return (
    <div ref={ref}>
      <Mermaid {...props} />
    </div>
  );
}
