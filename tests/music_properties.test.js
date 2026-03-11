const fc = require('fast-check');
const { validateYouTubeCookies, validateMusicQuery } = require('../music/validation');
const { encrypt, decrypt } = require('../db'); // I need to make sure these are exported or accessible for testing

describe('Music System Property-Based Tests', () => {
    // 1. Property: validateMusicQuery always returns a string <= 500 chars or throws
    test('validateMusicQuery length invariant', () => {
        fc.assert(
            fc.property(fc.string(), (query) => {
                try {
                    const result = validateMusicQuery(query);
                    return result.length <= 500 && typeof result === 'string';
                } catch (e) {
                    return true; // Expected for empty or too long strings
                }
            })
        );
    });

    // 2. Property: validateMusicQuery rejects javascript/data schemes (case insensitive)
    test('validateMusicQuery protocol rejection', () => {
        fc.assert(
            fc.property(fc.string(), (query) => {
                const malicious = `JaVaScRiPt:${query}`;
                try {
                    validateMusicQuery(malicious);
                    return false;
                } catch (e) {
                    return e.message === "Query contiene contenido no permitido";
                }
            })
        );
    });

    // 3. Property: Encryption/Decryption roundtrip
    test('Encryption/Decryption parity', () => {
        fc.assert(
            fc.property(fc.string(), (text) => {
                if (!text) return true;
                const encrypted = encrypt(text);
                const decrypted = decrypt(encrypted);
                return text === decrypted;
            })
        );
    });

    // 4. Property: validateYouTubeCookies rejects non-array inputs
    test('validateYouTubeCookies array invariant', () => {
        fc.assert(
            fc.property(fc.oneof(fc.string(), fc.integer(), fc.object()), (input) => {
                // Ensure it's not an array
                if (Array.isArray(input)) return true;
                
                try {
                    // String might be a valid JSON array, so we skip if it is
                    if (typeof input === 'string') {
                        try { JSON.parse(input); } catch (e) {
                            validateYouTubeCookies(input);
                            return false;
                        }
                        return true;
                    }
                    validateYouTubeCookies(input);
                    return false;
                } catch (e) {
                    return e.message.includes("Las cookies deben ser un array") || e.message.includes("Cookies inválidas");
                }
            })
        );
    });

    // 5. Property: validateYouTubeCookies requires name, value, and domain
    test('validateYouTubeCookies structure validation', () => {
        fc.assert(
            fc.property(fc.array(fc.record({
                name: fc.string(),
                value: fc.string()
                // domain missing intentionally in some cases
            })), (cookies) => {
                try {
                    validateYouTubeCookies(cookies);
                    // If it passes, it SHOULD have had a domain
                    return cookies.every(c => c.domain !== undefined);
                } catch (e) {
                    return e.message.includes("Estructura de cookie inválida");
                }
            })
        );
    });

    // 6. Property: getStatus() always returns an object with boolean "active"
    test('MusicManager status structure', () => {
        const MusicManager = require('../music/MusicManager');
        const manager = new MusicManager({ guilds: { cache: new Map() } }); // Mock client
        const status = manager.getStatus();
        expect(typeof status.active).toBe('boolean');
        expect(status).toHaveProperty('currentTrack');
    });

    // 7. Property: logMusicEvent handles any object as metadata
    test('Logger metadata resilience', async () => {
        const { logMusicEvent } = require('../music/logger');
        const { initDB } = require('../db');
        await initDB(); // Ensure DB is ready
        
        await fc.assert(
            fc.asyncProperty(fc.object(), async (metadata) => {
                try {
                    await logMusicEvent('test-guild', 'info', 'test message', metadata);
                    return true;
                } catch (e) {
                    return false;
                }
            })
        );
    });

    // 8. Property: Encrypt always produces hex:hex format
    test('Encryption output format', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1 }), (text) => {
                const encrypted = encrypt(text);
                const parts = encrypted.split(':');
                return parts.length === 2 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1]);
            })
        );
    });
});
