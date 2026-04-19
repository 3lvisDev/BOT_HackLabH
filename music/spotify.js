const axios = require('axios');

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

class SpotifyClient {
  constructor({ clientId, clientSecret, market = 'US' } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.market = market;
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async getAccessToken() {
    if (!this.isConfigured()) {
      throw new Error('Falta configurar SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET.');
    }

    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.cachedToken;
    }

    const payload = new URLSearchParams();
    payload.append('grant_type', 'client_credentials');

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await axios.post('https://accounts.spotify.com/api/token', payload.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10_000
    });

    this.cachedToken = response.data.access_token;
    const expiresIn = Number(response.data.expires_in || 3600);
    this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
    return this.cachedToken;
  }

  async apiGet(endpoint, params = {}) {
    const token = await this.getAccessToken();
    const response = await axios.get(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { market: this.market, ...params },
      timeout: 10_000
    });
    return response.data;
  }

  async getTrack(trackId) {
    return this.apiGet(`/tracks/${encodeURIComponent(trackId)}`);
  }

  async getPlaylistTracks(playlistId) {
    const tracks = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const data = await this.apiGet(`/playlists/${encodeURIComponent(playlistId)}/tracks`, { limit, offset });
      const items = Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        const track = item?.track;
        if (track && track.name) tracks.push(track);
      }
      if (!data.next || items.length === 0) break;
      offset += items.length;
    }

    return tracks;
  }

  async getAlbumTracks(albumId) {
    const tracks = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const data = await this.apiGet(`/albums/${encodeURIComponent(albumId)}/tracks`, { limit, offset });
      const items = Array.isArray(data.items) ? data.items : [];
      for (const track of items) {
        if (track && track.name) tracks.push(track);
      }
      if (!data.next || items.length === 0) break;
      offset += items.length;
    }

    return tracks;
  }
}

let defaultSpotifyClient = null;

function getSpotifyClient() {
  if (!defaultSpotifyClient) {
    defaultSpotifyClient = new SpotifyClient({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      market: process.env.SPOTIFY_MARKET || 'US'
    });
  }
  return defaultSpotifyClient;
}

async function resolveSpotifyQueries(input, spotifyClient = getSpotifyClient()) {
  const parsed = parseSpotifyUrl(input);
  if (!parsed) {
    throw new Error('URL de Spotify inválida. Usa track, playlist o album.');
  }

  if (!spotifyClient || typeof spotifyClient.getTrack !== 'function') {
    throw new Error('Cliente de Spotify inválido.');
  }

  if (parsed.type === 'track') {
    const track = await spotifyClient.getTrack(parsed.id);
    const query = buildTrackSearchQuery(track);
    return query ? [query] : [];
  }

  if (parsed.type === 'playlist') {
    const tracks = await spotifyClient.getPlaylistTracks(parsed.id);
    return tracks.map(buildTrackSearchQuery).filter(Boolean);
  }

  if (parsed.type === 'album') {
    const tracks = await spotifyClient.getAlbumTracks(parsed.id);
    return tracks.map(buildTrackSearchQuery).filter(Boolean);
  }

  return [];
}

module.exports = {
  SpotifyClient,
  isSpotifyLink,
  parseSpotifyUrl,
  buildTrackSearchQuery,
  resolveSpotifyQueries,
  getSpotifyClient
};
