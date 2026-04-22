const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const adminRoutePath = path.join(__dirname, '..', 'routes', 'admin.js');
const adminControllerPath = path.join(__dirname, '..', 'controllers', 'adminController.js');
const authMiddlewarePath = path.join(__dirname, '..', 'utils', 'authMiddleware.js');
const authzMiddlewarePath = path.join(__dirname, '..', 'utils', 'authzMiddleware.js');
const clientApiPath = path.join(__dirname, '..', '..', 'client', 'src', 'api.js');

function loadAdminRouterWithMocks() {
    delete require.cache[adminRoutePath];

    require.cache[adminControllerPath] = {
        id: adminControllerPath,
        filename: adminControllerPath,
        loaded: true,
        exports: {
            getUsers: async (req, res) => res.status(200).json({ ok: true, actorRole: req.user?.role ?? null }),
            removeUser: async (req, res) => res.status(200).json({ ok: true, actorRole: req.user?.role ?? null })
        }
    };

    require.cache[authMiddlewarePath] = {
        id: authMiddlewarePath,
        filename: authMiddlewarePath,
        loaded: true,
        exports: (req, res, next) => {
            const header = req.headers.authorization;
            if (!header) {
                return res.status(401).json({ error: 'No token provided' });
            }
            const token = header.split(' ')[1];
            if (token === 'admin-token') {
                req.user = { id: 'admin-1', role: 'admin' };
            } else {
                req.user = { id: 'mentor-1', role: 'mentor' };
            }
            return next();
        }
    };

    require.cache[authzMiddlewarePath] = {
        id: authzMiddlewarePath,
        filename: authzMiddlewarePath,
        loaded: true,
        exports: {
            requireRole: (role) => (req, res, next) => {
                if (!req.user || req.user.role !== role) {
                    return res.status(403).json({ error: 'Forbidden' });
                }
                return next();
            }
        }
    };

    return require(adminRoutePath);
}

async function makeRequest(router, method, routePath, token) {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', router);

    const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });

    const { port } = server.address();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
        const response = await fetch(`http://127.0.0.1:${port}${routePath}`, {
            method,
            headers
        });
        return response.status;
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function testAdminRoutesGuarding() {
    const router = loadAdminRouterWithMocks();

    const noTokenStatus = await makeRequest(router, 'GET', '/api/admin/users');
    assert.equal(noTokenStatus, 401);

    const nonAdminStatus = await makeRequest(router, 'GET', '/api/admin/users', 'mentor-token');
    assert.equal(nonAdminStatus, 403);

    const adminGetStatus = await makeRequest(router, 'GET', '/api/admin/users', 'admin-token');
    assert.equal(adminGetStatus, 200);

    const adminDeleteStatus = await makeRequest(router, 'DELETE', '/api/admin/users/user-1', 'admin-token');
    assert.equal(adminDeleteStatus, 200);
}

function testAdminClientHeaders() {
    const source = fs.readFileSync(clientApiPath, 'utf8');

    assert.match(
        source,
        /export const getAdminUsers[\s\S]*headers:\s*getAuthHeaders\(\)/
    );
    assert.match(
        source,
        /export const deleteUserAccount[\s\S]*headers:\s*getAuthHeaders\(\)/
    );
}

async function run() {
    await testAdminRoutesGuarding();
    testAdminClientHeaders();
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
