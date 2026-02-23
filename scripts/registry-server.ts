// Updated the registry-server.ts to support both /collections and /namespaces routes for backend and users.

import express from 'express';
import { verifyToken } from './auth';
import { getItems, postItem, updateItem, deleteItem } from './storage';

const router = express.Router();

// Middleware to require authorization for certain methods
const authMiddleware = (req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && !req.headers.authorization) {
        return res.status(401).json({error: 'Authorization required'});
    }
    next();
};

// GET /collections and /namespaces
router.get('/collections', async (req, res) => {
    const items = await getItems('collections');
    res.json({items, count: items.length, hasMore: false});
});

router.get('/namespaces', async (req, res) => {
    const items = await getItems('namespaces');
    res.json({items, count: items.length, hasMore: false});
});

// POST /collections and /namespaces
router.post('/collections', authMiddleware, async (req, res) => {
    const { key, data, metadata } = req.body;
    const newItem = await postItem({ key, data, metadata });
    res.json({ success: true, collection: 'collections', key: newItem.key, createdAt: newItem.createdAt });
});

router.post('/namespaces', authMiddleware, async (req, res) => {
    const { key, data, metadata } = req.body;
    const newItem = await postItem({ key, data, metadata });
    res.json({ success: true, collection: 'namespaces', key: newItem.key, createdAt: newItem.createdAt });
});

// PUT /collections and /namespaces
router.put('/collections/:key', authMiddleware, async (req, res) => {
    const { data, metadata } = req.body;
    const updatedItem = await updateItem(req.params.key, { data, metadata });
    res.json({ success: true, collection: 'collections', key: updatedItem.key, updatedAt: updatedItem.updatedAt });
});

router.put('/namespaces/:key', authMiddleware, async (req, res) => {
    const { data, metadata } = req.body;
    const updatedItem = await updateItem(req.params.key, { data, metadata });
    res.json({ success: true, collection: 'namespaces', key: updatedItem.key, updatedAt: updatedItem.updatedAt });
});

// DELETE /collections and /namespaces
router.delete('/collections/:key', authMiddleware, async (req, res) => {
    const deletedItem = await deleteItem(req.params.key);
    res.json({ success: true, collection: 'collections', key: deletedItem.key, deletedAt: deletedItem.deletedAt });
});

router.delete('/namespaces/:key', authMiddleware, async (req, res) => {
    const deletedItem = await deleteItem(req.params.key);
    res.json({ success: true, collection: 'namespaces', key: deletedItem.key, deletedAt: deletedItem.deletedAt });
});

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Migration logic for old stored shapes
const migrateOldStorage = async () => {
    // Logic to iterate through old stored items and wrap them into KV items if necessary.
};
migrateOldStorage();

export default router;