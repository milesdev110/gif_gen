# GIF生成器 - TypeScript版本

这是一个使用TypeScript重构的GIF生成器项目。

## 项目结构
    src/
     ├── app.ts # 主应用文件
     ├── images2video.ts # 图像和视频处理类
     ├── video_reverse.ts # 视频翻转和分割功能
     ├── video2gif.ts # 视频转GIF功能
     └── types/
          └── env.d.ts # 环境变量类型定义

## 安装依赖

```bash
npm install
```

## 开发模式运行

```bash
npm run dev
```

## 构建项目

```bash
npm run build
```

## 生产环境运行

```bash
npm start
```

## 环境变量配置

创建 `.env` 文件并设置以下环境变量：

```env
ALI_BAILIAN_API_KEY=your_ali_bailian_api_key
NODE_ENV=development
```

## 主要改进

1. **类型安全**: 所有文件都添加了TypeScript类型定义
2. **模块化**: 使用ES6模块导入导出
3. **错误处理**: 更好的类型检查和错误处理
4. **开发体验**: 支持热重载和TypeScript编译