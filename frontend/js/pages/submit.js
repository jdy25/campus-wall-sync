/**
 * 手动投稿页面
 *
 * 提供一个表单让管理员手动创建投稿。
 * 提交后会进入 pending_review 审核流程。
 */

/**
 * 渲染手动投稿表单
 */
function renderSubmitPage() {
    const el = document.getElementById('page-submit');
    el.innerHTML = `
        <div class="page-header">
            <h1>手动投稿</h1>
        </div>
        <div class="form-card">
            <div class="form-group">
                <label>标题 *</label>
                <input type="text" id="submit-title" placeholder="投稿标题">
            </div>
            <div class="form-group">
                <label>内容 *</label>
                <textarea id="submit-content" placeholder="请输入投稿内容..."></textarea>
            </div>
            <div class="form-group">
                <label>班级</label>
                <input type="text" id="submit-class" placeholder="如：计算机1班">
            </div>
            <div class="form-group">
                <label>姓名</label>
                <input type="text" id="submit-name" placeholder="如：张三">
            </div>
            <button class="btn btn-primary" onclick="handleSubmit()">提交投稿</button>
        </div>
    `;
}

/**
 * 提交投稿
 * 获取表单数据 → 调 API.createPost() → 成功则清空并提示
 */
async function handleSubmit() {
    const data = {
        title: document.getElementById('submit-title').value.trim(),
        content: document.getElementById('submit-content').value.trim(),
        class_name: document.getElementById('submit-class').value.trim(),
        user_name: document.getElementById('submit-name').value.trim()
    };
    if (!data.title || !data.content) {
        showToast('标题和内容不能为空', 'error');
        return;
    }
    try {
        await API.createPost(data);
        showToast('投稿成功，等待审核', 'success');
        // 清空表单
        document.getElementById('submit-title').value = '';
        document.getElementById('submit-content').value = '';
        document.getElementById('submit-class').value = '';
        document.getElementById('submit-name').value = '';
    } catch (e) {
        showToast(e.message, 'error');
    }
}
