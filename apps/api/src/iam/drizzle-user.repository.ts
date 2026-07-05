import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/drizzle.provider';
import { users } from '../db/schema';
import type { User, UserRepository } from './user.repository';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return (rows[0] as User | undefined) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return (rows[0] as User | undefined) ?? null;
  }

  async create(user: User): Promise<User> {
    await this.db.insert(users).values(user);
    return user;
  }

  async save(user: User): Promise<User> {
    await this.db.update(users).set(user).where(eq(users.id, user.id));
    return user;
  }
}
