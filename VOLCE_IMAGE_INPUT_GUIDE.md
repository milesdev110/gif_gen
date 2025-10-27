# Volce 模型图片输入配置指南

## ⚠️ 核心问题

volce API（火山引擎）**只支持公网可访问的 HTTP/HTTPS URL**，不支持：
- ❌ `data:image/...;base64,xxx` (base64格式)
- ❌ `oss://...` (阿里云OSS协议)
- ❌ `http://localhost:3000/files/...` (本地URL)
- ❌ 私有/需要认证的URL

## ✅ 解决方案

### 与 xdata3 一致的实现方式

gif_gen现在使用与xdata3相同的方法：
```typescript
// 通过 FILE_ROOT_URL 生成公网可访问的URL
const url = await this.getFileUrl(file);
// 返回：https://your-domain.com/media/files/filename.jpg
```

### 必需的环境变量

```bash
# .env 文件
VOLCE_API_KEY=your_volce_api_key
VOLCE_ACCESS_TOKEN=your_volce_access_token

# 公网文件服务URL（必需！）
FILE_ROOT_URL=https://trendmuse.site/media/files/
```

## 🔧 配置FILE_ROOT_URL

### 方案1：Nginx文件服务器（推荐）

**Nginx配置示例**：
```nginx
server {
    listen 80;
    server_name trendmuse.site;

    location /media/files/ {
        alias /home/wanger/projects/IPBot/pet/gif_gen/data/;
        autoindex off;
        # 允许跨域访问
        add_header Access-Control-Allow-Origin *;
    }
}
```

**环境变量**：
```bash
FILE_ROOT_URL=https://trendmuse.site/media/files/
```

### 方案2：文件同步到远程服务器

使用rsync/scp定期同步文件：
```bash
# 同步到远程服务器
rsync -avz /home/wanger/projects/IPBot/pet/gif_gen/data/ \
  user@server:/var/www/files/
```

### 方案3：使用云存储CDN

上传文件到七牛云、又拍云等，确保文件公开可访问。

## 📋 工作流程

1. **用户上传图片** 
   - multer保存到 `gif_gen/data/uploads/`

2. **复制文件**
   - 调用 `getFileUrl()` → 复制到 `gif_gen/data/`

3. **生成公网URL**
   - 格式：`FILE_ROOT_URL + filename`
   - 例如：`https://trendmuse.site/media/files/d_o_g.jpeg`

4. **调用volce API**
   - 使用公网URL作为参数
   - volce API访问这个URL获取图片

## ✅ 验证配置

### 测试FILE_ROOT_URL是否正确

```bash
# 1. 上传一张测试图片后，查看生成的URL
# 日志中会显示：🔗 File URL: https://...

# 2. 用curl测试URL是否可访问
curl -I "https://trendmuse.site/media/files/your_test_file.jpeg"

# 3. 期望返回 200 OK
# HTTP/1.1 200 OK
# Content-Type: image/jpeg
```

### 常见问题排查

#### 问题1：404 Not Found
```
err=wrong status code: 404
```
**原因**：FILE_ROOT_URL配置的路径下没有文件  
**解决**：检查Nginx配置或文件同步脚本

#### 问题2：403 Forbidden
```
err=wrong status code: 403
```
**原因**：文件/目录权限问题，或Nginx未配置允许访问  
**解决**：
```bash
# 检查文件权限
chmod 644 /path/to/files/*
chmod 755 /path/to/files/

# 检查Nginx配置是否有IP限制
```

#### 问题3：CORS错误
**解决**：在Nginx中添加CORS头
```nginx
add_header Access-Control-Allow-Origin *;
```

## 📝 代码修改总结

### gif_gen/src/image-volce.ts

```typescript
// 修改前（使用OSS，会返回403）
const ossUrl = await uploadFileAndGetHttpUrl(...);

// 修改后（使用FILE_ROOT_URL，与xdata3一致）
const url = await this.getFileUrl(file);
// 返回：FILE_ROOT_URL + filename
```

### gif_gen/src/images.ts

```typescript
async getFileUrl(file: Express.Multer.File): Promise<string> {
  // ...复制文件到 data/ 目录...
  
  // 返回公网可访问的 URL（使用环境变量或回退到 localhost）
  const fileRootUrl = process.env.FILE_ROOT_URL || 'http://localhost:3000/files/';
  const localUrl = `${fileRootUrl}${filename}`;
  return localUrl;
}
```

## 🎯 与xdata3的对比

| 特性 | gif_gen (现在) | xdata3 |
|------|---------------|--------|
| 文件处理 | `getFileUrl()` ✅ | `getFileUrl()` ✅ |
| URL生成 | `FILE_ROOT_URL + filename` ✅ | `FILE_ROOT_URL + filename` ✅ |
| bailian模型 | 使用OSS (oss://) ✅ | 使用OSS (oss://) ✅ |
| volce模型 | 使用HTTP URL ✅ | 使用HTTP URL ✅ |

## 🚀 快速开始

1. **配置环境变量**：
   ```bash
   echo "FILE_ROOT_URL=https://trendmuse.site/media/files/" >> .env
   ```

2. **配置Nginx**（如果使用方案1）

3. **重启服务**：
   ```bash
   cd gif_gen
   npm run dev
   ```

4. **测试**：上传图片并检查日志中的URL是否可访问

---

修复日期：2025-10-23  
版本：v2.0 (简化版)



