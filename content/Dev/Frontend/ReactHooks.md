---
title: React Hooks 闭包陷阱
slug: react-hooks
date: 2023-11-02
tags: [React, JavaScript, Bug]
category: Dev
---
# React Hooks 中的闭包陷阱

在使用 `useEffect` 或 `useCallback` 时，经常会遇到拿到的 state 是旧值的情况。

## 示例代码

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // ❌ 错误：这里的 count 永远是初始值 0
      console.log(count); 
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 依赖数组为空
}
```

## 解决方案

1. 使用函数式更新：`setCount(c => c + 1)`
2. 将依赖加入数组：`[count]`（但这会重置定时器）
3. 使用 `useRef` 保存最新值。
