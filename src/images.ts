// import { DirectClient } from "./index";
import express from "express";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { uploadFileAndGetUrl } from "./oss";


export class ImageEditer {
    constructor() {}

    /**
     * 扩展白边，使原图占新图的指定比例（保持原图比例不变）
     * @param imageUrl 图片URL
     * @param imageAreaRatio 原图占新图的面积比例，默认0.75（即75%）
     * @returns base64格式的处理后图片
     */
    async expandWhiteBorder(imageUrl: string, imageAreaRatio: number = 0.75): Promise<string> {
      console.log('🖼️  开始扩展白边，原图占比:', (imageAreaRatio * 100).toFixed(1) + '%');
      console.log('📥 原图URL:', imageUrl.substring(0, 100) + '...');
      
      try {
        // 1. 下载图片
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer'
        });
        const imageBuffer = Buffer.from(response.data);
        console.log('✅ 图片下载完成，大小:', imageBuffer.length, 'bytes');
        
        // 2. 获取原图元数据
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width || 1024;
        const originalHeight = metadata.height || 1024;
        console.log('📐 原图尺寸:', originalWidth, 'x', originalHeight);
        
        // 3. 计算新画布尺寸（保持原图比例，扩大画布）
        // 面积比 = imageAreaRatio，所以线性比 = sqrt(imageAreaRatio)
        const linearScale = Math.sqrt(imageAreaRatio);
        const canvasWidth = Math.round(originalWidth / linearScale);
        const canvasHeight = Math.round(originalHeight / linearScale);
        
        console.log('📐 新画布尺寸:', canvasWidth, 'x', canvasHeight);
        console.log('📏 线性缩放比例:', linearScale.toFixed(3));
        console.log('📊 实际面积占比:', ((originalWidth * originalHeight) / (canvasWidth * canvasHeight) * 100).toFixed(1) + '%');
        
        // 4. 计算原图在画布上的居中位置
        const x = Math.floor((canvasWidth - originalWidth) / 2);
        const y = Math.floor((canvasHeight - originalHeight) / 2);
        console.log('📍 原图居中位置:', `(${x}, ${y})`);
        
