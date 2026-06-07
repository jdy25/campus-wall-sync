/**
 * 投稿管理页面
 *
 * 展示所有投稿，支持按状态筛选和分页。
 * 不同状态的投稿显示不同的操作按钮：
 * - 待审核：显示「去审核」提示
 * - 待同步：显示「同步到 Halo」按钮
 * - 已同步：显示 Halo 文章链接
 */

let postsPage = 1;       // 当前页码
let postsStatus = '';    // 当前筛选状态（'' 表示全部）
let postsSelected = new Set();

/**
 * 渲染投稿管理页面
 */
async function renderPosts() {
    const el = document.getElementById('page-posts');
    postsSelected.clear();
    try {
        const status = postsStatus || undefined;
        const res = await API.getPosts({ status, page: postsPage, size: 20 });
        const posts = res.posts || [];
        const total = res.total || 0;
        const totalPages = Math.ceil(total / 20);

        // 状态筛选标签
        const statuses = [
            { value: '', label: '全部' },
            { value: 'pending_review', label: '待审核' },
            { value: 'pending', label: '待同步' },
            { value: 'synced', label: '已同步' },
            { value: 'rejected', label: '已拒绝' }
        ];

        el.innerHTML = `
            <div class="page-header">
                <h1>投稿管理</h1>
                <span style="font-size:14px;color:var(--text-secondary)">共 ${total} 条</span>
            </div>
            <!-- 筛选标签 -->
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
                ${statuses.map(s => `
                    <button class="btn ${postsStatus === s.value ? 'btn-primary' : 'btn-outline'} btn-sm"
                        onclick="filterPosts('${s.value}')">${s.label}</button>
                `).join('')}
            </div>
            <!-- 投稿列表 -->
            <div class="post-list">
                ${posts.length === 0 ? '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无投稿</p></div>' : ''}
                ${posts.map(p => renderPostItem(p, false, 'posts')).join('')}
            </div>
            ${totalPages > 1 ? renderPagination(postsPage, totalPages, 'posts') : ''}
        `;
    } catch (e) {
        el.innerHTML = '<div class="empty-state"><p>加载失败：' + e.message + '</p></div>';
    }
}

/**
 * 按状态筛选（被筛选标签按钮调用）
 * @param {string} status - 状态值或 '' 表示全部
 */
function filterPosts(status) {
    postsStatus = status;
    postsPage = 1;  // 切回第一页
    renderPosts();
}

/**
 * 翻页
 */
function goPostsPage(p) {
    postsPage = p;
    renderPosts();
}
