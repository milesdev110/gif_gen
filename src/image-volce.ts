import express from "express";
import { ImageEditer } from "./images";
import { doRequest } from "./volce-sign";

const DEFAULT_SERVICE = 'cv';
const DEFAULT_REGION = 'cn-north-1';

export class ImageVolceEditer extends ImageEditer {

  async volceGenImageByImage(prompt: string, file: string, expandBorder: boolean = true, imageAreaRatio: number = 0.75): Promise<string> {
    console.log(`volceGenImageByImage ${prompt}`);
    console.log(`⚙️  扩展白边: ${expandBorder}, 原图占比: ${(imageAreaRatio * 100).toFixed(1)}%`);
    try {
      const query = {
        Action: 'CVSync2AsyncSubmitTask',
        Version: '2022-08-31'
      };
      const params = {
        req_key: "jimeng_t2i_v40",
        image_urls: [file],
        prompt: prompt,
        force_single: true
      };
      const response = await doRequest(DEFAULT_SERVICE, DEFAULT_REGION, 'POST', query, params);
      console.log('volceGenImageByImage response', response);
      const data = JSON.parse(response);
      if (data.code !== 0 && data.code !== 10000) {
        console.error('volceGenImageByImage error', data.message);
        return data.message;
      }
      const taskId = data.data.task_id;
      await new Promise(resolve => setTimeout(resolve, 40000));
      const imageUrl = await this.handleReadGenFile(taskId, 'jimeng_t2i_v40');
      
      // 如果需要扩展白边，则处理图片
      if (expandBorder && imageUrl && !imageUrl.startsWith('[') && !imageUrl.includes('error')) {
        console.log('🎨 开始扩展白边处理...');
        try {
          const processedImage = await this.expandWhiteBorder(imageUrl, imageAreaRatio);
          return processedImage;
        } catch (error) {
          console.error('⚠️  白边扩展失败，返回原图:', error);
          return imageUrl;
        }
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Error calling volceGenImageByImage API:', error);
      return `[]`;
    }
  }

  async volceGenVideoByFirst(prompt: string, file: string): Promise<string> {
    console.log(`volceGenVideoByFirst ${prompt}`);
    try {
      const query = {
        Action: 'CVSync2AsyncSubmitTask',
        Version: '2022-08-31'
      };
      const params = {
        req_key: "jimeng_i2v_first_v30_1080",
        image_urls: [file],
        prompt: prompt,
        seed: 100,
        frames: 121
      };
      const response = await doRequest(DEFAULT_SERVICE, DEFAULT_REGION, 'POST', query, params);
      console.log('volceGenVideoByFirst response', response);
      const data = JSON.parse(response);
      if (data.code !== 0 && data.code !== 10000) {
        console.error('volceGenVideoByFirst error', data.message);
        return data.message;
      }
      const taskId = data.data.task_id;
      await new Promise(resolve => setTimeout(resolve, 40000));
      const result = await this.handleReadGenFile(taskId, 'jimeng_i2v_first_v30_1080');
      return result;
    } catch (error) {
      console.error('Error calling volceGenVideoByFirst API:', error);
      return `[]`;
    }
  }

  async volceGenVideoBy2Image(prompt: string, file: string, file2: string): Promise<string> {
    console.log(`volceGenVideoBy2Image ${prompt}`);
    try {
      const query = {
        Action: 'CVSync2AsyncSubmitTask',
        Version: '2022-08-31'
      };
      const params = {
        req_key: "jimeng_i2v_first_tail_v30",
        image_urls: [
          file, file2
        ],
        prompt: prompt,
        seed: 100,
        frames: 121
      };
      const response = await doRequest(DEFAULT_SERVICE, DEFAULT_REGION, 'POST', query, params);
      console.log('volceGenVideoBy2Image response', response);
      const data = JSON.parse(response);
      if (data.code !== 0 && data.code !== 10000) {
        console.error('volceGenVideoByFirst error', data.message);
        return data.message;
      }
      const taskId = data.data.task_id;
      await new Promise(resolve => setTimeout(resolve, 40000));
      const result = await this.handleReadGenFile(taskId, 'jimeng_i2v_first_tail_v30');
      return result;
    } catch (error) {
      console.error('Error calling volceGenVideoBy2Image API:', error);
      return `[]`;
    }
  }

  async volceGenVideoByImitate(prompt: string, image: string, video: string): Promise<string> {
    console.log(`volceGenVideoByImitate ${prompt}`);
    try {
      const query = {
        Action: 'CVSync2AsyncSubmitTask',
        Version: '2022-08-31'
      };
      const params = {
        req_key: "jimeng_dream_actor_m1_gen_video_cv",
        image_url: image,
        video_url: video
      };
      const response = await doRequest(DEFAULT_SERVICE, DEFAULT_REGION, 'POST', query, params);
      console.log('volceGenVideoByImitate response', response);
      const data = JSON.parse(response);
      if (data.code !== 0 && data.code !== 10000) {
        console.error('volceGenVideoByFirst error', data.message);
        return data.message;
      }
      const taskId = data.data.task_id;
      await new Promise(resolve => setTimeout(resolve, 40000));
      const result = await this.handleReadGenFile(taskId, 'jimeng_dream_actor_m1_gen_video_cv');
      return result;
    } catch (error) {
      console.error('Error calling volceGenVideoByImitate API:', error);
      return `[]`;
    }
  }
  
  async handleImageGenerate(req: express.Request, res: express.Response): Promise<void> {
    console.log("handleImageGenerate");

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      console.log('No files received');
      res.status(400).send('No image file received');
      return;
    }

    try {
      let urls: string[] = [];
      for (const file of files) {
        const url = await this.getFileUrl(file);
        urls.push(url);
      }
      
      // 获取白边扩展参数（可选）
      const expandBorder = true; // 默认true
      const imageAreaRatio = 0.5; // 默认0.5 (50%)
      console.log('⚙️  图片处理参数: expandBorder =', expandBorder, ', imageAreaRatio =', imageAreaRatio);
      
      const result = await this.volceGenImageByImage(req.body.text, urls[0], expandBorder, imageAreaRatio);
      res.status(200).send(result);
    } catch (err) {
      console.error('[ImageEditerVolce] Error handling genImage:', err);
      res.status(500).send('fail');
    }
  }

