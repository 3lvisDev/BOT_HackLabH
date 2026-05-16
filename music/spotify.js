const fetch = require('isomorphic-unfetch');
const spotifyUrlInfo = require('spotify-url-info')(fetch);

const SPOTIFY_URL_REGEX = /^https?:\/\/open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)(\?.*)?$/i;
const SPOTIFY_URI_REGEX = /^spotify:(track|playlist|album):([a-zA-Z0-9]+)$/i;

function isSpotifyLink(input) {
  if (!input) return false;
  const raw = String(input).trim();
  return SPOTIFY_URL_REGEX.test(raw) || SPOTIFY_URI_REGEX.test(raw);
}

function parseSpotifyUrl(input) {
  const raw = String(input || '').trim();
  const urlMatch = raw.match(SPOTIFY_URL_REGEX);
  if (urlMatch) {
    return { type: urlMatch[1].toLowerCase(), id: urlMatch[2] };
  }

  const uriMatch = raw.match(SPOTIFY_URI_REGEX);
  if (uriMatch) {
    return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
  }

  return null;
}

function buildTrackSearchQuery(track) {
  if (!track) return '';
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist?.name).filter(Boolean)
    : [];
  const artistText = artists.length ? artists.join(' ') : '';
  return `${artistText} ${track.name || ''}`.trim();
}

async function resolveSpotifyQueries(input, client = spotifyUrlInfo) {
  const raw = String(input || '').trim();
  const parsed = parseSpotifyUrl(input);
  if (!parsed) {
    throw new Error('URL de Spotify inv?lida. Usa track, playlist o album.');
  }

  try {
    if (client && client !== spotifyUrlInfo) {
      if (parsed.type === 'track' && typeof client.getTrack === 'function') {
        const track = await client.getTrack(parsed.id);
        const query = buildTrackSearchQuery(track);
        return query ? [query] : [];
      }

      const collectionResolver = parsed.type === 'album'
        ? client.getAlbumTracks
        : client.getPlaylistTracks;

      if (typeof collectionResolver === 'function') {
        const tracks = await collectionResolver.call(client, parsed.id);
        return (tracks || []).map(buildTrackSearchQuery).filter(Boolean);
      }
    }

    const tracks = await spotifyUrlInfo.getTracks(raw);
    if (!tracks || !tracks.length) {
      throw new Error('No se encontraron canciones en este enlace de Spotify.');
    }
    
    return tracks.map(buildTrackSearchQuery).filter(Boolean);
  } catch (err) {
    console.error('[Spotify Scraper Error]', err.message);
    throw new Error('No se pudo extraer la informaci?n de Spotify. Aseg?rate de que el enlace sea p?blico.');
  }
}

module.exports = {
  isSpotifyLink,
  parseSpotifyUrl,
  buildTrackSearchQuery,
  resolveSpotifyQueries
};
