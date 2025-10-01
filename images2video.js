// import { DirectClient } from "./index";
import express from "express";
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class ImageEditer {
    constructor() {}

    async getFileUrl(file) {
      if (!file || !file.path) {
        console.error('File not found');
        return "file empty";
      }

      try {
        const fileInputPath = path.join(
          process.cwd(),
          file.path
        );
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

        /*const filePath = path.join(
          process.cwd(), // /root/xdata3/data3-agent/
          "files",
          filename
        );
        await fs.promises.copyFile(fileInputPath, filePath);
        //await fs.promises.writeFile(filePath, data);
        return `${process.env.FILE_ROOT_URL}${filename}`;*/
      } catch (err) {
        console.error('File read failed:', err.message);
        return "file read error: " + err.message;
      }
    }

    async bailianQwenGenImage(prompt, file) {
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
        console.error('API Error:', error.response?.data || error.message);
        return '[]';
      }
    }

    async bailianQwenGenVideo(prompt, files) {
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
              "resolution": "480P",
              "prompt_extend": true
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

    async handleImageGenerate(req, res) {
        console.log("handleImageGenerate");

        const files = req.files;
        //this.fileLog(files);
        //console.log('Image file req', req.body);

        if (!files || files.length === 0) {
          console.log('No files received');
          return res.status(400).send('No image file received');
	    }

        try {
          let urls = [];
          for (const file of files) {
            const url = await this.getFileUrl(file);
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

    async handleVideoGenerate(req, res) {
        console.log("handleVideoGenerate");

        const files = req.files;
        //this.fileLog(files);
        //console.log('file req', req.body);

        if (!files || files.length === 0) {
          console.log('No files received');
          return res.status(400).send('No image file received');
	    }

        try {
          let urls = [];
          for (const file of files) {
            const url = await this.getFileUrl(file);
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

    async handleVideoRead(req, res) {
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

    async handleReadImageFile(taskId) {
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
          return response.data.output.video_url;
        }
        else {
          return response.data.output.task_id;
        }
      } catch (error) {
        console.error('Error calling Qwen API:', error);
        // throw error;
        return `[]`;
      }
    }

    fileLog(files) {
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