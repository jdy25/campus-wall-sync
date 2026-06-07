/**
 * 审核页面（核心功能）
 *
 * 展示所有 pending_review 状态的投稿，提供：
 * - 单条：展开全文、通过（→ pending）、拒绝（→ rejected）
 * - 批量：全选 → 批量通过 / 批量拒绝
 * - 分页
 */

let reviewPage = 1;       // 当前页码
let reviewSelected = new Set();  // 已选中的投稿 ID（备用）

/**
 * 渲染审核页面
 * 调 API 获取待审核列表，渲染到 #page-review
 */
async function renderReview() {
    const el = document.getElementById('page-review');
    reviewSelected.clear();
    try {
        const res = await API.getPosts({ status: 'pending_review', page: reviewPage, size: 20 });
        const posts = res.posts || [];
        const total = res.total || 0;
        const totalPages = Math.ceil(total / 20);

        el.innerHTML = `
            <div class="page-header">
                <h1>投稿审核</h1>
                <span style="font-size:14px;color:var(--text-secondary)">共 ${total} 条待审核</span>
            </div>
            <!-- 批量操作栏：有投稿时才显示 -->
            <div class="batch-actions" id="review-batch" style="${posts.length === 0 ? 'display:none' : ''}">
                <input type="checkbox" id="review-select-all" onchange="toggleSelectAll(this, 'review')">
                <label for="review-select-all" style="font-size:13px">全选</label>
                <button class="btn btn-success btn-sm" onclick="batchApprove()">批量通过</button>
                <button class="btn btn-danger btn-sm" onclick="batchReject()">批量拒绝</button>
            </div>
            <!-- 投稿列表 -->
            <div class="post-list" id="review-list">
                ${posts.length === 0 ? '<div class="empty-state"><div class="empty-icon">✅</div><p>没有待审核的投稿</p></div>' : ''}
                ${posts.map(p => renderPostItem(p, false, 'review')).join('')}
            </div>
            ${totalPages > 1 ? renderPagination(reviewPage, totalPages, 'review') : ''}
        `;
    } catch (e) {
        el.innerHTML = '<div class="empty-state"><p>加载失败：' + e.message + '</p></div>';
    }
}

/**
 * 单条审核通过
 */
async function handleApprove(id) {
    try {
        await API.approvePost(id);
        showToast('已审核通过', 'success');
        renderReview();  // 重新加载列表
        updateBadge();   // 更新侧边栏角标
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 单条拒绝
 */
async function handleReject(id) {
    try {
        await API.rejectPost(id);
        showToast('已拒绝', 'success');
        renderReview();
        updateBadge();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 批量通过
 * 获取所有选中的复选框 ID → 调 batchAction API
 */
async function batchApprove() {
    const ids = getSelectedIds('review');
    if (ids.length === 0) { showToast('请先选择投稿', 'error'); return; }
    try {
        await API.batchAction(ids, 'approve');
        showToast('已批量通过 ' + ids.length + ' 条', 'success');
        renderReview();
        updateBadge();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 批量拒绝
 */
async function batchReject() {
    const ids = getSelectedIds('review');
    if (ids.length === 0) { showToast('请先选择投稿', 'error'); return; }
    try {
        await API.batchAction(ids, 'reject');
        showToast('已批量拒绝 ' + ids.length + ' 条', 'success');
        renderReview();
        updateBadge();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 翻页
 */
function goReviewPage(p) {
    reviewPage = p;
    renderReview();
}

/**
 * 更新侧边栏待审核数量角标
 * 每次审核操作后调用
 */
async function updateBadge() {
    try {
        const res = await API.getPosts({ status: 'pending_review', size: 1 });
        const count = res ? res.total || 0 : 0;
        pendingReviewCount = count;
        const badge = document.getElementById('review-badge');
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {}
}
