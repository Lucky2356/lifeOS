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

  'dialog.confirm': 'Confirm',
  'dialog.cancel': 'Cancel',
  'dialog.done': 'Done',

  'error.title': 'Something went wrong',
  'error.body':
    'The app could not read the data on this device. A restart usually helps. Your records are left untouched.',
  'error.restart': 'Restart',
  'error.details': 'Error details',

  'object.new': 'New object',
  'object.title': 'Title',
  'object.titlePlaceholder': 'Passport',
  'object.type': 'Type',
  'object.validUntil': 'Valid until / deadline (optional)',
  'object.add': 'Add',
  'object.saving': 'Saving…',
  'object.saveFailed': 'Could not save',
  'object.sensitivity': 'Sensitivity',
  'object.sensitivityHint': 'Anything above normal stays hidden on the card until you reveal it.',

  'theme.toggle': 'Toggle theme',

  'navigator.title': 'Navigator',
  'navigator.subtitle': 'Playbooks for hard situations and bureaucratic guides',
  'navigator.crisis': 'Crisis situations',
  'navigator.bureaucracy': 'Bureaucracy',
  'navigator.stepCount': {
    one: '{n} step',
    other: '{n} steps',
  },
  'navigator.openGuide': 'Open guide',
  'navigator.restart': 'Start over',
  'navigator.restartTitle': 'Start “{playbook}” over?',
  'navigator.restartMessage':
    'Every step mark will be cleared. The playbook itself and its content stay as they are.',
  'navigator.stepDone': 'Mark as done',
  'navigator.stepUndone': 'Clear the mark',
  'navigator.docUnknown': 'Ledger not read',
  'navigator.docOwned': 'In the ledger',
  'navigator.docMissing': 'Not found in the ledger',
  'navigator.docOwnedSuffix': ' · have',
  'navigator.docMissingSuffix': ' · missing',
  'navigator.progressFailed': 'Could not read the saved progress.',
  'navigator.openFailed': 'Could not open the playbook.',
  'navigator.toggleFailed': 'Could not save the mark — please try again.',
  'navigator.restartFailed': 'Could not start over.',

  'navigator.progress': {
    one: '{done} of {n} step',
    other: '{done} of {n} steps',
  },
} satisfies Dict<'en'>;
