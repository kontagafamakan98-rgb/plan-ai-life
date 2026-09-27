/** Route /legal/cgu: the terms of use page. */

import React from 'react';

import { LegalPage } from '../../src/components/LegalPage';
import { TERMS_DOCUMENT } from '../../src/game/legal';

export default function TermsScreen() {
  return <LegalPage document={TERMS_DOCUMENT} />;
}
