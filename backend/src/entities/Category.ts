import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { User } from './User';

@Entity({ tableName: 'categories' })
@Unique({ properties: ['user', 'name'] })
export class Category {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @Property({ type: 'string' })
  name!: string;

  // Hex-Farbe für das Dashboard, z. B. #2563eb
  @Property({ type: 'string', length: 7 })
  color: string = '#64748b';
}
