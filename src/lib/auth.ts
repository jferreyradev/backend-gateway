/**
 * Gestión de autenticación y tokens
 * Maneja login, logout y validación de tokens Bearer
 */

import { AuthToken, LoginResponse, KVStorageUserResponse } from './types.ts';
import { CryptoManager } from './crypto.ts';
import type { GatewayConfig } from './config.ts';

export class AuthManager {
    private tokens: Map<string, AuthToken> = new Map();
    private crypto: CryptoManager;

    constructor(private config: GatewayConfig) {
        this.crypto = new CryptoManager(config.auth.encryptionKey);
    }

    /**
     * Valida un token de autorización Bearer
     */
    validateToken(authHeader: string | null): boolean {
        if (!authHeader) return false;
        
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) return false;
        
        const token = match[1];
        const tokenData = this.tokens.get(token);
        
        if (!tokenData) return false;
        if (Date.now() > tokenData.expiresAt) {
            this.tokens.delete(token);
            return false;
        }
        
        return true;
    }

    /**
     * Valida credenciales de usuario contra el KV storage
     */
    private async validateUser(username: string, password: string): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.config.backends.registryUrl}/collections/users/${username}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.backends.apiKey}`,
                    },
                }
            );

            if (!response.ok) return false;

            const result = await response.json() as KVStorageUserResponse;
            if (!result.data?.passwordHash) return false;
            
            const passwordHash = await this.crypto.hashPassword(password);
            return result.data.passwordHash === passwordHash;
        } catch (error) {
            console.error('Error validando usuario:', error);
            return false;
        }
    }

    /**
     * Autentica un usuario y genera un token
     */
    async login(username: string, password: string): Promise<LoginResponse | null> {
        const isValid = await this.validateUser(username, password);
        
        if (!isValid) return null;
        
        const token = this.crypto.generateSecureToken();
        const expiresAt = Date.now() + this.config.auth.tokenTTL;
        
        this.tokens.set(token, {
            token,
            expiresAt,
            createdAt: Date.now(),
        });
        
        this.cleanupExpiredTokens();
        
        return {
            token,
            expiresIn: this.config.auth.tokenTTL / 1000, // en segundos
            tokenType: 'Bearer',
        };
    }

    /**
     * Cierra sesión eliminando el token
     */
    logout(authHeader: string | null): boolean {
        if (!authHeader) return false;
        
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) return false;
        
        const token = match[1];
        if (this.tokens.has(token)) {
            this.tokens.delete(token);
            return true;
        }
        
        return false;
    }

    /**
     * Limpia tokens expirados
     */
    private cleanupExpiredTokens(): void {
        const now = Date.now();
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiresAt) {
                this.tokens.delete(token);
            }
        }
    }

    /**
     * Obtiene el número de tokens activos
     */
    getActiveTokensCount(): number {
        return this.tokens.size;
    }
}
