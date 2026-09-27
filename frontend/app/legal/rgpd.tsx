/** Route /legal/rgpd: the personal data page. */

import React from 'react';

import { LegalPage } from '../../src/components/LegalPage';
import { GDPR_DOCUMENT } from '../../src/game/legal';

export default function GdprScreen() {
  return <LegalPage document={GDPR_DOCUMENT} />;
}
