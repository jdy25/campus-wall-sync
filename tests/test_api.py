"""
API 接口测试

覆盖新增功能 + 原有核心流程完整性：
1. 登录鉴权
2. 手动创建投稿（改为 pending_review）
3. 审核通过（pending_review → pending）
4. 拒绝投稿
5. 批量操作
6. 统计接口
7. 状态流转完整性
8. 敏感词过滤与原 Webhook 流程
"""

import pytest
import tempfile
import os
import json
from src import config as config_module
from src.config import Config
from src.database import init_db, get_session, reset_db, close_db
from src.models import Post


class TestAPI:
    """测试 API 接口功能"""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """每个测试前后重置数据库和配置"""
        reset_db()
        Config.reset()
        yield
        reset_db()
        Config.reset()

    def _setup_test_env(self, tmpdir):
        """设置测试环境：临时 config.json + 临时数据库"""
        db_path = os.path.join(tmpdir, "test.db")
        config_path = os.path.join(tmpdir, "config.json")
        with open(config_path, "w") as f:
            json.dump({
                "database": {"path": db_path},
                "admin": {"password": "test123"},
                "content_filter": {"replace_mode": True}
            }, f)
        os.environ["CONFIG_PATH"] = config_path
        Config.reset()
        config_module.config = Config()
        init_db()

        from src.app import create_app
        app = create_app()
        app.config["TESTING"] = True
        client = app.test_client()

        return client, get_session()

    def _cleanup(self):
        """清理测试环境"""
        close_db()
        if "CONFIG_PATH" in os.environ:
            del os.environ["CONFIG_PATH"]

    def _login(self, client, password="test123"):
        """辅助方法：登录并返回 token"""
        resp = client.post("/api/login", json={"password": password})
        data = resp.get_json()
        assert resp.status_code == 200
        assert "token" in data
        return data["token"]

    # ===== 1. 登录鉴权 =====

    def test_login_success(self):
        """登录成功应返回 token"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            token = self._login(client)
            assert len(token) == 32  # secrets.token_hex(16) = 32 字符
            self._cleanup()

    def test_login_wrong_password(self):
        """密码错误应返回 401"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            resp = client.post("/api/login", json={"password": "wrong"})
            assert resp.status_code == 401
            data = resp.get_json()
            assert "密码错误" in data.get("error", "")
            self._cleanup()

    def test_auth_required_for_api(self):
        """未登录访问 API 应返回 401"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            resp = client.get("/api/posts")
            assert resp.status_code == 401
            resp2 = client.get("/api/stats")
            assert resp2.status_code == 401
            resp3 = client.post("/api/posts/1/approve")
            assert resp3.status_code == 401
            self._cleanup()

    def test_health_no_auth(self):
        """健康检查不需要登录"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            resp = client.get("/health")
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["status"] == "ok"
            self._cleanup()

    # ===== 2. 手动创建投稿 =====

    def test_create_post_as_pending_review(self):
        """手动创建的投稿状态应为 pending_review"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.post("/api/posts/create", json={
                "title": "测试投稿",
                "content": "这是一条测试内容",
                "class_name": "计算机1班",
                "user_name": "张三"
            }, headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["status"] == "success"
            assert data["post"]["status"] == "pending_review"
            self._cleanup()

    def test_create_post_empty_title(self):
        """标题为空应返回错误"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.post("/api/posts/create", json={
                "title": "",
                "content": "内容"
            }, headers=headers)
            assert resp.status_code == 400
            self._cleanup()

    # ===== 3. 审核通过 =====

    def test_approve_post(self):
        """审核通过：pending_review → pending"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            post = Post(title="测试", content="内容", status="pending_review")
            session.add(post)
            session.commit()
            post_id = post.id

            resp = client.post(f"/api/posts/{post_id}/approve", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["post"]["status"] == "pending"

            session.close()
            self._cleanup()

    def test_approve_non_pending_review(self):
        """非 pending_review 状态的投稿不可审核通过"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            post = Post(title="测试", content="内容", status="synced")
            session.add(post)
            session.commit()
            post_id = post.id

            resp = client.post(f"/api/posts/{post_id}/approve", headers=headers)
            assert resp.status_code == 400  # 状态不对，拒绝

            session.close()
            self._cleanup()

    def test_approve_nonexistent_post(self):
        """不存在的投稿应返回 404"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.post("/api/posts/99999/approve", headers=headers)
            assert resp.status_code == 404
            self._cleanup()

    # ===== 4. 拒绝投稿 =====

    def test_reject_post(self):
        """拒绝后状态为 rejected"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            post = Post(title="测试", content="内容", status="pending_review")
            session.add(post)
            session.commit()
            post_id = post.id

            resp = client.post(f"/api/posts/{post_id}/reject", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["post"]["status"] == "rejected"

            session.close()
            self._cleanup()

    # ===== 5. 批量操作 =====

    def test_batch_approve(self):
        """批量通过"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            posts = [
                Post(title=f"测试{i}", content="内容", status="pending_review")
                for i in range(3)
            ]
            session.add_all(posts)
            session.commit()
            ids = [p.id for p in posts]

            resp = client.post("/api/posts/batch", json={
                "ids": ids, "action": "approve"
            }, headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["affected"] == 3

            all_pending = session.query(Post).filter(Post.status == "pending").count()
            assert all_pending == 3

            session.close()
            self._cleanup()

    def test_batch_reject(self):
        """批量拒绝"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            posts = [
                Post(title=f"测试{i}", content="内容", status="pending_review")
                for i in range(3)
            ]
            session.add_all(posts)
            session.commit()
            ids = [p.id for p in posts]

            resp = client.post("/api/posts/batch", json={
                "ids": ids, "action": "reject"
            }, headers=headers)
            assert resp.status_code == 200

            all_rejected = session.query(Post).filter(Post.status == "rejected").count()
            assert all_rejected == 3

            session.close()
            self._cleanup()

    def test_batch_invalid_action(self):
        """无效的批量操作应返回 400"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, _ = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.post("/api/posts/batch", json={
                "ids": [1], "action": "invalid"
            }, headers=headers)
            assert resp.status_code == 400
            self._cleanup()

    # ===== 6. 统计接口 =====

    def test_stats(self):
        """统计接口应返回各状态数量"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            posts = [
                Post(title="待审核1", content="内容", status="pending_review"),
                Post(title="待审核2", content="内容", status="pending_review"),
                Post(title="待同步", content="内容", status="pending"),
                Post(title="已同步", content="内容", status="synced"),
                Post(title="已拒绝", content="内容", status="rejected"),
            ]
            session.add_all(posts)
            session.commit()

            resp = client.get("/api/stats", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["stats"]["pending_review"] == 2
            assert data["stats"]["pending"] == 1
            assert data["stats"]["synced"] == 1
            assert data["stats"]["rejected"] == 1

            session.close()
            self._cleanup()

    # ===== 7. 状态流转完整性 =====

    def test_full_status_flow(self):
        """完整状态流转：pending_review → pending → synced"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            # 1. 创建投稿 → pending_review
            post = Post(title="流程测试", content="内容", status="pending_review")
            session.add(post)
            session.commit()
            post_id = post.id

            # 2. 审核通过 → pending
            resp = client.post(f"/api/posts/{post_id}/approve", headers=headers)
            assert resp.status_code == 200
            session.expire_all()  # 刷新 session，从数据库重新加载
            updated = session.query(Post).filter(Post.id == post_id).first()
            assert updated.status == "pending"

            # 3. 标记为已同步 → synced（模拟 Halo 同步）
            updated.status = "synced"
            updated.halo_post_id = "halo-post-001"
            session.commit()
            session.expire_all()
            final = session.query(Post).filter(Post.id == post_id).first()
            assert final.status == "synced"
            assert final.halo_post_id == "halo-post-001"

            session.close()
            self._cleanup()

    def test_reject_flow(self):
        """拒绝流程：pending_review → rejected"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            post = Post(title="拒绝测试", content="内容", status="pending_review")
            session.add(post)
            session.commit()
            post_id = post.id

            resp = client.post(f"/api/posts/{post_id}/reject", headers=headers)
            assert resp.status_code == 200
            session.expire_all()  # 刷新 session
            updated = session.query(Post).filter(Post.id == post_id).first()
            assert updated.status == "rejected"

            session.close()
            self._cleanup()

    # ===== 8. 投稿列表与筛选 =====

    def test_list_posts_filter_by_status(self):
        """投稿列表应按状态筛选"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            posts = [
                Post(title=f"{s}", content="内容", status=s)
                for s in ["pending_review", "pending", "synced", "rejected"]
            ]
            session.add_all(posts)
            session.commit()

            resp = client.get("/api/posts?status=pending_review", headers=headers)
            data = resp.get_json()
            assert data["total"] == 1
            assert data["posts"][0]["status"] == "pending_review"

            session.close()
            self._cleanup()

    def test_list_posts_pagination(self):
        """投稿列表应支持分页"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            posts = [Post(title=f"投稿{i}", content="内容", status="pending_review") for i in range(5)]
            session.add_all(posts)
            session.commit()

            resp = client.get("/api/posts?page=1&size=2", headers=headers)
            data = resp.get_json()
            assert data["total"] == 5
            assert data["page"] == 1
            assert data["size"] == 2
            assert len(data["posts"]) == 2

            session.close()
            self._cleanup()

    # ===== 9. 敏感词过滤兼容性 =====

    def test_create_post_with_sensitive_content_replace_mode(self):
        """敏感词过滤替换模式：包含敏感词的投稿应被替换后通过"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            from src.hooks.content_filter import SENSITIVE_WORDS
            if not SENSITIVE_WORDS:
                pytest.skip("无敏感词配置，跳过测试")

            word = SENSITIVE_WORDS[0]

            resp = client.post("/api/posts/create", json={
                "title": f"包含{word}的标题",
                "content": f"包含{word}的内容",
                "class_name": "测试班",
                "user_name": "测试"
            }, headers=headers)

            assert resp.status_code == 200
            data = resp.get_json()
            assert data["status"] == "success"
            assert data["post"]["status"] == "pending_review"
            assert word not in data["post"]["content"]

            session.close()
            self._cleanup()

    # ===== 10. 单条投稿详情 =====

    def test_get_post_detail(self):
        """获取单条投稿详情"""
        with tempfile.TemporaryDirectory() as tmpdir:
            client, session = self._setup_test_env(tmpdir)
            token = self._login(client)
            headers = {"Authorization": f"Bearer {token}"}

            post = Post(title="详情测试", content="详细内容", user_name="小明", class_name="计算机1班", status="pending_review")
            session.add(post)
            session.commit()
            post_id = post.id

            resp = client.get(f"/api/posts/{post_id}", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["post"]["title"] == "详情测试"
            assert data["post"]["content"] == "详细内容"
            assert data["post"]["user_name"] == "小明"
            assert data["post"]["class_name"] == "计算机1班"

            session.close()
            self._cleanup()
