import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

interface QwenImageResponse {
  output: {
    choices: Array<{
      message: {
        content: Array<{
          image: string;
        }>;
      };
    }>;
  };
}

interface QwenVideoResponse {
  output: {
    task_id: string;
  };
}

interface TaskStatusResponse {
  output: {
    task_status: string;
    video_url?: string;
    task_id?: string;
  };
}

export class ImageEditer {
  constructor() {}

  async getFileUrl(file: MulterFile): Promise<string> {
    if (!file || !file.path) {
      console.error('File not found');
      return "file empty";
    }

    try {
      const fileInputPath = path.join(process.cwd(), file.path);
      const imageBase64 = await fs.promises.readFile(fileInputPath, 'base64');
  
      const ext = path.extname(fileInputPath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };

      const mimeType = mimeTypes[ext] || 'image/png'; // 默认使用 png
  
      const base64WithPrefix = `data:${mimeType};base64,${imageBase64}`;
      return base64WithPrefix;
    } catch (err: any) {
      console.error('File read failed:', err.message);
      return "file read error: " + err.message;
    }
  }

  async bailianQwenGenImage(prompt: string, file: string): Promise<string> {
    try {
      const response = await axios.post<QwenImageResponse>(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        {
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
          }
        }, 
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
          }
        }
      );
      
      console.log('bailianQwenGenImage response', response.data.output);
      return response.data.output.choices[0].message.content[0].image;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message);
      return '[]';
    }
  }

  async bailianQwenGenVideo(prompt: string, files: string[]): Promise<string> {
    console.log(`bailianQwenGenVideo ${prompt}`);
    try {
      let input: any = {};
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
      
      const response = await axios.post<QwenVideoResponse>(
        url,
        {
          model: model,
          input: input,
          parameters: {
            "resolution": "480P",
            "prompt_extend": true
          }
        },
        {
          headers: {
            'X-DashScope-Async': 'enable',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
          }
        }
      );
      
      console.log('bailianQwenAPI response', response.data.output);
      return response.data.output.task_id;
    } catch (error: any) {
      console.error('Error calling Qwen API:', error);
      return `[]`;
    }
  }

  async handleImageGenerate(req: express.Request, res: express.Response): Promise<void> {
    console.log("handleImageGenerate");

    const files = req.files as MulterFile[];
    
    if (!files || files.length === 0) {
      console.log('No files received');
      res.status(400).send('No image file received');
      return;
    }

    try {
      const urls: string[] = [];
      for (const file of files) {
        const url = await this.getFileUrl(file);
        urls.push(url);
      }
      const result = await this.bailianQwenGenImage(req.body.text, urls[0]);
      res.status(200).send(result);
    } catch (err: any) {
      console.error('[ImageEditer] Error handling genImage:', err);
      res.status(500).send('fail');
    }
  }

  async handleVideoGenerate(req: express.Request, res: express.Response): Promise<void> {
    console.log("handleVideoGenerate");

    const files = req.files as MulterFile[];
    
    if (!files || files.length === 0) {
      console.log('No files received');
      res.status(400).send('No image file received');
      return;
    }

    try {
      const urls: string[] = [];
      for (const file of files) {
        const url = await this.getFileUrl(file);
        urls.push(url);
      }
      
      const taskId = await this.bailianQwenGenVideo(req.body.text, urls);
      console.log('Video taskId', taskId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await this.handleReadImageFile(taskId);
      res.status(200).send(result);
    } catch (err: any) {
      console.error('[ImageEditer] Error handling genVideo:', err);
      res.status(500).send('fail');
    }
  }

  async handleVideoRead(req: express.Request, res: express.Response): Promise<void> {
    const taskId = req.query.task_id as string;
    
    if (!taskId) {
      res.status(400).send('No task_id received');
      return;
    }

    try {
      const result = await this.handleReadImageFile(taskId);
      res.status(200).send(result);
    } catch (err: any) {
      console.error('[ImageEditer] Error handleVideoRead:', err);
      res.status(500).send('fail');
    }
  }

  async handleReadImageFile(taskId: string): Promise<string> {
    if (!taskId) {
      return "";
    }
    
    try {
      const response = await axios.get<TaskStatusResponse>(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
          }
        }
      );

      if (response.data.output.task_status === 'SUCCEEDED') {
        console.log('handleReadImageFile response', response.data.output);
        return response.data.output.video_url || "";
      } else {
        return response.data.output.task_id || "";
      }
    } catch (error: any) {
      console.error('Error calling Qwen API:', error);
      return `[]`;
    }
  }

  fileLog(files: MulterFile[]): void {
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