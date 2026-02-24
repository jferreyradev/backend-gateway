/**
 * Utilidades de criptografía
 * Gestión segura de tokens y encriptación AES-GCM
 */

export class CryptoManager {
    constructor(private encryptionKey: string) {}

    /**
     * Desencripta un token encriptado con AES-GCM y PBKDF2
     * Utiliza salt e IV extraídos del token para máxima seguridad
     */
    async decryptToken(encryptedToken: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            
            // Decodificar de base64
            const encryptedData = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
            
            // Validar longitud mínima (salt + iv = 28 bytes)
            if (encryptedData.length < 28) {
                console.warn('⚠️  Token muy corto, usando sin desencriptar');
                return encryptedToken;
            }
            
            // Extraer salt (16 bytes), iv (12 bytes) y datos encriptados
            const salt = encryptedData.slice(0, 16);
            const iv = encryptedData.slice(16, 28);
            const data = encryptedData.slice(28);
            
            // Derivar la clave con PBKDF2
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.encryptionKey),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            const derivedKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256',
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
            
            // Desencriptar
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                derivedKey,
                data
            );
            
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('❌ Error desencriptando token:', (error as Error).message);
            console.warn('⚠️  Usando token sin desencriptar como fallback');
            return encryptedToken; // Fallback: retornar el token original
        }
    }

    /**
     * Genera un hash SHA-256 de una contraseña
     */
    async hashPassword(password: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    }

    /**
     * Genera un token aleatorio seguro
     */
    generateSecureToken(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '');
    }

    /**
     * Genera un Request ID único
     */
    generateRequestId(): string {
        return crypto.randomUUID();
    }
}
