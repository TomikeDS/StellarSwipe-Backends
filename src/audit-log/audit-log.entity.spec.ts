import { AuditLog } from './entities/audit-log.entity';
import { AuditAction, AuditStatus } from './entities/audit-log.entity';

describe('AuditLog Entity', () => {
  let log: AuditLog;

  beforeEach(() => {
    log = new AuditLog();
    log.id = 'test-uuid';
    log.action = AuditAction.LOGIN;
    log.status = AuditStatus.SUCCESS;
    log.createdAt = new Date();
  });

  describe('Immutability', () => {
    it('should throw on update attempt via BeforeUpdate hook', () => {
      expect(() => log.preventUpdate()).toThrow('Audit logs are immutable and cannot be updated');
    });

    it('should throw on remove attempt via BeforeRemove hook', () => {
      expect(() => log.preventRemove()).toThrow('Audit logs are immutable and cannot be deleted');
    });
  });

  describe('Entity structure', () => {
    it('should have all required schema fields', () => {
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('action');
      expect(log).toHaveProperty('status');
      expect(log).toHaveProperty('createdAt');
    });

    it('should accept all AuditAction enum values', () => {
      const actions = Object.values(AuditAction);
      expect(actions.length).toBeGreaterThan(0);
      actions.forEach((action) => {
        log.action = action;
        expect(log.action).toBe(action);
      });
    });

    it('should accept all AuditStatus enum values', () => {
      Object.values(AuditStatus).forEach((status) => {
        log.status = status;
        expect(log.status).toBe(status);
      });
    });
  });
});
