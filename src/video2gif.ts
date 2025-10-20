import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { join } from "path";
import express from 'express';

const execAsync = promisify(exec);

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

async function extractFrames(filename: string): Promise<void> {
  try {
    const framesDir = join(process.cwd(), 'frames');
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir);
    }
    await execAsync(`ffmpeg -i ${filename} -vf fps=3 frames/frame_%04d.png`);
    console.log('帧提取完成');
  } catch (error: any) {
    console.error(`帧提取失败: ${error}`);
  }
}

async function removeBg(blob: Blob): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append("size", "auto");
  formData.append("image_file", blob);

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": "Y2WyPs2cUW6nxHB2ng18A1D1" },
    body: formData,
  });

  if (response.ok) {
    return await response.arrayBuffer();
  } else {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
}

async function removeBackground(): Promise<void> {
  const framesDir = join(process.cwd(), 'frames');
  const outputDir = join(process.cwd(), 'nobg_frames');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const pngFiles = fs.readdirSync(framesDir)
    .filter(file => file.endsWith('.png'))
    .sort();

  for (const file of pngFiles) {
    try {
      const filePath = join(framesDir, file);
      const fileData = fs.readFileSync(filePath);
      const fileBlob = new Blob([fileData], { type: 'image/png' });
      const rbgResult = await removeBg(fileBlob);
      fs.writeFileSync(
        join(outputDir, `nobg_${file}`),
        Buffer.from(rbgResult)
      );
      console.log(`已处理: ${file}`);
    } catch (err: any) {
      console.error(`处理失败 ${file}:`, err.message);
    }
  }
}

async function generateGif(): Promise<string> {
  try {
    // 第一步：生成调色板
    console.log('开始生成调色板...');
    const { stdout: paletteStdout, stderr: paletteStderr } = await execAsync(
        `ffmpeg -i nobg_frames/nobg_frame_%04d.png -vf "palettegen=stats_mode=diff" -y nobg_frames/palette4.png`
    //   'ffmpeg -framerate 10 -i nobg_frames/nobg_frame_%04d.png -vf "palettegen" nobg_frames/palette.png'
    );
    
    if (paletteStderr) {
      console.error(`调色板生成 stderr: ${paletteStderr}`);
    }
    console.log(`调色板生成 stdout: ${paletteStdout}`);

    // 第二步：生成 GIF
    console.log('开始合成 GIF...');
    const timeStamp = Date.now();
    const filename = `output_${timeStamp}.gif`;
    const { stdout: gifStdout, stderr: gifStderr } = await execAsync(
        `ffmpeg -r 10 -i nobg_frames/nobg_frame_%04d.png -i nobg_frames/palette4.png -filter_complex "[0:v][1:v]paletteuse=dither=bayer:diff_mode=rectangle" -loop 0 -y data/${filename}`
    //   `ffmpeg -framerate 10 -i nobg_frames/nobg_frame_%04d.png -i nobg_frames/palette.png -lavfi "paletteuse" data/${filename}`
    );
    
    if (gifStderr) {
      console.error(`GIF 生成 stderr: ${gifStderr}`);
    }
    console.log(`GIF 生成 stdout: ${gifStdout}`);

    console.log('GIF 生成完成！');
    return filename;
  } catch (error: any) {
    console.error(`执行出错: ${error.message}`);
    throw error;
  }
}

// 主执行流程
export async function video2gif(req: express.Request, res: express.Response): Promise<void> {
  console.time('总耗时');
  const files = req.files as MulterFile[];
  console.log(files); 
 
  try {
    // 删除 frames 和 nobg_frames 目录及其内容
    const framesDir = join(process.cwd(), 'frames');
    const nobgFramesDir = join(process.cwd(), 'nobg_frames');
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
    if (fs.existsSync(nobgFramesDir)) {
      fs.rmSync(nobgFramesDir, { recursive: true, force: true });
    }
    
    await extractFrames(files[0].path);
    await removeBackground();
    const gifName = await generateGif();
    
    console.timeEnd('总耗时');
    res.status(200).send(`http://97.64.21.158:3000/files/${gifName}`);
  } catch (error: any) {
    console.error('视频转GIF失败:', error);
    res.status(500).send('视频转GIF失败');
  }
}