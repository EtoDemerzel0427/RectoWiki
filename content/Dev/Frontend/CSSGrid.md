---
title: CSS Grid 备忘单
slug: css-grid
date: 2023-10-28
tags: [CSS, CheatSheet]
category: Dev
---
# CSS Grid 常用属性

这个页面用于测试布局宽度是否正常。

## 容器属性 (Container)

```css
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
```

## 项目属性 (Item)
- `grid-column: span 2`
- `justify-self: center`
- `align-self: end`

> Tip: 尽量使用 **fr** 单位而不是 **px**，这样更具响应性。
