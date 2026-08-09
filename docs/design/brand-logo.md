# 品牌标识使用规范（硬性规定）

## 1. 唯一原则：LOGO 不得改色

**公司 LOGO 的颜色、比例与构成一律不得修改。** 系统内任何界面、任何导出件、任何截图都必须呈现万富鑫原始 VI 配色：
「W」与文字为品牌深蓝，中间弧形为品牌橙。禁止的做法包括但不限于：

- 施加 CSS 滤镜（`filter: grayscale / brightness / invert / hue-rotate`）、`mix-blend-mode`、透明度压暗；
- 用单色版替代彩色版（深色背景请用官方提供的白色版资产，而不是把彩色版调白）；
- 在导出、压缩、截图环节做**有损调色板量化**（如 PNG 转 256 色索引图），这会把品牌橙压成米色/灰褐色；
- 自行重绘、拉伸、加描边、加阴影、改圆角。

## 2. 资产清单

| 文件 | 用途 |
| --- | --- |
| `apps/web/src/assets/brand/wanfuxin-logo-full.png` | 横版全彩（浅色背景）——登录页页头 |
| `apps/web/src/assets/brand/wanfuxin-logo-full-white.png` | 横版白色（深色背景） |
| `apps/web/src/assets/brand/wanfuxin-logo-stacked.png` | 竖版全彩 |
| `apps/web/src/assets/brand/wanfuxin-logo-stacked-white.png` | 竖版白色——深色侧边栏 |
| `apps/web/src/assets/brand/wanfuxin-mark.png` / `-white.png` | 仅图形标记，用于折叠态侧边栏与图标 |

深色底用白色版资产，浅色底用全彩版资产；**不允许**用 CSS 把全彩版变白，也不允许把白色版染色。

## 3. 代码约束

1. 引用 LOGO 的元素禁止出现 `filter`、`mix-blend-mode`、`opacity` 小于 1 的样式。
2. 只允许设置 `width` / `max-width` / `height: auto` 做等比缩放，不得单独改宽或改高造成变形。
3. 新增使用点必须从上表的资产引入，不得复制粘贴新的图片副本。

## 4. 交付物约束

- 截图、演示文稿、PDF 导出中的 LOGO 必须保持原色。
- 截图打包压缩时只允许**等比缩放**与无损压缩；**禁止**调色板量化（`convert -colors N`、`PIL.Image.convert('P', ...)`、pngquant 等有损方案），否则品牌橙会失真。
- 如需减小体积，优先降低分辨率或改用 JPEG 高质量（q≥90），并在交付前肉眼核对 LOGO 配色。
