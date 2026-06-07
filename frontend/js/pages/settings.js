/**
 * 系统管理页面
 *
 * 展示三类系统状态，每类一个卡片：
 * 1. tduck 连接 —— 测试连接、手动同步数据
 * 2. Halo 博客 —— 测试连接
 * 3. 定时任务 —— 运行状态、手动触发
 */

/**
 * 渲染系统管理页面
 * 并行请求三个状态接口，完成后渲染卡片
 */
async function renderSettings() {
    const el = document.getElementById('page-settings');
    // 先显示加载中
    el.innerHTML = '<div class="page-header"><h1>系统管理</h1></div><div class="settings-grid" id="settings-grid"><div class="settings-card"><h3>⏳ 加载中...</h3></div></div>';

    try {
        // 并行请求三个状态，各自失败不影响其他卡片
        const [tduckRes, haloRes, schedRes] = await Promise.allSettled([
            API.testTduck(),
            API.testHalo(),
            API.getSchedulerStatus()
        ]);

        // 解析 tduck 状态
        const tduckOk = tduckRes.status === 'fulfilled' && tduckRes.value && tduckRes.value.status === 'ok';
        const tduckMsg = tduckOk ? tduckRes.value.message : (tduckRes.status === 'fulfilled' ? tduckRes.value.error : '连接失败');

        // 解析 Halo 状态
        const haloOk = haloRes.status === 'fulfilled' && haloRes.value && haloRes.value.status !== 'error';
        const haloMsg = haloOk ? (haloRes.value.message || '连接正常') : (haloRes.status === 'fulfilled' ? haloRes.value.error || '已禁用' : '连接失败');

        // 解析定时任务状态
        const sched = schedRes.status === 'fulfilled' && schedRes.value ? schedRes.value.scheduler || {} : {};

        // 渲染三个卡片
        document.getElementById('settings-grid').innerHTML = `
            <div class="settings-card">
                <h3>🔗 tduck 连接</h3>
                <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value ${tduckOk ? 'status-ok' : 'status-err'}">${tduckOk ? '✅ 正常' : '❌ 异常'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">信息</span>
                    <span class="info-value">${tduckMsg}</span>
                </div>
                <div style="margin-top:12px">
                    <button class="btn btn-outline btn-sm" onclick="testTduckConn()">测试连接</button>
                    <button class="btn btn-warning btn-sm" onclick="manualSyncTduck()" style="margin-left:8px">手动同步 tduck</button>
                </div>
            </div>
            <div class="settings-card">
                <h3>📝 Halo 博客</h3>
                <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value ${haloOk ? 'status-ok' : 'status-err'}">${haloOk ? '✅ 正常' : '❌ 异常'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">信息</span>
                    <span class="info-value">${haloMsg}</span>
                </div>
                <div style="margin-top:12px">
                    <button class="btn btn-outline btn-sm" onclick="testHaloConn()">测试连接</button>
                </div>
            </div>
            <div class="settings-card">
                <h3>⏰ 定时任务</h3>
                <div class="info-row">
                    <span class="info-label">运行状态</span>
                    <span class="info-value">${sched.running ? '✅ 运行中' : '⏹ 已停止'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">下次执行</span>
                    <span class="info-value">${sched.next_run_time ? formatTime(sched.next_run_time) : '-'}</span>
                </div>
                <div style="margin-top:12px">
                    <button class="btn btn-outline btn-sm" onclick="triggerSync()">手动触发同步</button>
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById('settings-grid').innerHTML = '<div class="settings-card"><h3>❌ 加载失败</h3><p>' + e.message + '</p></div>';
    }
}

/**
 * 测试 tduck 连接
 */
async function testTduckConn() {
    try {
        const res = await API.testTduck();
        showToast(res.message || 'tduck 连接正常', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 测试 Halo 连接
 */
async function testHaloConn() {
    try {
        const res = await API.testHalo();
        showToast(res.message || res.status || 'Halo 连接正常', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 手动同步 tduck 数据到本地数据库
 */
async function manualSyncTduck() {
    try {
        showToast('正在同步 tduck 数据...', 'success');
        const res = await API.syncTduck();
        showToast('同步完成：成功 ' + (res.success || 0) + ' 条，跳过 ' + (res.skipped || 0) + ' 条', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/**
 * 手动触发同步任务
 */
async function triggerSync() {
    try {
        await API.request('POST', '/api/scheduler/run');
        showToast('同步任务已触发', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}
