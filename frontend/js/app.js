/**
 * 应用主逻辑
 *
 * 职责：
 * 1. 页面路由与切换（showPage）
 * 2. 登录/登出处理
 * 3. 全局工具函数（renderPostItem、分页、toast 等）
 * 4. 定时轮询待审核数量
 */

// 当前页面名称，用于高亮导航
let currentPage = 'dashboard';
// 待审核投稿数量（侧边栏 badge 用）
let pendingReviewCount = 0;

/**
 * DOM 加载完成后，检查是否有已保存的 token
 * 有 → 直接进入主界面
 * 无 → 停留在登录页
 */
document.addEventListener('DOMContentLoaded', () => {
    const token = API.getToken();
    if (token) {
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-main').classList.add('active');
        showPage('dashboard');
        startPolling();
    }
});

/**
 * 切换页面
 * @param {string} name - 页面名称（dashboard/review/posts/submit/settings）
 *
 * 流程：
 * 1. 检查 token（没有则回退到登录页）
 * 2. 隐藏所有 page-section，显示目标页面
 * 3. 更新侧边栏高亮
 * 4. 调用对应页面的 render 函数
 */
function showPage(name) {
    if (!API.getToken()) {
        document.getElementById('page-login').classList.add('active');
        document.getElementById('page-main').classList.remove('active');
        return;
    }
    currentPage = name;
    // 隐藏所有页面
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // 显示目标页面
    const section = document.getElementById('page-' + name);
    if (section) section.classList.add('active');
    const navItem = document.querySelector('.nav-item[data-page="' + name + '"]');
    if (navItem) navItem.classList.add('active');

    // 调用对应页面的渲染函数
    switch (name) {
        case 'dashboard': renderDashboard(); break;
        case 'review': renderReview(); break;
        case 'posts': renderPosts(); break;
        case 'submit': renderSubmitPage(); break;
        case 'settings': renderSettings(); break;
    }
}

/**
 * 登录按钮处理
 * 从输入框获取密码 → 调 API.login() → 成功则存 token 进入主界面
 */
async function handleLogin() {
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    if (!password) {
        errorEl.textContent = '请输入密码';
        return;
    }
    try {
        const res = await API.login(password);
        if (res && res.token) {
            API.setToken(res.token);
            errorEl.textContent = '';
            document.getElementById('page-login').classList.remove('active');
            document.getElementById('page-main').classList.add('active');
            showPage('dashboard');
            startPolling();
        }
    } catch (e) {
        errorEl.textContent = e.message || '登录失败';
    }
}

/**
 * 退出登录：清除 token + 回到登录页
 */
function handleLogout() {
    API.clearToken();
    document.getElementById('page-main').classList.remove('active');
    document.getElementById('page-login').classList.add('active');
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
}

// 登录页按 Enter 键触发登录
document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});

/**
 * 显示全局消息提示
 * @param {string} msg  - 消息内容
 * @param {string} type - 类型（success/error）
 *
 * 3 秒后自动消失
 */
function showToast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type + ' show';
    setTimeout(() => el.classList.remove('show'), 3000);
}

/**
 * 将状态英文转为中文
 * @param {string} s - 状态值（pending_review/pending/synced/rejected）
 */
function statusLabel(s) {
    const map = { pending_review: '待审核', pending: '待同步', synced: '已同步', rejected: '已拒绝' };
    return map[s] || s;
}

/**
 * 生成状态标签 HTML
 */
function statusTag(s) {
    return '<span class="status-tag status-' + s + '">' + statusLabel(s) + '</span>';
}

/**
 * 格式化时间：去掉 T 并取前 16 位
 */
function formatTime(t) {
    if (!t) return '-';
    return t.replace('T', ' ').substring(0, 16);
}

// ==================== 定时轮询 ====================

/**
 * 每 15 秒查询一次待审核数量，更新侧边栏 badge
 */
