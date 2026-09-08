import type { Dict } from './dict';

export const en = {
  'app.loading': 'Loading…',
  'app.update.available': 'Version {version} is available. Update the app — your data stays.',
  'app.update.action': 'Update',
  'app.update.later': 'Later',

  'nav.aria': 'Main navigation',
  'nav.today': 'Today',
  'nav.ledger': 'Ledger',
  'nav.household': 'Household',
  'nav.decisions': 'Decisions',
  'nav.navigator': 'Navigator',
  'nav.search': 'Search',
  'nav.settings': 'Settings',

  'navigator.progress': {
    one: '{done} of {n} step',
    other: '{done} of {n} steps',
  },
} satisfies Dict<'en'>;
