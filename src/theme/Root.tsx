// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React from 'react';
import { Analytics } from '@vercel/analytics/react';

export default function Root({children}: {children: React.ReactNode}) {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
