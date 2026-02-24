/**
 * Tipos e interfaces compartidas para el Gateway
 * Define contratos de datos entre módulos
 */

export interface Backend {
    name: string;
    url: string;
    prefix: string;
    token: string;
}

export interface AuthToken {
    token: string;
    expiresAt: number;
    createdAt: number;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    expiresIn: number;
    tokenType: string;
}

export interface User {
    username: string;
    email?: string;
    role?: string;
    active?: boolean;
    passwordHash: string;
}

export interface KVStorageBackendResponse {
    items?: Array<{
        key: string;
        data: Backend;
        metadata?: any;
    }>;
}

export interface KVStorageUserResponse {
    items?: Array<{
        key: string;
        data: User;
    }>;
    data?: {
        passwordHash: string;
    };
}
