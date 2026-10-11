import { describe, expect, it } from 'vitest';
import { lessonVideo, lessonView } from './lessonView';

const base = {
  id: '6b9d3a70-0000-4000-8000-000000000001',
  code: 'M01-L01',
  title: 'Open',
  module_id: '6b9d3a70-0000-4000-8000-000000000002',
};

describe('lesson video view', () => {
  it('keeps a Vimeo page URL so the privacy code can be replayed', () => {
    const video = lessonVideo({
      provider: 'vimeo',
      provider_id: '123456789',
      url: 'https://vimeo.com/123456789/Ab12Cd',
      duration: 40,
    });
    expect(video).toEqual({
      provider: 'vimeo',
      id: '123456789',
      url: 'https://vimeo.com/123456789/Ab12Cd',
      duration: 40,
    });
  });

  it('accepts an uploaded file without exposing a storage path', () => {
    const lesson = lessonView({
      ...base,
      video: { provider: 'file', provider_id: 'file1710000000000', duration: 55, url: null },
    });
    expect(lesson?.video).toEqual({
      provider: 'file',
      id: 'file1710000000000',
      url: null,
      duration: 55,
    });
  });

  it('ignores a host the player does not know', () => {
    expect(lessonVideo({ provider: 'youtube', provider_id: 'abcdefghijk' })).toBeNull();
  });
});
