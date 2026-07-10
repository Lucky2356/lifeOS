import { boolean, integer, jsonb, pgTable, text, uuid, index } from 'drizzle-orm/pg-core';

/**
 * Таблица объектов жизни (Life Ledger). Timestamps/hlc хранятся как ISO-текст —
 * ровно то, что несёт доменная модель (единый источник правды, без tz-дрейфа при sync).
 */
export const lifeObjects = pgTable(
  'life_objects',
  {
    id: uuid('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    hlc: text('hlc').notNull(),
    version: integer('version').notNull(),
    deletedAt: text('deleted_at'),
    ownerUserId: uuid('owner_user_id').notNull(),
    householdId: uuid('household_id'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    data: jsonb('data').notNull(),
    status: text('status').notNull(),
    sensitivity: text('sensitivity').notNull(),
    validFrom: text('valid_from'),
    validUntil: text('valid_until'),
  },
  (t) => [index('life_objects_owner_idx').on(t.ownerUserId)],
);

// --- IAM ---
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  mfaEnabled: boolean('mfa_enabled').notNull(),
  mfaSecretEnc: text('mfa_secret_enc'),
  status: text('status').notNull(),
  locale: text('locale').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    refreshHash: text('refresh_hash').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    lastSeenAt: text('last_seen_at').notNull(),
    userAgent: text('user_agent').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

// --- Household OS ---
export const households = pgTable('households', {
  id: uuid('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  hlc: text('hlc').notNull(),
  version: integer('version').notNull(),
  deletedAt: text('deleted_at'),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    hlc: text('hlc').notNull(),
    version: integer('version').notNull(),
    deletedAt: text('deleted_at'),
    householdId: uuid('household_id').notNull(),
    userId: uuid('user_id').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull(),
    relationship: text('relationship').notNull().default('other'),
    expiresAt: text('expires_at'),
  },
  (t) => [index('memberships_user_idx').on(t.userId), index('memberships_household_idx').on(t.householdId)],
);

export const householdTasks = pgTable(
  'household_tasks',
  {
    id: uuid('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    hlc: text('hlc').notNull(),
    version: integer('version').notNull(),
    deletedAt: text('deleted_at'),
    householdId: uuid('household_id').notNull(),
    title: text('title').notNull(),
    assigneeMembershipId: uuid('assignee_membership_id'),
    dueAt: text('due_at'),
    status: text('status').notNull(),
  },
  (t) => [index('household_tasks_household_idx').on(t.householdId)],
);

export const auditEntries = pgTable(
  'audit_entries',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id').notNull(),
    actorUserId: uuid('actor_user_id').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    at: text('at').notNull(),
  },
  (t) => [index('audit_household_idx').on(t.householdId)],
);

// --- Decision Companion ---
export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    hlc: text('hlc').notNull(),
    version: integer('version').notNull(),
    deletedAt: text('deleted_at'),
    ownerUserId: uuid('owner_user_id').notNull(),
    title: text('title').notNull(),
    context: text('context').notNull(),
    status: text('status').notNull(),
    criteria: jsonb('criteria').notNull(),
    options: jsonb('options').notNull(),
    chosenOptionId: text('chosen_option_id'),
    expectedOutcome: text('expected_outcome').notNull(),
    actualOutcome: text('actual_outcome'),
    decidedAt: text('decided_at'),
  },
  (t) => [index('decisions_owner_idx').on(t.ownerUserId)],
);

// --- AI settings ---
export const aiSettings = pgTable('ai_settings', {
  userId: uuid('user_id').primaryKey(),
  globalEnabled: boolean('global_enabled').notNull(),
  perModule: jsonb('per_module').notNull(),
  provider: text('provider').notNull(),
  shareSensitive: boolean('share_sensitive').notNull(),
});

// --- Navigator progress ---
export const playbookProgress = pgTable(
  'playbook_progress',
  {
    id: uuid('id').primaryKey(),
    ownerUserId: uuid('owner_user_id').notNull(),
    packId: text('pack_id').notNull(),
    packVersion: text('pack_version').notNull(),
    playbookKey: text('playbook_key').notNull(),
    stepStates: jsonb('step_states').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [index('progress_owner_idx').on(t.ownerUserId)],
);
