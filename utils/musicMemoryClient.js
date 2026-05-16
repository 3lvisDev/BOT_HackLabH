const axios = require('axios');

function getBaseUrl() {
  return String(process.env.MUSIC_MEMORY_URL || '').trim();
}

async function trackPlayEvent(event) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return false;
  try {
    await axios.post(`${baseUrl}/v1/events/play`, event, { timeout: 1200 });
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = {
  trackPlayEvent
};
