describe('Music memory client', () => {
  const axios = require('axios');
  const originalUrl = process.env.MUSIC_MEMORY_URL;
  const originalPost = axios.post;

  beforeEach(() => {
    process.env.MUSIC_MEMORY_URL = 'http://music-memory:9777';
  });

  it('returns false when request fails', async () => {
    axios.post = async () => { throw new Error('down'); };
    const { trackPlayEvent } = require('../utils/musicMemoryClient');
    const ok = await trackPlayEvent({ guild_id: 'g1', user_id: 'u1' });
    expect(ok).toBe(false);
  });

  it('returns true when request succeeds', async () => {
    axios.post = async () => ({ status: 202 });
    const { trackPlayEvent } = require('../utils/musicMemoryClient');
    const ok = await trackPlayEvent({ guild_id: 'g1', user_id: 'u1' });
    expect(ok).toBe(true);
  });

  process.on('exit', () => {
    process.env.MUSIC_MEMORY_URL = originalUrl;
    axios.post = originalPost;
  });
});

