---
sidebar_position: 8
title: "扩展 CLI"
description: "构建包装 CLI，用自定义小部件、快捷键和布局更改扩展 Hermes TUI"
---

# 扩展 CLI

Hermes 在 `HermesCLI` 上暴露受保护的扩展钩子，使包装 CLI 可以添加小部件、快捷键和布局自定义，而无需覆盖 1000 多行的 `run()` 方法。这使你的扩展与内部更改解耦。

## 扩展点

有五个可用的扩展接缝：

| 钩子 | 用途 | 何时覆盖 |
|------|------|----------|
| `_get_extra_tui_widgets()` | 向布局注入小部件 | 需要持久 UI 元素（面板、状态行、迷你播放器） |
| `_register_extra_tui_keybindings(kb, *, input_area)` | 添加键盘快捷键 | 需要热键（切换面板、传输控制、模态快捷键） |
| `_build_tui_layout_children(**widgets)` | 完全控制小部件排序 | 需要重新排序或包装现有小部件（罕见） |
| `process_command()` | 添加自定义斜杠命令 | 需要 `/mycommand` 处理（已存在的钩子） |
| `_build_tui_style_dict()` | 自定义 prompt_toolkit 样式 | 需要自定义颜色或样式（已存在的钩子） |

前三个是新的受保护钩子。后两个已经存在。

## 快速开始：包装 CLI

```python
#!/usr/bin/env python3
"""my_cli.py — Example wrapper CLI that extends Hermes."""

from cli import HermesCLI
from prompt_toolkit.layout import FormattedTextControl, Window
from prompt_toolkit.filters import Condition


class MyCLI(HermesCLI):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._panel_visible = False

    def _get_extra_tui_widgets(self):
        """Add a toggleable info panel above the status bar."""
        cli_ref = self
        return [
            Window(
                FormattedTextControl(lambda: "📊 My custom panel content"),
                height=1,
                filter=Condition(lambda: cli_ref._panel_visible),
            ),
        ]

    def _register_extra_tui_keybindings(self, kb, *, input_area):
        """F2 toggles the custom panel."""
        cli_ref = self

        @kb.add("f2")
        def _toggle_panel(event):
            cli_ref._panel_visible = not cli_ref._panel_visible

    def process_command(self, cmd: str) -> bool:
        """Add a /panel slash command."""
        if cmd.strip().lower() == "/panel":
            self._panel_visible = not self._panel_visible
            state = "visible" if self._panel_visible else "hidden"
            print(f"Panel is now {state}")
            return True
        return super().process_command(cmd)


if __name__ == "__main__":
    cli = MyCLI()
    cli.run()
```

运行它：

```bash
cd ~/.hermes/hermes-agent
source .venv/bin/activate
python my_cli.py
```

## 钩子参考

### `_get_extra_tui_widgets()`

返回要插入 TUI 布局的 prompt_toolkit 小部件列表。小部件出现在**间隔器和状态栏之间** — 在输入区域上方但在主输出下方。

```python
def _get_extra_tui_widgets(self) -> list:
    return []  # default: no extra widgets
```

每个小部件应该是 prompt_toolkit 容器（例如 `Window`、`ConditionalContainer`、`HSplit`）。使用 `ConditionalContainer` 或 `filter=Condition(...)` 使小部件可切换。

```python
from prompt_toolkit.layout import ConditionalContainer, Window, FormattedTextControl
from prompt_toolkit.filters import Condition

def _get_extra_tui_widgets(self):
    return [
        ConditionalContainer(
            Window(FormattedTextControl("Status: connected"), height=1),
            filter=Condition(lambda: self._show_status),
        ),
    ]
```

### `_register_extra_tui_keybindings(kb, *, input_area)`

在 Hermes 注册自己的快捷键之后、布局构建之前调用。将你的快捷键添加到 `kb`。

```python
def _register_extra_tui_keybindings(self, kb, *, input_area):
    pass  # default: no extra keybindings
```

参数：
- **`kb`** — prompt_toolkit 应用程序的 `KeyBindings` 实例
- **`input_area`** — 主 `TextArea` 小部件，如果你需要读取或操作用户输入

```python
def _register_extra_tui_keybindings(self, kb, *, input_area):
    cli_ref = self

    @kb.add("f3")
    def _clear_input(event):
        input_area.text = ""

    @kb.add("f4")
    def _insert_template(event):
        input_area.text = "/search "
```

**避免冲突**与内置快捷键：`Enter`（提交）、`Escape Enter`（换行）、`Ctrl-C`（中断）、`Ctrl-D`（退出）、`Tab`（自动建议接受）。功能键 F2+ 和 Ctrl 组合通常是安全的。

### `_build_tui_layout_children(**widgets)`

仅在需要完全控制小部件排序时覆盖此方法。大多数扩展应使用 `_get_extra_tui_widgets()` 代替。

```python
def _build_tui_layout_children(self, *, sudo_widget, secret_widget,
    approval_widget, clarify_widget, spinner_widget, spacer,
    status_bar, input_rule_top, image_bar, input_area,
    input_rule_bot, voice_status_bar, completions_menu) -> list:
```

默认实现返回：

```python
[
    Window(height=0),       # anchor
    sudo_widget,            # sudo password prompt (conditional)
    secret_widget,          # secret input prompt (conditional)
    approval_widget,        # dangerous command approval (conditional)
    clarify_widget,         # clarify question UI (conditional)
    spinner_widget,         # thinking spinner (conditional)
    spacer,                 # fills remaining vertical space
    *self._get_extra_tui_widgets(),  # YOUR WIDGETS GO HERE
    status_bar,             # model/token/context status line
    input_rule_top,         # ─── border above input
    image_bar,              # attached images indicator
    input_area,             # user text input
    input_rule_bot,         # ─── border below input
    voice_status_bar,       # voice mode status (conditional)
    completions_menu,       # autocomplete dropdown
]
```

## 布局图

默认布局从上到下：

1. **输出区域** — 滚动对话历史
2. **间隔器**
3. **额外小部件** — 来自 `_get_extra_tui_widgets()`
4. **状态栏** — 模型、上下文 %、已用时间
5. **图像栏** — 附加图像计数
6. **输入区域** — 用户提示词
7. **语音状态** — 录音指示器
8. **补全菜单** — 自动补全建议

## 提示

- **状态更改后使显示无效**：调用 `self._invalidate()` 触发 prompt_toolkit 重绘。
- **访问代理状态**：`self.agent`、`self.model`、`self.conversation_history` 都可用。
- **自定义样式**：覆盖 `_build_tui_style_dict()` 并为你的自定义样式类添加条目。
- **斜杠命令**：覆盖 `process_command()`，处理你的命令，对其余内容调用 `super().process_command(cmd)`。
- **除非绝对必要，否则不要覆盖 `run()`** — 扩展钩子专门存在以避免这种耦合。
