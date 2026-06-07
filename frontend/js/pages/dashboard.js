/**
 * 仪表盘页面
 *
 * 展示内容：
 * 1. 四个状态统计卡片（待审核/待同步/已同步/已拒绝）
 * 2. 最新 5 条待审核投稿（快捷操作入口）
 *
 * 各统计卡片可点击，跳转到投稿管理页并自动筛选对应状态。
 */

async function renderDashboard() {
    const el = document.getElementById('page-dashboard');
    try {
        // 并行请求统计数据 + 最新待审核列表
        const [statsRes, recentRes] = await Promise.all([
            API.getStats(),
            API.getPosts({ status: 'pending_review', size: 5 })
        ]);
        const stats = statsRes.stats || {};
        const recent = recentRes ? recentRes.posts || [] : [];

        el.innerHTML = `
            <div class="page-header">
                <h1>仪表盘</h1>
            </div>
            <!-- 统计卡片：点击可跳转到对应状态的投稿管理页 -->
            <div class="stats-grid">
                <div class="stat-card pending-review" onclick="showPage('review')">
                    <div class="stat-label">待审核</div>
                    <div class="stat-value" style="color:#f59e0b">${stats.pending_review || 0}</div>
                    <div class="stat-desc">点击进入审核</div>
                </div>
                <div class="stat-card pending" onclick="showPage('posts');filterPosts('pending')">
                    <div class="stat-label">待同步</div>
                    <div class="stat-value" style="color:#4f6ef7">${stats.pending || 0}</div>
                    <div class="stat-desc">等待同步到 Halo</div>
                </div>
                <div class="stat-card synced" onclick="showPage('posts');filterPosts('synced')">
                    <div class="stat-label">已同步</div>
                    <div class="stat-value" style="color:#22c55e">${stats.synced || 0}</div>
                    <div class="stat-desc">已发布到 Halo</div>
                </div>
                <div class="stat-card rejected" onclick="showPage('posts');filterPosts('rejected')">
                    <div class="stat-label">已拒绝</div>
                    <div class="stat-value" style="color:#ef4444">${stats.rejected || 0}</div>
                    <div class="stat-desc">已被管理员拒绝</div>
                </div>
            </div>
            <div class="section-title">最新待审核投稿</div>
            <!-- 最新待审核列表（简洁模式，不带复选框） -->
            <div class="post-list">
                ${recent.length === 0 ? '<div class="empty-state"><div class="empty-icon">🎉</div><p>没有待审核的投稿</p></div>' : ''}
                ${recent.map(p => renderPostItem(p, true)).join('')}
            </div>
        `;
    } catch (e) {
        el.innerHTML = '<div class="empty-state"><p>加载失败：' + e.message + '</p></div>';
    }
}
