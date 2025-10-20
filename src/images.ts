// import { DirectClient } from "./index";
import express from "express";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { uploadFileAndGetUrl } from "./oss";


export class ImageEditer {
    constructor() {}

    async getFileData(file: Express.Multer.File): Promise<string> {
      if (!file || !file.path) {
        console.error(`file not found`);
        return "file empty";
      }

      try {
        const fileInputPath = path.join(
          process.cwd(), // /root/xdata3/data3-agent/
          file.path
        );
        //console.log('fileInputPath:', fileInputPath);
        const imageBase64 = await fs.promises.readFile(fileInputPath, 'base64');
    
        const ext = path.extname(fileInputPath).toLowerCase();
        const mimeTypes = {
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
      } catch (err) {
        console.error('getFileData fail', err);
        return "getFileData error";
      }
    }

    async getFileUrl(file: Express.Multer.File): Promise<string> {
      if (!file || !file.path) {
        console.error(`file not found`);
        return "file empty";
      }

      try {
        //console.log('File path:', file.path);
        const filename = file.originalname;
        //console.log('File name:', filename);
        const fileInputPath = path.join(
          process.cwd(), // /root/xdata3/data3-agent/
          file.path
        );
        //console.log('fileInputPath:', fileInputPath);

        const filePath = path.join(
          process.cwd(), // /root/xdata3/data3-agent/
          "files",
          filename
        );
        await fs.promises.copyFile(fileInputPath, filePath);
        const localUrl = `${process.env.FILE_ROOT_URL}${filename}`;
        return localUrl;
      } catch (err) {
        console.error('getFileUrl fail', err);
        return "getFileUrl error";
      }
    }
  
    async getFilePath(file: Express.Multer.File): Promise<string> {
      if (!file || !file.path) {
        console.error(`file not found`);
        return "file empty";
      }

      try {
        //console.log('File path:', file.path);
        const filename = file.originalname;
        const fileInputPath = path.join(
          process.cwd(), // /root/xdata3/data3-agent/
          file.path
        );
        //console.log('fileInputPath:', fileInputPath);

        const filePath = path.join(
          process.cwd(), // /root/xdata3/data3-agent/
          "files",
          filename
        );
        await fs.promises.copyFile(fileInputPath, filePath);
        return filePath;
      } catch (err) {
        console.error('getFilePath', err);
        return "getFilePath error";
      }
    }

    async bailianQwenGenImage(prompt: string, file: string): Promise<string> {
      console.log(`bailianQwenGenImage ${prompt}`);
      try {
        const response = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
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
          }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ALI_BAILIAN_API_KEY}`
            }
        });
        console.log('bailianQwenGenImage response', response.data.output);

        return response.data.output.choices[0].message.content[0].image;
      } catch (error) {
        console.error('Error calling Qwen API:', error);
        // throw error;
        return `[]`;
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

    async handleImageGenerate(req: express.Request, res: express.Response) {
        console.log("handleImageGenerate");

        const files = req.files as Express.Multer.File[];
        //this.fileLog(files);
        //console.log('Image file req', req.body);

        if (!files || files.length === 0) {
          console.log('No files received');
          return res.status(400).send('No image file received');
        }

        try {
          let urls: string[] = [];
          for (const file of files) {
            const url = await this.getFileData(file);
            urls.push(url);
          }
          const result = await this.bailianQwenGenImage(req.body.text, urls[0]);
          //return result;
          res.status(200).send(result);
        } catch (err) {
          console.error('[ImageEditer] Error handling genImage:', err);
          res.status(500).send('fail');
        }
    }

    async handleVideoGenerate(req: express.Request, res: express.Response) {
        console.log("handleVideoGenerate");

        const files = req.files as Express.Multer.File[];
        //this.fileLog(files);
        //console.log('file req', req.body);

        if (!files || files.length === 0) {
          console.log('No files received');
          return res.status(400).send('No image file received');
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

    async handleAnimateGenerate(req: express.Request, res: express.Response) {
        console.log("handleAnimateGenerate");

        const files = req.files as Express.Multer.File[];
        this.fileLog(files);
        //console.log('Image file req', req.body);
        if (!files || files.length < 2) {
          console.log('No enough files received');
          return res.status(400).send('No enough file received');
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

    async handleVideoRead(req: express.Request, res: express.Response) {
        //console.log("handleVideoRead");
        const taskId = req.query.task_id;
        //console.log('taskId', taskId);
        if (!taskId) {
          return res.status(400).send('No task_id received');
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
        return res.status(400).send('No video_url received');
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
      const jobId = req.query.job_id;
      //console.log('jobId', jobId);
      if (!jobId) {
        return res.status(400).send('No job_id received');
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
