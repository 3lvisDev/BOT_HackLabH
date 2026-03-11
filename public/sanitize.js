/**
 * Utilidades de Sanitización para prevenir XSS
 * 
 * Este módulo proporciona funciones para escapar HTML y prevenir
 * ataques de Cross-Site Scripting (XSS) en el dashboard.
 */

/**
 * Escapa caracteres HTML peligrosos
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado seguro para HTML
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };
    
    return String(text).replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Crea un elemento de texto seguro (no permite HTML)
 * @param {string} text - Texto a mostrar
 * @returns {Text} Nodo de texto DOM
 */
function createTextNode(text) {
    return document.createTextNode(text || '');
}

/**
 * Establece texto de forma segura en un elemento
 * @param {HTMLElement} element - Elemento DOM
 * @param {string} text - Texto a establecer
 */
function setTextContent(element, text) {
    element.textContent = text || '';
}

/**
 * Valida y sanitiza una URL para prevenir javascript: y data: URIs
 * @param {string} url - URL a validar
 * @returns {string} URL segura o placeholder
 */
function sanitizeUrl(url) {
    if (!url) return '';
    
    const urlStr = String(url).trim().toLowerCase();
    
    // Bloquear protocolos peligrosos
    if (urlStr.startsWith('javascript:') || 
        urlStr.startsWith('data:') || 
        urlStr.startsWith('vbscript:')) {
        return 'about:blank';
    }
    
    return url;
}

/**
 * Crea un elemento HTML de forma segura
 * @param {string} tag - Nombre de la etiqueta
 * @param {Object} attributes - Atributos del elemento
 * @param {string|HTMLElement|Array} children - Contenido hijo
 * @returns {HTMLElement} Elemento creado
 */
function createElement(tag, attributes = {}, children = null) {
    const element = document.createElement(tag);
    
    // Establecer atributos de forma segura
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'textContent') {
            element.textContent = value;
        } else if (key === 'className') {
            element.className = value;
        } else if (key === 'src' || key === 'href') {
            element.setAttribute(key, sanitizeUrl(value));
        } else if (key.startsWith('on')) {
            // No permitir atributos de eventos inline
            console.warn(`Atributo de evento ${key} bloqueado por seguridad`);
        } else {
            element.setAttribute(key, value);
        }
    }
    
    // Agregar hijos
    if (children) {
        if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    element.appendChild(child);
                }
            });
        } else if (typeof children === 'string') {
            element.textContent = children;
        } else if (children instanceof HTMLElement) {
            element.appendChild(children);
        }
    }
    
    return element;
}

// Exportar funciones
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        createTextNode,
        setTextContent,
        sanitizeUrl,
        createElement
    };
}