async function startPolling() {
    const poll = async () => {
        try {
            const res = await API.getPosts({ status: 'pending_review', size: 1 });
            if (res) {
                pendingReviewCount = res.total || 0;
                const badge = document.getElementById('review-badge');
                if (pendingReviewCount > 0) {
                    badge.textContent = pendingReviewCount > 99 ? '99+' : pendingReviewCount;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {
            // 轮询失败静默处理，下次继续
        }
    };
    await poll();              // 立即执行一次
    setInterval(poll, 15000);  // 之后每 15 秒
}

// ==================== 通用渲染工具 ====================

/**
 * 渲染单条投稿的 HTML（用于列表展示）
 *
 * @param {object}  p        - 投稿对象（from API）
 * @param {boolean} isSimple - 是否为简洁模式（仪表盘用，不显示状态标签）
 * @param {string}  context  - 上下文标识（review/posts），用于区分复选框组
 * @returns {string} 投稿列表项的 HTML
 *
 * 根据投稿状态显示不同的操作按钮：
 * - pending_review：显示「通过」「拒绝」
 * - pending：显示「同步到 Halo」
 * - synced：显示 Halo 文章链接
 */
function renderPostItem(p, isSimple, context) {
    const checkbox = !isSimple ? `<input type="checkbox" class="post-checkbox" data-id="${p.id}" data-context="${context || ''}" onchange="updateSelectAllBtn('${context || ''}')">` : '';
    const statusEl = isSimple ? '' : `<div style="margin-bottom:6px">${statusTag(p.status)}</div>`;
    const actions = isSimple ? `
        <div class="post-actions">
            <button class="btn btn-success btn-sm" onclick="handleApprove(${p.id})">通过</button>
            <button class="btn btn-danger btn-sm" onclick="handleReject(${p.id})">拒绝</button>
            <button class="btn btn-outline btn-sm" onclick="togglePostFull(this)">展开</button>
        </div>
    ` : `
        <div class="post-actions">
            ${p.status === 'pending_review' ? `
                <button class="btn btn-success btn-sm" onclick="handleApprove(${p.id})">通过</button>
                <button class="btn btn-danger btn-sm" onclick="handleReject(${p.id})">拒绝</button>
            ` : ''}
            ${p.status === 'pending' ? `
                <button class="btn btn-warning btn-sm" onclick="syncSingle(${p.id})">同步到 Halo</button>
            ` : ''}
            ${p.halo_post_url ? `<a href="${p.halo_post_url}" target="_blank" class="btn btn-outline btn-sm">查看 Halo</a>` : ''}
            <button class="btn btn-outline btn-sm" onclick="togglePostFull(this)">展开</button>
        </div>
    `;
    const preview = p.content ? (p.content.length > 100 ? p.content.substring(0, 100) + '...' : p.content) : '';
    return `
        <div class="post-item">
            ${checkbox}
            <div class="post-body">
                <div class="post-title">${p.title}</div>
                ${statusEl}
                <div class="post-meta">
                    <span>👤 ${p.author || '匿名'}</span>
                    ${p.class_name ? `<span>🏫 ${p.class_name}</span>` : ''}
                    ${p.user_name ? `<span>📝 ${p.user_name}</span>` : ''}
                    <span>🕐 ${formatTime(p.created_at)}</span>
                    ${p.status === 'synced' && p.halo_post_id ? `<span>📎 ${p.halo_post_id}</span>` : ''}
                </div>
                <div class="post-preview">${escapeHtml(preview)}</div>
                <div class="post-full">${escapeHtml(p.content || '')}</div>
            </div>
            ${actions}
        </div>
    `;
}

/**
 * 渲染分页控件
 * @param {number} current - 当前页码
 * @param {number} total   - 总页数
 * @param {string} context - 上下文（review/posts），决定点击回调
 *
 * 分页按钮调用 goReviewPage(p) 或 goPostsPage(p)
 */
function renderPagination(current, total, context) {
    let html = '<div class="pagination">';
    if (current > 1) html += `<button class="btn btn-outline btn-sm" onclick="go${context.charAt(0).toUpperCase() + context.slice(1)}Page(${current - 1})">上一页</button>`;
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline'}" onclick="go${context.charAt(0).toUpperCase() + context.slice(1)}Page(${i})">${i}</button>`;
    }
    if (current < total) html += `<button class="btn btn-outline btn-sm" onclick="go${context.charAt(0).toUpperCase() + context.slice(1)}Page(${current + 1})">下一页</button>`;
    html += `<span style="font-size:13px;color:var(--text-secondary);margin-left:8px">${current}/${total}</span></div>`;
    return html;
}

/**
 * 展开/收起投稿全文
 */
function togglePostFull(btn) {
    const full = btn.closest('.post-item').querySelector('.post-full');
    if (full) {
        full.classList.toggle('show');
        btn.textContent = full.classList.contains('show') ? '收起' : '展开';
    }
}

/**
 * 全选/取消全选（某一组复选框）
 * @param {HTMLInputElement} master - 全选复选框
 * @param {string} context - 上下文标识
 */
function toggleSelectAll(master, context) {
    const checked = master.checked;
    document.querySelectorAll(`.post-checkbox[data-context="${context}"]`).forEach(cb => cb.checked = checked);
}

/**
 * 更新全选复选框状态：当某个子项取消勾选时，自动取消全选
 */
function updateSelectAllBtn(context) {
    const cbs = document.querySelectorAll(`.post-checkbox[data-context="${context}"]`);
    const master = document.getElementById(context + '-select-all');
    if (master && cbs.length > 0) {
        master.checked = Array.from(cbs).every(cb => cb.checked);
    }
}

/**
 * 获取已选中的投稿 ID 列表
 */
function getSelectedIds(context) {
    return Array.from(document.querySelectorAll(`.post-checkbox[data-context="${context}"]:checked`)).map(cb => parseInt(cb.dataset.id));
}

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 将单条投稿同步到 Halo
 * @param {number} id - 投稿 ID
 */
async function syncSingle(id) {
    try {
        const res = await API.syncToHalo({ post_ids: [id], mode: 'new' });
        showToast('同步完成，共 ' + (res.synced_count || 0) + ' 条', 'success');
        renderPosts();
    } catch (e) {
        showToast(e.message, 'error');
    }
}
