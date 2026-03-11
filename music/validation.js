function validateMusicQuery(query) {
    if (!query || typeof query !== 'string') {
        throw new Error("Query inválida");
    }
    
    const trimmed = query.trim();
    
    if (trimmed.length === 0 || trimmed.length > 500) {
        throw new Error("Query debe tener entre 1 y 500 caracteres");
    }
    
    if (trimmed.includes('javascript:') || trimmed.includes('data:')) {
        throw new Error("Query contiene contenido no permitido");
    }
    
    return trimmed;
}

module.exports = {
    validateMusicQuery
};
