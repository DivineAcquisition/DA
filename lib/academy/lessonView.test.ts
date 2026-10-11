import { describe, expect, it } from 'vitest';
import { lessonVideo, lessonView, studentStartGaps } from './lessonView';

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

  it('lists the checklist a trainee sees before they start', () => {
    expect(
      studentStartGaps({
        video: { provider: 'vimeo', id: '123456789', url: null, duration: 40 },
        body: '',
        watchPercent: 90,
        hasDocument: true,
      }),
    ).toEqual(['Watch 90% of the video.', 'Open the companion document.']);
    expect(
      studentStartGaps({
        video: null,
        body: 'Read this lesson.',
        watchPercent: 90,
        hasDocument: false,
      }),
    ).toEqual(['Stay on the page long enough to read the lesson.', 'Scroll to the end of the lesson.']);
    expect(
      studentStartGaps({
        video: null,
        body: 'Read this lesson.',
        watchPercent: 90,
        hasDocument: false,
        hasQuiz: true,
      }),
    ).toContain('Pass the lesson quiz.');
  });
});
