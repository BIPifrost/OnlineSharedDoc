# Markdown 语法测试文档

这是一个全面的 Markdown 语法测试文件，用于验证预览功能的所有元素。

## 1. 标题测试

# 一级标题 (H1)
## 二级标题 (H2)
### 三级标题 (H3)
#### 四级标题 (H4)
##### 五级标题 (H5)
###### 六级标题 (H6)

---

## 2. 文本样式测试

这是**粗体文本**，这是*斜体文本*，这是***粗斜体文本***，这是~~删除线文本~~。

混合样式：**粗体中包含*斜体*内容**，*斜体中包含**粗体**内容*。

---

## 3. 列表测试

### 无序列表

- 第一项
- 第二项
  - 嵌套项 2.1
  - 嵌套项 2.2
    - 深层嵌套 2.2.1
- 第三项

### 有序列表

1. 第一项
2. 第二项
   1. 嵌套项 2.1
   2. 嵌套项 2.2
3. 第三项

### 任务列表

- [ ] 未完成的任务一
- [ ] 未完成的任务二
- [x] 已完成的任务一
- [x] 已完成的任务二
- [ ] 带有 `行内代码` 的任务

---

## 4. 引用块测试

> 这是一个普通的引用块。
> 
> 引用可以包含多段文字。

> **嵌套引用示例**
> 
> > 这是第一层嵌套引用
> >
> > > 这是第二层嵌套引用
> > >
> > > > 这是第三层嵌套引用

> ### 引用中的标题
> 
> 引用中可以包含**粗体**、*斜体*和`行内代码`。
> 
> ```javascript
> // 引用中的代码块
> console.log("Hello, World!");
> ```

---

## 5. 代码测试

### 行内代码

这是行内代码示例：`const x = 42;`，还有 `npm install` 和 `<div>` 标签。

特殊字符测试：`x < y && y > z`，`array[i++]`。

### 多行代码块 - JavaScript

```javascript
// JavaScript 示例
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(`Fibonacci(10) = ${result}`);

// 箭头函数
const add = (a, b) => a + b;
```

### 多行代码块 - TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }
}
```

### 多行代码块 - Python

```python
def quick_sort(arr):
    """快速排序算法"""
    if len(arr) <= 1:
        return arr
    
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    
    return quick_sort(left) + middle + quick_sort(right)

# 测试
numbers = [3, 6, 8, 10, 1, 2, 1]
print(quick_sort(numbers))
```

### 多行代码块 - HTML

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>测试页面</title>
</head>
<body>
    <div class="container">
        <h1>Hello, World!</h1>
        <p>这是一个测试页面。</p>
    </div>
</body>
</html>
```

### 多行代码块 - CSS

```css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.card {
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### 无语言指定代码块

```
这是一个没有指定语言的代码块
用于测试默认样式
  缩进测试
    更深缩进
```

---

## 6. 链接与图片测试

### 链接

- [Google](https://www.google.com)
- [GitHub](https://github.com)
- [相对链接](./README.md)

带标题的链接：[MDN Web Docs](https://developer.mozilla.org "Mozilla 开发者文档")

### 图片

![Markdown Logo](https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg)

---

## 7. 表格测试

### 基本表格

| 姓名 | 年龄 | 城市 |
| --- | --- | --- |
| 张三 | 25 | 北京 |
| 李四 | 30 | 上海 |
| 王五 | 28 | 广州 |

### 对齐测试

| 左对齐 | 居中对齐 | 右对齐 |
| :--- | :---: | ---: |
| A | B | C |
| AAA | BBB | CCC |
| 123 | 456 | 789 |

### 复杂表格

| 功能 | 支持状态 | 备注 |
| --- | --- | --- |
| 标题 | ✅ | H1-H6 |
| 列表 | ✅ | 有序/无序/任务 |
| 代码 | ✅ | 行内/多行 |
| 表格 | ✅ | GFM 扩展 |
| 图片 | ⚠️ | 需要有效 URL |

---

## 8. 水平分割线测试

上面是第一部分

---

中间部分

***

下面是第三部分

---

## 9. 特殊字符与转义测试

### HTML 实体

- 小于号：< 或 &lt;
- 大于号：> 或 &gt;
-  ampersand：& 或 &amp;
- 引号：" 或 &quot;
- 版权符号：© 或 &copy;
- 注册商标：® 或 &reg;

### Markdown 特殊字符转义

- 星号：\* 不是斜体 \*
- 下划线：\_ 不是斜体 \_
- 反引号：\` 不是代码 \`
- 井号：\# 不是标题 \#
- 方括号：\[ 不是链接 \]
- 圆括号：\( 不是链接 \)

### 数学符号

- 加减：± (&plusmn;)
- 乘号：× (&times;)
- 除号：÷ (&divide;)
- 不等于：≠
- 约等于：≈
- 无穷大：∞

### Emoji 测试（如果支持）

- 笑脸：😊
- 火箭：🚀
- 星星：⭐
- 对勾：✅
- 错误：❌

---

## 10. 组合测试

### 在列表中嵌入多种元素

1. **第一个项目**
   
   > 这是一个引用
   
   ```python
   print("嵌套代码")
   ```

2. *第二个项目*
   
   | 列A | 列B |
   | --- | --- |
   | 1 | 2 |

3. ***第三个项目***
   
   - 子项 1
   - 子项 2
     - [ ] 子任务

---

## 11. 长文本测试

这是一段很长的段落，用于测试文本换行和排版效果。Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

 Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

中文长文本测试：这是一个用于测试中文排版效果的长段落。在现代网页设计中，良好的排版对于提升用户体验至关重要。合理的行高、字间距和段落间距可以让阅读更加舒适。

---

## 12. 脚注测试（如果支持）

这是一个带有脚注的句子[^1]，这是另一个[^2]。

[^1]: 这是第一个脚注的内容。
[^2]: 这是第二个脚注的内容，可以包含**粗体**和`代码`。

---

*文档结束 - 此文件用于全面测试 Markdown 预览功能*
