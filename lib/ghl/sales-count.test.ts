import { describe, expect, it } from 'vitest';
import { countTouches, isManualUserActivity, isMismatch, median, talkMinutes, type GhlTouch } from './sales-count';

const options = { userId: 'op', connectSeconds: 10, conversationSeconds: 60, replyWindowDays: 7, recoveryWindowDays: 7 };

function touch(partial: Partial<GhlTouch> & Pick<GhlTouch, 'id' | 'kind' | 'direction'>): GhlTouch {
  return { contactId: 'c1', at: '2026-10-29T15:00:00Z', userId: 'op', source: null, ...partial };
}

describe('sales GHL counting', () => {
  it('counts a manual dial, connect, conversation, text, and reply', () => {
    const touches = [
      touch({ id: 'call', kind: 'call', direction: 'outbound', durationSeconds: 90, answered: true }),
      touch({ id: 'sms', kind: 'text', direction: 'outbound', at: '2026-10-29T15:05:00Z' }),
      touch({ id: 'reply', kind: 'text', direction: 'inbound', userId: null, at: '2026-10-29T16:00:00Z' }),
    ];
    const lines = countTouches(touches, options);
    expect(lines.filter((line) => line.metric === 'dials_made')).toHaveLength(1);
    expect(lines.filter((line) => line.metric === 'connects')).toHaveLength(1);
    expect(lines.filter((line) => line.metric === 'conversations_held')).toHaveLength(1);
    expect(lines.filter((line) => line.metric === 'texts_sent')).toHaveLength(1);
    expect(lines.filter((line) => line.metric === 'replies_received')).toHaveLength(1);
    expect(talkMinutes(lines, touches)).toBe(1.5);
  });

  it('drops workflow texts and another user\'s calls', () => {
    const touches = [
      touch({ id: 'auto', kind: 'text', direction: 'outbound', source: 'workflow' }),
      touch({ id: 'other', kind: 'call', direction: 'outbound', userId: 'someone-else', durationSeconds: 120, answered: true }),
    ];
    expect(countTouches(touches, options)).toHaveLength(0);
    expect(isManualUserActivity(touches[0], 'op')).toBe(false);
  });

  it('flags a gap past the larger of 10 percent and 3 on small counts', () => {
    expect(isMismatch(10, 14, 10, 30, 3)).toBe(true);
    expect(isMismatch(10, 12, 10, 30, 3)).toBe(false);
    expect(isMismatch(100, 109, 10, 30, 3)).toBe(false);
    expect(isMismatch(100, 120, 10, 30, 3)).toBe(true);
    expect(median([10, 40, 20])).toBe(20);
  });
});
