function validateMusicQuery(query) {
    if (!query || typeof query !== 'string') {
        throw new Error("Query inválida");
    }
    
    const trimmed = query.trim();
    
    if (trimmed.length === 0 || trimmed.length > 500) {
        throw new Error("Query debe tener entre 1 y 500 caracteres");
    }
    
    if (trimmed.toLowerCase().includes('javascript:') || trimmed.toLowerCase().includes('data:')) {
        throw new Error("Query contiene contenido no permitido");
    }
    
    return trimmed;
}

function validateYouTubeCookies(cookiesString) {
    try {
        const cookies = typeof cookiesString === 'string' ? JSON.parse(cookiesString) : cookiesString;
        if (!Array.isArray(cookies)) {
            throw new Error("Las cookies deben ser un array.");
        }
        for (const cookie of cookies) {
            if (!cookie.name || !cookie.value || !cookie.domain) {
                throw new Error("Estructura de cookie inválida (name, value, domain requeridos).");
            }
        }
        return cookies;
    } catch (e) {
        throw new Error(`Cookies inválidas: ${e.message}`);
    }
}

module.exports = {
    validateMusicQuery,
    validateYouTubeCookies
};
