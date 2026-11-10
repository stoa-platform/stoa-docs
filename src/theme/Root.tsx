// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React from 'react';
import AnalyticsConsent from '../components/AnalyticsConsent';

export default function Root({children}: {children: React.ReactNode}) {
  return (
    <>
      {children}
      <AnalyticsConsent />
    </>
  );
}
