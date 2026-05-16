const MusicManager = require('../music/MusicManager');

const originalEnv = {
  LAVALINK_URL: process.env.LAVALINK_URL,
  LAVALINK_PASSWORD: process.env.LAVALINK_PASSWORD
};

describe('Music seed learning helpers', () => {
  beforeEach(() => {
    delete process.env.LAVALINK_URL;
    delete process.env.LAVALINK_PASSWORD;
  });

  it('detects URL queries as direct links', () => {
    const manager = new MusicManager(null);
    expect(manager.isDirectUrlQuery('https://youtube.com/watch?v=abc')).toBe(true);
    expect(manager.isDirectUrlQuery('www.youtube.com/watch?v=abc')).toBe(true);
    expect(manager.isDirectUrlQuery('reggaeton mix 2026')).toBe(false);
  });

  it('detects likely specific song queries', () => {
    const manager = new MusicManager(null);
    expect(manager.looksLikeSpecificSongQuery('bad bunny')).toBe(false);
    expect(manager.looksLikeSpecificSongQuery('Bad Bunny - DTMF oficial')).toBe(true);
  });

  it('extracts primary artist from track author string', () => {
    const manager = new MusicManager(null);
    const seed = manager.extractSeedFromTrack({ author: 'Shakira ft. Bizarrap' });
    expect(seed).toBe('Shakira');
  });
});

process.on('exit', () => {
  process.env.LAVALINK_URL = originalEnv.LAVALINK_URL;
  process.env.LAVALINK_PASSWORD = originalEnv.LAVALINK_PASSWORD;
});