  async handleVideoGenerate(req: express.Request, res: express.Response): Promise<void> {
    console.log("handleVideoGenerate");

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      console.log('No files received');
      res.status(400).send('No image file received');
      return;
    }

    try {
      let urls: string[] = [];
      for (const file of files) {
        const url = await this.getFileUrl(file);
        urls.push(url);
      }
      let taskId = "";
      if (urls.length >= 2) {
        taskId = await this.volceGenVideoBy2Image(req.body.text, urls[0], urls[1]);
      }
      else if (urls.length == 1) {
        taskId = await this.volceGenVideoByFirst(req.body.text, urls[0]);
      }
      console.log('Video taskId', taskId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      res.status(200).send(taskId);
    } catch (err) {
      console.error('[ImageEditerVolce] Error handling genVideo:', err);
      res.status(500).send('fail');
    }
  }

  async handleAnimateGenerate(req: express.Request, res: express.Response): Promise<void> {
    console.log("handleAnimateGenerate");

    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 2) {
      console.log('No files received');
      res.status(400).send('No image file received');
      return;
    }

    try {
      let urls: string[] = [];
      for (const file of files) {
        const url = await this.getFileUrl(file);
        urls.push(url);
      }
      const result = await this.volceGenVideoByImitate(req.body.text, urls[0], urls[1]);
      console.log('Video taskId', result);
      await new Promise(resolve => setTimeout(resolve, 2000));
      res.status(200).send(result);
    } catch (err) {
      console.error('[ImageEditerVolce] Error handleAnimateGenerate:', err);
      res.status(500).send('fail');
    }
  }

  async handleVideoRead(req: express.Request, res: express.Response): Promise<void> {
    const taskId = req.query.task_id as string;
    const reqKey = req.query.req_key as string;
    console.log('reqKey', reqKey);
    if (!taskId || !reqKey) {
      res.status(400).send('No task_id/req_key received');
      return;
    }

    try {
      const result = await this.handleReadGenFile(taskId, reqKey);
      res.status(200).send(result);
    } catch (err) {
      console.error('[ImageEditerVolce] Error handleVideoRead:', err);
      res.status(500).send('fail');
    }
  }

  async handleReadGenFile(taskId: string, reqKey: string): Promise<string> {
    if (!taskId) {
      return "";
    }
      
    try {
      const query = {
        Action: 'CVSync2AsyncGetResult',
        Version: '2022-08-31'
      };
      // 使用条件逻辑构建params对象，而不是先定义再删除
      const params: any = {
        req_key: reqKey,
        task_id: taskId
      };
      
      // 只有当reqKey不是特定值时，才添加req_json属性
      if (reqKey !== 'jimeng_dream_actor_m1_gen_video_cv') {
        params.req_json = "{\"return_url\":true}";
      }
      
      console.log('handleReadGenFile params', params);
      const response = await doRequest(DEFAULT_SERVICE, DEFAULT_REGION, 'POST', query, params);
      console.log('handleReadGenFile response', response);
      const data = JSON.parse(response);
      if (data.code !== 0 && data.code !== 10000) {
        console.error('handleReadGenFile error', data.message);
        return data.message;
      }
      if (data.data.status === 'done') {
        console.log('handleReadGenFile response', data.data);
        return data.data.video_url || data.data.image_urls[0] || data.data.image_url;
      }
      else {
        return JSON.stringify(params);
      }
    } catch (error) {
      console.error('Error calling handleReadGenFile API:', error);
      return `[]`;
    }
  }
}