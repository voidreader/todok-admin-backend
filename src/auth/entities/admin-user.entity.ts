import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'admin_users' })
export class AdminUser {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;
}
