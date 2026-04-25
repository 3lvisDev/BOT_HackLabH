const assert = require('assert');
const {
  parseSpotifyUrl,
  buildTrackSearchQuery,
  resolveSpotifyQueries
} = require('../music/spotify');

async function run() {
  const parsedTrack = parseSpotifyUrl('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp?si=abc');
  assert.deepStrictEqual(parsedTrack, { type: 'track', id: '3n3Ppam7vgaVa1iaRUc9Lp' });

  const parsedPlaylist = parseSpotifyUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
  assert.deepStrictEqual(parsedPlaylist, { type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });

  const query = buildTrackSearchQuery({
    name: 'Blinding Lights',
    artists: [{ name: 'The Weeknd' }]
  });
  assert.strictEqual(query, 'The Weeknd Blinding Lights');

  const mockClient = {
    getTrack: async () => ({
      id: 'track-1',
      name: 'Numb',
      artists: [{ name: 'Linkin Park' }]
    }),
    getPlaylistTracks: async () => ([
      { id: 'track-a', name: 'One More Time', artists: [{ name: 'Daft Punk' }] },
      { id: 'track-b', name: 'Harder Better Faster Stronger', artists: [{ name: 'Daft Punk' }] }
    ])
  };

  const trackQueries = await resolveSpotifyQueries('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp', mockClient);
  assert.deepStrictEqual(trackQueries, ['Linkin Park Numb']);

  const playlistQueries = await resolveSpotifyQueries('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', mockClient);
  assert.deepStrictEqual(playlistQueries, [
    'Daft Punk One More Time',
    'Daft Punk Harder Better Faster Stronger'
  ]);

  console.log('spotify resolver tests ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
