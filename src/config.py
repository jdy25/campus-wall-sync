"""
配置管理模块

负责从 config.json 读取所有配置信息，将密钥和敏感配置与代码分离。
开发组只需要修改 config.json，不需要碰代码。

配置文件结构说明：
- app: Flask 应用配置
- database: SQLite 数据库配置
- halo: Halo 博客 API 配置
- tduck: tduck 表单平台配置
- review: 审核配置（人工/AI）
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional


class Config:
    """配置类，单例模式，全局唯一配置实例"""

    _instance: Optional["Config"] = None
    _config_data: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        """
        加载配置文件

        查找顺序：
        1. 当前目录的 config.json
        2. 上级目录的 config.json
        3. 环境变量 CONFIG_PATH 指定的路径
        """
        config_paths = [
            Path("config.json"),
            Path("../config.json"),
            Path(__file__).parent.parent / "config.json",
        ]

        # 检查环境变量
        env_config_path = os.environ.get("CONFIG_PATH")
        if env_config_path:
            config_paths.insert(0, Path(env_config_path))

        for config_path in config_paths:
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._config_data = json.load(f)
                print(f"[配置] 已加载配置文件: {config_path}")
                return

        raise FileNotFoundError(
            f"未找到配置文件！请复制 config.json.example 为 config.json 并填写配置"
        )

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置项

        Args:
            key: 配置键，支持点号分隔的嵌套键，如 "halo.api_url"
            default: 默认值

        Returns:
            配置值
        """
        keys = key.split(".")
        value = self._config_data

        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default

            if value is None:
                return default

        return value

    @property
    def app(self) -> Dict[str, Any]:
        """获取应用配置"""
        return self._config_data.get("app", {})

    @property
    def halo(self) -> Dict[str, Any]:
        """获取Halo博客配置"""
        return self._config_data.get("halo", {})

    @property
    def questionnaire(self) -> Dict[str, Any]:
        """获取问卷星配置"""
        return self._config_data.get("questionnaire", {})

    @property
    def review(self) -> Dict[str, Any]:
        """获取审核配置"""
        return self._config_data.get("review", {})

    @property
    def database(self) -> Dict[str, Any]:
        """获取数据库配置"""
        return self._config_data.get("database", {})

    @property
    def tduck(self) -> Dict[str, Any]:
        """获取 tduck 配置"""
        return self._config_data.get("tduck", {})

    @property
    def content_filter(self) -> Dict[str, Any]:
        """获取内容过滤配置"""
        return self._config_data.get("content_filter", {})

    @property
    def admin(self) -> Dict[str, Any]:
        """获取管理员配置"""
        return self._config_data.get("admin", {})



    @classmethod
    def reset(cls):
        """重置配置实例（用于测试）"""
        cls._instance = None


config = Config()
