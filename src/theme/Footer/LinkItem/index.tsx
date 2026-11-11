// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import FooterLinkItem from '@theme-original/Footer/LinkItem';
import type {Props} from '@theme/Footer/LinkItem';
import {socialLinks} from '../../../social-links.mjs';

export default function SocialFooterLink({item}: Props): ReactNode {
  const social = socialLinks.find(({href}) => href === item.href);
  const isX = social?.category === 'x_profile';
  // Original brand marks, from the LinkedIn and X brand kits.
  const logo = useBaseUrl(isX ? 'img/social/x.svg' : 'img/social/linkedin.png');
  if (!social) return <FooterLinkItem item={item} />;
  const label = item.label ?? social.label;

  return (
    <Link
      className="footer__link-item docs-social-link"
      href={social.href}
      aria-label={label}
      title={label}
    >
      <img src={logo} alt="" width="20" height="20" />
    </Link>
  );
}
