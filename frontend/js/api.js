/**
 * API 请求封装层
 *
 * 所有对后端 REST API 的调用都通过此模块完成。
 * 统一处理：token 注入、401 跳转登录、错误提示。
 * 新增 API 端点时，在这里加一个方法即可。
 */

// API_BASE 为空字符串表示同域请求（Nginx 反代到 Flask）
// 如果前后端分离部署在不同域名，需改成后端地址并处理 CORS
const API_BASE = '';

const API = {
    /**
     * 从 localStorage 读取登录 token
     * token 在登录成功后由 setToken() 存入
     */
    getToken() {
        return localStorage.getItem('token');
    },

    /**
     * 登录成功后保存 token
     * @param {string} token - 后端返回的 32 位 hex 字符串
     */
    setToken(token) {
        localStorage.setItem('token', token);
    },

    /**
     * 退出登录时清除 token
     */
    clearToken() {
        localStorage.removeItem('token');
    },

    /**
     * 核心请求方法：所有 API 调用最终都走这里
     *
     * @param {string} method  - HTTP 方法（GET/POST）
     * @param {string} path    - API 路径（如 /api/posts）
     * @param {object} [body]  - POST 请求体（可选）
     * @returns {object|null}  解析后的 JSON 响应
     * @throws {Error}         请求失败或业务错误
     */
    async request(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        const opts = { method, headers };
        if (body) {
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(API_BASE + path, opts);
        // 401 表示未登录或 token 过期，清除 token 并跳转登录页
        if (res.status === 401) {
            this.clearToken();
            window.location.hash = '#/login';
            showPage('login');
            return null;
        }
        const data = await res.json();
        if (!res.ok && data.error) {
            throw new Error(data.error);
        }
        return data;
    },

    // ========== 以下为各业务 API 的快捷方法 ==========

    /** 管理员登录：POST /api/login */
    login(password) {
        return this.request('POST', '/api/login', { password });
    },

    /** 获取各状态统计：GET /api/stats */
    getStats() {
        return this.request('GET', '/api/stats');
    },

    /**
     * 获取投稿列表：GET /api/posts
     * @param {object} params - { status, page, size }
     */
    getPosts(params = {}) {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.page) qs.set('page', params.page);
        if (params.size) qs.set('size', params.size);
        const path = '/api/posts' + (qs.toString() ? '?' + qs.toString() : '');
        return this.request('GET', path);
    },

    /** 获取单条投稿：GET /api/posts/:id */
    getPost(id) {
        return this.request('GET', '/api/posts/' + id);
    },

    /** 手动创建投稿：POST /api/posts/create */
    createPost(data) {
        return this.request('POST', '/api/posts/create', data);
    },

    /** 审核通过单条：POST /api/posts/:id/approve */
    approvePost(id) {
        return this.request('POST', '/api/posts/' + id + '/approve');
    },

    /** 拒绝单条：POST /api/posts/:id/reject */
    rejectPost(id) {
        return this.request('POST', '/api/posts/' + id + '/reject');
    },

    /** 批量操作：POST /api/posts/batch （ids + action） */
    batchAction(ids, action) {
        return this.request('POST', '/api/posts/batch', { ids, action });
    },

    /** 同步到 Halo：POST /api/posts/sync-to-halo */
    syncToHalo(data) {
        return this.request('POST', '/api/posts/sync-to-halo', data);
    },

    /** 手动同步 tduck 数据：POST /api/tduck/sync */
    syncTduck() {
        return this.request('POST', '/api/tduck/sync');
    },

    /** 获取定时任务状态：GET /api/scheduler/status */
    getSchedulerStatus() {
        return this.request('GET', '/api/scheduler/status');
    },

    /** 测试 Halo 连接：GET /test/halo（无需认证） */
    testHalo() {
        return this.request('GET', '/test/halo');
    },

    /** 测试 tduck 连接：GET /test/tduck（无需认证） */
    testTduck() {
        return this.request('GET', '/test/tduck');
    }
};