        // 5. 创建白色背景画布并将原图居中合成
        const processedBuffer = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 } // 白色背景
          }
        })
        .composite([{
          input: imageBuffer,
          top: y,
          left: x
        }])
        .png({ quality: 95 })
        .toBuffer();
        
        // 6. 验证最终输出
        const finalMeta = await sharp(processedBuffer).metadata();
        console.log('✅ 最终输出尺寸:', finalMeta.width, 'x', finalMeta.height);
        console.log('✅ 图片处理完成，输出大小:', processedBuffer.length, 'bytes');
        
        // 7. 转换为base64
        const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`;
        console.log('✅ 转换为base64完成，长度:', base64.length);
        
        return base64;
      } catch (error: any) {
        console.error('❌ 图片处理失败:', error.message);
        throw error;
      }
    }

    /**
     * 为生成的图片添加白色背景，缩小宠物并居中
     * @param imageUrl 图片URL（阿里云返回的URL）
     * @param petScale 宠物缩放比例，默认0.7（占画面70%）
     * @param targetRatio 目标长宽比，如 16/9 或 9/16，null表示保持原图比例
     * @returns base64格式的处理后图片
     */
    async addWhiteBackgroundToGenerated(imageUrl: string, petScale: number = 0.7, targetRatio: number | null = null): Promise<string> {
      console.log('🖼️  开始处理图片，添加白色背景...');
      console.log('📥 原图URL:', imageUrl.substring(0, 100) + '...');
      
      try {
        // 1. 下载图片
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer'
        });
        const imageBuffer = Buffer.from(response.data);
        console.log('✅ 图片下载完成，大小:', imageBuffer.length, 'bytes');
        
        // 2. 获取原图元数据
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width || 1024;
        const originalHeight = metadata.height || 1024;
        const originalRatio = originalWidth / originalHeight;
        console.log('📐 原图尺寸:', originalWidth, 'x', originalHeight);
        console.log('📐 原图长宽比:', originalRatio.toFixed(3));
        
        // 3. 确定最终输出尺寸（固定尺寸）
        let canvasWidth: number;
        let canvasHeight: number;
        
        if (targetRatio !== null) {
          console.log('🎯 目标长宽比:', targetRatio.toFixed(3), `(${targetRatio > 1 ? '横向' : '竖向'})`);
          
          // 根据目标比例设置固定的输出尺寸
          if (Math.abs(targetRatio - 16/9) < 0.01) {
            // 16:9 横向 - 像素风
            canvasWidth = 1920;
            canvasHeight = 1080;
            console.log('🎯 像素风固定尺寸: 1920 x 1080');
          } else if (Math.abs(targetRatio - 9/16) < 0.01) {
            // 9:16 竖向 - 迪士尼风
            canvasWidth = 1080;
            canvasHeight = 1920;
            console.log('🎯 迪士尼风固定尺寸: 1080 x 1920');
          } else {
            // 其他比例，基于原图调整
            if (targetRatio > 1) {
              canvasWidth = originalWidth;
              canvasHeight = Math.floor(originalWidth / targetRatio);
            } else {
              canvasHeight = originalHeight;
              canvasWidth = Math.floor(originalHeight * targetRatio);
            }
          }
          
          console.log('🖼️  最终画布尺寸:', canvasWidth, 'x', canvasHeight);
          console.log('🖼️  画布长宽比:', (canvasWidth / canvasHeight).toFixed(3));
        } else {
          // 保持原图尺寸
          canvasWidth = originalWidth;
          canvasHeight = originalHeight;
          console.log('📐 保持原图尺寸和比例');
        }
        
        // 4. 计算宠物在画布上的尺寸（让宠物占画面约50%）
        // 使用画布面积的50%作为宠物的目标面积
        const canvasArea = canvasWidth * canvasHeight;
        const targetPetArea = canvasArea * (petScale * petScale); // petScale的平方
        
        // 计算宠物应该的尺寸（保持原图长宽比）
        let newPetWidth: number;
        let newPetHeight: number;
        
        // 根据原图比例计算宠物尺寸
        if (originalRatio > canvasWidth / canvasHeight) {
          // 原图比画布更宽，以宽度为基准
          newPetWidth = Math.floor(canvasWidth * petScale);
          newPetHeight = Math.floor(newPetWidth / originalRatio);
        } else {
          // 原图比画布更窄或相同，以高度为基准
          newPetHeight = Math.floor(canvasHeight * petScale);
          newPetWidth = Math.floor(newPetHeight * originalRatio);
        }
        
        console.log('📏 目标宠物尺寸:', newPetWidth, 'x', newPetHeight);
        console.log('📊 宠物占画面比例:', ((newPetWidth * newPetHeight / canvasArea) * 100).toFixed(1) + '%');
        
        // 5. 缩放宠物图片（保持原图长宽比）
        const resizedPetBuffer = await sharp(imageBuffer)
          .resize(newPetWidth, newPetHeight, {
            fit: 'inside',  // 保持长宽比，缩放到指定尺寸内
            withoutEnlargement: true,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .toBuffer();
        
        // 验证缩放后的实际尺寸
        const resizedMeta = await sharp(resizedPetBuffer).metadata();
        console.log('✅ 实际宠物尺寸:', resizedMeta.width, 'x', resizedMeta.height);
        
        // 6. 创建白色背景画布并将宠物居中合成
        const x = Math.floor((canvasWidth - (resizedMeta.width || newPetWidth)) / 2);
        const y = Math.floor((canvasHeight - (resizedMeta.height || newPetHeight)) / 2);
        console.log('📍 宠物居中位置:', `(${x}, ${y})`);
        
        const processedBuffer = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 } // 白色背景
          }
        })
        .composite([{
          input: resizedPetBuffer,
          top: y,
          left: x
        }])
        .png({ quality: 95 })
        .toBuffer();
        
        // 验证最终输出尺寸
        const finalMeta = await sharp(processedBuffer).metadata();
        console.log('✅ 最终输出尺寸:', finalMeta.width, 'x', finalMeta.height);
        console.log('✅ 最终长宽比:', (finalMeta.width! / finalMeta.height!).toFixed(3));
        
        if (targetRatio !== null) {
          const finalRatio = finalMeta.width! / finalMeta.height!;
          const ratioDiff = Math.abs(finalRatio - targetRatio);
          if (ratioDiff < 0.01) {
            console.log('✅ 长宽比验证通过！');
          } else {
            console.warn('⚠️  长宽比偏差:', ratioDiff.toFixed(3));
          }
        }
        
        console.log('✅ 图片处理完成，输出大小:', processedBuffer.length, 'bytes');
        
        // 6. 转换为base64
        const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`;
        console.log('✅ 转换为base64完成，长度:', base64.length);
        
        return base64;
      } catch (error: any) {
        console.error('❌ 图片处理失败:', error.message);
        throw error;
      }
    }

    async getFileData(file: Express.Multer.File): Promise<string> {
      console.log('📁 getFileData called with file:', file ? {
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      } : 'null');

      if (!file || !file.path) {
        console.error('❌ file not found or no path');
        return "file empty";
      }

      try {
        // multer 已经提供了完整的绝对路径，直接使用
        const fileInputPath = file.path;
        console.log('📂 Reading file from path:', fileInputPath);
        
        // 检查文件是否存在
        const fileExists = await fs.promises.access(fileInputPath, fs.constants.F_OK)
          .then(() => true)
          .catch(() => false);
        
        if (!fileExists) {
          console.error('❌ File does not exist at path:', fileInputPath);
          return "file not found";
        }

        const imageBase64 = await fs.promises.readFile(fileInputPath, 'base64');
        console.log('✅ File read successfully, base64 length:', imageBase64.length);
    
        const ext = path.extname(fileInputPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        };

        const mimeType = mimeTypes[ext] || 'image/png';
        console.log('🎨 Detected mime type:', mimeType);
    
        const base64WithPrefix = `data:${mimeType};base64,${imageBase64}`;
        return base64WithPrefix;
      } catch (err) {
        console.error('❌ getFileData fail', err);
        return "getFileData error";
      }
    }

    async getFileUrl(file: Express.Multer.File): Promise<string> {
      console.log('📁 getFileUrl called with file:', file ? {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      } : 'null');

      if (!file || !file.path) {
        console.error('❌ file not found or no path');
        return "file empty";
      }

      try {
        const filename = file.originalname;
        // multer 已经提供了完整路径，直接使用
        const fileInputPath = file.path;
        console.log('📂 Source file path:', fileInputPath);

        // 复制到公开目录（用于静态服务或外部Nginx访问）
        // 优先使用环境变量 PUBLIC_FILES_DIR（建议指向 Nginx 映射目录），否则回退到本地项目 files 目录
        const dataDir = (process.env.PUBLIC_FILES_DIR && process.env.PUBLIC_FILES_DIR.trim().length > 0)
          ? process.env.PUBLIC_FILES_DIR
          : path.join(process.cwd(), "files");
        console.log('📁 Public files dir:', dataDir);
        
        // 确保 data 目录存在
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
          console.log('📁 Created data directory:', dataDir);
        }

        // 统一扩展名：将 .jpg 规范为 .jpeg（与 Volce 支持一致）
        const normalizedName = filename.toLowerCase().endsWith('.jpg') ? filename.replace(/\.jpg$/i, '.jpeg') : filename;
        const targetFilePath = path.join(dataDir, normalizedName);
        await fs.promises.copyFile(fileInputPath, targetFilePath);
        console.log('✅ File copied to:', targetFilePath);
        
        // 返回公网可访问的 URL（使用环境变量或回退到 localhost）
        let fileRootUrl = process.env.FILE_ROOT_URL || 'http://localhost:3000/files/';
        if (!fileRootUrl.endsWith('/')) fileRootUrl += '/';
        const localUrl = `${fileRootUrl}${normalizedName}`;
        console.log('🔗 File URL:', localUrl);
        
        return localUrl;
      } catch (err) {
        console.error('❌ getFileUrl fail:', err);
        return "getFileUrl error";
      }
    }
  
    async getFilePath(file: Express.Multer.File): Promise<string> {
      if (!file || !file.path) {
        console.error('❌ file not found or no path');
        return "file empty";
      }

      try {
        const filename = file.originalname;
        // multer 已经提供了完整路径，直接使用
        const fileInputPath = file.path;
        console.log('📂 Source file path:', fileInputPath);

        // 复制到公开目录（与 getFileUrl 一致）
        const dataDir = (process.env.PUBLIC_FILES_DIR && process.env.PUBLIC_FILES_DIR.trim().length > 0)
          ? process.env.PUBLIC_FILES_DIR
          : path.join(process.cwd(), "files");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // 统一扩展名：将 .jpg 规范为 .jpeg（与 Volce 支持一致）
        const normalizedName = filename.toLowerCase().endsWith('.jpg') ? filename.replace(/\.jpg$/i, '.jpeg') : filename;
        const targetFilePath = path.join(dataDir, normalizedName);
        await fs.promises.copyFile(fileInputPath, targetFilePath);
        console.log('✅ File copied to:', targetFilePath);
        
        return targetFilePath;
      } catch (err) {
        console.error('❌ getFilePath fail:', err);
        return "getFilePath error";
      }
    }

    async bailianQwenGenImage(
      prompt: string, 
      file: string, 
      processImage: boolean = true, 
      petScale: number = 0.7,
      targetRatio: number | null = null
    ): Promise<string> {
      console.log(`🎨 bailianQwenGenImage called`);
      console.log('📝 Prompt length:', prompt?.length || 0);
      console.log('🖼️  Image data prefix:', file?.substring(0, 50) || 'null');
      console.log('⚙️  Process image:', processImage, ', Pet scale:', petScale);
      console.log('⚙️  Target ratio:', targetRatio || 'null (保持原图比例)');
      
      // 检查输入参数
      if (!file || file.includes('error')) {
        console.error('❌ Invalid file data:', file);
        return JSON.stringify({ error: 'Invalid file data', details: file });
      }
      
      try {
        const requestBody = {
          model: "qwen-image-edit",
          input: {
            "messages": [
              {
                "role": "user",
                "content": [
                  {
                      "image": file
                  },
                  {
                      "text": prompt
                  }
                ]
              }
            ]
          },
          parameters: {
            "negative_prompt": "",
            "watermark": false
            // 注意：qwen-image-edit 模型不支持 size 参数
            // 只能通过提示词来引导生成特定比例
          }
        };
        
        console.log('🚀 Sending request to Qwen API...');
        const response = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
          requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
            }
        });
        console.log('✅ bailianQwenGenImage response:', response.data.output);

        // 获取生成的图片URL
        const generatedImageUrl = response.data.output.choices[0].message.content[0].image;
        console.log('📸 获取到生成图片URL:', generatedImageUrl.substring(0, 100) + '...');
        
        // 根据参数决定是否处理图片
        if (processImage) {
          console.log('🎨 开始后端图片处理（添加白色背景、缩放至', petScale, ', 目标比例:', targetRatio || '保持原图', '）...');
          const processedImageBase64 = await this.addWhiteBackgroundToGenerated(generatedImageUrl, petScale, targetRatio);
          console.log('✅ 后端图片处理完成');
          return processedImageBase64;
        } else {
          console.log('⏭️  跳过后端图片处理，直接返回原图URL');
          return generatedImageUrl;
        }
      } catch (error: any) {
        const errorData = error.response?.data;
        console.error('❌ Error calling Qwen API:', errorData || error.message);
        
        if (errorData) {
          // 特殊处理欠费错误
          if (errorData.code === 'Arrearage') {
            console.error('🚫 账户欠费！请充值后重试。');
            return JSON.stringify({ 
              error: '账户欠费', 
              message: '阿里百炼账户余额不足，请充值后重试',
              code: 'Arrearage',
              details: errorData 
            });
          }
          
          return JSON.stringify({ 
            error: 'API调用失败', 
            message: errorData.message || '未知错误',
            code: errorData.code,
            details: errorData 
          });
        }
        
        return JSON.stringify({ 
          error: '请求失败', 
          message: error.message 
        });
      }
    }

    async bailianQwenGenVideo(prompt: string, files: string[]): Promise<string> {
      console.log(`bailianQwenGenVideo ${prompt}`);
      try {
        let input = {};
        let model = "wan2.2-kf2v-flash";
        let url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis";
        if (files.length >= 2) {
          input = {
            "first_frame_url": files[0],
            "last_frame_url": files[1],
            "prompt": prompt
          };
        } else if (files.length === 1) {
          model = "wan2.5-i2v-preview";
          url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";
          input = {
            "img_url": files[0],
            "prompt": prompt
          };
        }
        const response = await axios.post(url, {
            model: model,
            input: input,
            parameters: {
              "audio": false,
              "resolution": "480P",
              "prompt_extend": false
            }
        }, {
            headers: {
                'X-DashScope-Async': 'enable',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
            }
        });
        console.log('bailianQwenAPI response', response.data.output);

        return response.data.output.task_id;
      } catch (error) {
        console.error('Error calling Qwen API:', error);
        // throw error;
        return `[]`;
      }
    }

    async bailianQwenGenImitate(file: string, file2: string): Promise<string> {
      console.log(`bailianQwenGenImitate ${file}  ${file2}`);
      try {
        const response = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/',
          {
            model: "wan2.2-animate-move",
            input: {
              "image_url": file,
              "video_url": file2
            },
            parameters: {
              "check_image": false,
              "mode": 'wan-std'
            }
          }, {
            headers: {
                'X-DashScope-Async': 'enable',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
            }
        });
        console.log('bailianQwenGenImitate response', response.data.output);

        return response.data.output.task_id;
      } catch (error) {
        console.error('Error calling bailianQwenGenImitate API:', error);
        // throw error;
        return `[]`;
      }
    }

    async handleImageGenerate(req: express.Request, res: express.Response): Promise<void> {
        console.log("🎨 ===== handleImageGenerate START =====");
        console.log('📝 Request body:', req.body);

        const files = req.files as Express.Multer.File[];
        console.log('📂 Files received:', files ? files.length : 0);
        
        if (files && files.length > 0) {
          this.fileLog(files);
        }

        if (!files || files.length === 0) {
          console.error('❌ No files received');
          res.status(400).send('No image file received');
          return;
        }

        try {
          let urls: string[] = [];
          for (const file of files) {
            const url = await this.getFileData(file);
            console.log('🔗 Processed file URL prefix:', url.substring(0, 50) + '...');
            urls.push(url);
          }
          
          // 获取图片处理参数（可选）
          const processImage = req.body.processImage !== 'false' && req.body.processImage !== false; // 默认true
          const petScale = parseFloat(req.body.petScale) || 0.7; // 默认0.7 (占画面70%)
          const targetRatio = req.body.targetRatio ? parseFloat(req.body.targetRatio) : null; // 目标比例
          console.log('⚙️  Image processing params: processImage =', processImage, ', petScale =', petScale, ', targetRatio =', targetRatio);
          
          console.log('🚀 Calling bailianQwenGenImage with prompt:', req.body.text);
          const result = await this.bailianQwenGenImage(req.body.text, urls[0], processImage, petScale, targetRatio);
          console.log('✅ Result received, sending response');
          res.status(200).send(result);
        } catch (err) {
          console.error('❌ [ImageEditer] Error handling genImage:', err);
          res.status(500).send('fail');
        }
        console.log("🎨 ===== handleImageGenerate END =====");
    }

    async handleVideoGenerate(req: express.Request, res: express.Response): Promise<void> {
        console.log("handleVideoGenerate");

        const files = req.files as Express.Multer.File[];
        //this.fileLog(files);
        //console.log('file req', req.body);

        if (!files || files.length === 0) {
          console.log('No files received');
          res.status(400).send('No image file received');
          return;
        }

        try {
          let urls: string[] = [];
          for (const file of files) {
            const url = await this.getFileData(file);
            urls.push(url);
          }
          // res.status(200).send('All files processed successfully');
          const taskId = await this.bailianQwenGenVideo(req.body.text, urls);
          console.log('Video taskId', taskId);
          await new Promise(resolve => setTimeout(resolve, 2000));
          const result = await this.handleReadImageFile(taskId);
          res.status(200).send(result);
        } catch (err) {
          console.error('[ImageEditer] Error handling genVideo:', err);
          res.status(500).send('fail');
        }
    }

    async handleAnimateGenerate(req: express.Request, res: express.Response): Promise<void> {
        console.log("handleAnimateGenerate");

        const files = req.files as Express.Multer.File[];
        this.fileLog(files);
        //console.log('Image file req', req.body);
        if (!files || files.length < 2) {
          console.log('No enough files received');
          res.status(400).send('No enough file received');
          return;
        }

        try {
          let urls: string[] = [];
          const model = "wan2.2-animate-move";
          for (const file of files) {
            //const url = await this.getFileUrl(file);
            const localUrl = await this.getFilePath(file);
            const url = await uploadFileAndGetUrl(process.env.ALI_BAILIAN_API_KEY || '', model, localUrl);
            urls.push(url);
          }
          const taskId = await this.bailianQwenGenImitate(urls[0], urls[1]);
          console.log('Video taskId', taskId);
          await new Promise(resolve => setTimeout(resolve, 2000));
          const result = await this.handleReadImageFile(taskId);
          res.status(200).send(result);
        } catch (err) {
          console.error('[ImageEditer] Error handleAnimateGenerate:', err);
          res.status(500).send('fail');
        }
    }

    async handleVideoRead(req: express.Request, res: express.Response): Promise<void> {
        //console.log("handleVideoRead");
        const taskId = req.query.task_id as string;
        //console.log('taskId', taskId);
        if (!taskId) {
          res.status(400).send('No task_id received');
          return;
        }

        try {
          const result = await this.handleReadImageFile(taskId);
          res.status(200).send(result);
        } catch (err) {
          console.error('[ImageEditer] Error handleVideoRead:', err);
          res.status(500).send('fail');
        }
    }

    async handleReadImageFile(taskId: string) {
      //console.log("handleReadImageFile");
      if (!taskId) {
        return "";
      }
      try {
        const response = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
          {
            headers: {
                'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
            }
        });
        //console.log('handleReadImageFile response', response.data.output);

        //const result = response.data.output.video_url || response.data.output.task_status || response.data.output;
        //return response.data.output.task_id + '  ' + result;
        if (response.data.output.task_status === 'SUCCEEDED') {
          console.log('handleReadImageFile response', response.data.output);
          const url = response.data.output.video_url || response.data.output.results.video_url;
          return url;
        }
        else if (response.data.output.task_status === 'PENDING' || response.data.output.task_status === 'RUNNING') {
          return response.data.output.task_id;
        }
        else {
          console.log('handleReadImageFile response', response.data.output);
          return response.data.output;
        }
      } catch (error) {
        console.error('Error calling Qwen API:', error);
        // throw error;
        return `[]`;
      }
    }

    async handleVideoBgRemove(req: express.Request, res: express.Response) {
      const videoUrl = req.body.video_url;
      if (!videoUrl) {
        res.status(400).send('No video_url received');
        return;
      }

      try {
        const jobId = await this.uploadVideoToVBR(videoUrl as string);
        const format = 'webm_vp9';//'png_sequence';
        await this.removeVideoBg(jobId, format);
        const result = await this.readVideoJobStatus(jobId);
        res.status(200).send(result);
      } catch (err) {
        console.error('[ImageEditer] Error handleVideoBgRemove:', err);
        res.status(500).send('fail');
      }
    }

    async handleVideoBgJobStatus(req: express.Request, res: express.Response) {
      //console.log("handleVideoBgJobStatus");
      const jobId = req.query.job_id as string;
      //console.log('jobId', jobId);
      if (!jobId) {
        res.status(400).send('No job_id received');
        return;
      }

      try {
        const result = await this.readVideoJobStatus(jobId);
        res.status(200).send(result);
      } catch (err) {
        console.error('[ImageEditer] Error handleVideoBgJobStatus:', err);
        res.status(500).send('fail');
      }
    }

    async uploadVideoToVBR(url: string): Promise<string> {
      console.log(`uploadVideoToVBR ${url}`);
      try {
        const response = await axios.post('https://api.videobgremover.com/v1/jobs',
          {
            "video_url": url
          }, {
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': `${process.env.VIDEOBGREMOVER_API_KEY}`
            }
        });
        console.log('uploadVideoToVBR response', response.data);

        return response.data.id;
      } catch (error) {
        console.error('Error calling uploadVideoToVBR API:', error);
        // throw error;
        return `[]`;
      }
    }

    async removeVideoBg(jobId: string, format: string): Promise<string> {
      console.log(`removeVideoBg ${jobId}`);
      try {
        const response = await axios.post(`https://api.videobgremover.com/v1/jobs/${jobId}/start`,
          {
            "background": {
              "type": "transparent",
              "transparent_format": format //"mov_prores"/png_sequence/webm_vp9
            }
          }, {
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': `${process.env.VIDEOBGREMOVER_API_KEY}`
            }
        });
        console.log('removeVideoBg response', response.data);

        return response.data.id;
      } catch (error) {
        console.error('Error calling removeVideoBg API:', error);
        // throw error;
        return `[]`;
      }
    }

    async readVideoJobStatus(jobId: string) {
      if (!jobId) {
        return "";
      }
      try {
        const response = await axios.get(`https://api.videobgremover.com/v1/jobs/${jobId}/status`,
          {
            headers: {
              'X-Api-Key': `${process.env.VIDEOBGREMOVER_API_KEY}`
            }
        });
        console.log('readVideoJobStatus response', response.data);
        if (response.data.status === 'completed') {
          console.log('readVideoJobStatus response', response.data);
          return response.data.processed_video_url;
        }
        else if (response.data.status === 'failed') {
          return response.data;
        }
        else {
          return response.data.id;
        }
      } catch (error) {
        console.error('Error calling readVideoJobStatus API:', error);
        // throw error;
        return `[]`;
      }
    }

    private fileLog(files: Express.Multer.File[]) {
        console.log('✅ Files:', files.length);

        files.forEach((file, index) => {
          console.log(`📄 Index ${index + 1}:`);
          console.log(`- Fieldname: ${file.fieldname}`);
          console.log(`- originalname: ${file.originalname}`);
          console.log(`- MIME: ${file.mimetype}`);
          console.log(`- path: ${file.path}`);
          console.log(`- size: ${file.size} `);
        });
        console.log('fieldname:', files.map(f => f.fieldname));
    }

}