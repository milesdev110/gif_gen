import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { join } from "path";
import express from 'express';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execAsync = promisify(exec);
const ffmpegPath = ffmpegInstaller.path;

console.log('🎥 FFmpeg路径:', ffmpegPath);

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

async function extractFrames(filename: string, fps: number = 10): Promise<void> {
  try {
    const framesDir = join(process.cwd(), 'frames');
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir);
    }
    const command = `${ffmpegPath} -i ${filename} -vf fps=${fps} frames/frame_%04d.png`;
    console.log('🎞️  执行命令:', command);
    console.log(`📊 提取帧率: ${fps} fps`);
    await execAsync(command);
    
    // 统计提取的帧数
    const frameCount = fs.readdirSync(framesDir).filter(f => f.startsWith('frame_') && f.endsWith('.png')).length;
    console.log(`✅ 帧提取完成，共 ${frameCount} 帧`);
  } catch (error: any) {
    console.error(`❌ 帧提取失败:`, error.message);
    throw error;
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

async function generateGif(skipBgRemoval: boolean = false, fps: number = 10): Promise<string> {
  try {
    const framesDir = skipBgRemoval ? 'frames' : 'nobg_frames';
    const framePattern = skipBgRemoval ? 'frame_%04d.png' : 'nobg_frame_%04d.png';
    
    console.log(`📊 GIF帧率设置: ${fps} fps`);
    
    // 第一步：生成调色板
    console.log('🎨 开始生成调色板...');
    const paletteCommand = `${ffmpegPath} -i ${framesDir}/${framePattern} -vf "palettegen=stats_mode=diff" -y ${framesDir}/palette4.png`;
    console.log('执行命令:', paletteCommand);
    
    const { stdout: paletteStdout, stderr: paletteStderr } = await execAsync(paletteCommand);
    
    if (paletteStderr && !paletteStderr.includes('frame=')) {
      console.warn(`⚠️  调色板生成 stderr: ${paletteStderr.substring(0, 200)}`);
    }
    console.log('✅ 调色板生成完成');

    // 第二步：生成 GIF（使用相同的帧率）
    console.log('🎨 开始合成 GIF...');
    const timeStamp = Date.now();
    const filename = `output_${timeStamp}.gif`;
    // 关键：-r 参数必须与提取帧时的fps一致，才能保持相同的播放速度
    const gifCommand = `${ffmpegPath} -r ${fps} -i ${framesDir}/${framePattern} -i ${framesDir}/palette4.png -filter_complex "[0:v][1:v]paletteuse=dither=bayer:diff_mode=rectangle" -loop 0 -y data/${filename}`;
    console.log('执行命令:', gifCommand);
    
    const { stdout: gifStdout, stderr: gifStderr } = await execAsync(gifCommand);
    
    if (gifStderr && !gifStderr.includes('frame=')) {
      console.warn(`⚠️  GIF生成 stderr: ${gifStderr.substring(0, 200)}`);
    }
    console.log('✅ GIF 生成完成！文件名:', filename);
    
    // 检查文件是否真的生成了
    const gifPath = join(process.cwd(), 'data', filename);
    if (!fs.existsSync(gifPath)) {
      throw new Error(`GIF文件未生成: ${gifPath}`);
    }
    
    const stats = fs.statSync(gifPath);
    console.log('📊 GIF文件大小:', stats.size, 'bytes');

    return filename;
  } catch (error: any) {
    console.error(`❌ 执行出错: ${error.message}`);
    throw error;
  }
}

// 主执行流程
export async function video2gif(req: express.Request, res: express.Response): Promise<void> {
  console.log('🎬 ===== video2gif 开始执行 =====');
  console.time('总耗时');
  
  const files = req.files as MulterFile[];
  console.log('📂 接收到的文件:', files?.length || 0);
  
  if (!files || files.length === 0) {
    console.error('❌ 没有接收到视频文件');
    res.status(400).send('没有接收到视频文件');
    return;
  }
  
  console.log('📄 视频文件:', {
    originalname: files[0].originalname,
    size: files[0].size,
    path: files[0].path
  });
 
  try {
    // 从请求参数获取配置
    const skipBgRemoval = req.body.skipBgRemoval !== 'false' && req.body.skipBgRemoval !== false;
    const fps = parseInt(req.body.fps) || 10; // 默认10fps，保证流畅度
    
    console.log('⚙️  配置参数:');
    console.log('   - 跳过背景去除:', skipBgRemoval);
    console.log('   - 帧率 (fps):', fps);
    
    // 删除 frames 和 nobg_frames 目录及其内容
    const framesDir = join(process.cwd(), 'frames');
    const nobgFramesDir = join(process.cwd(), 'nobg_frames');
    
    console.log('🗑️  清理旧的临时文件...');
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }
    if (fs.existsSync(nobgFramesDir)) {
      fs.rmSync(nobgFramesDir, { recursive: true, force: true });
    }
    
    console.log('🎞️  开始提取视频帧...');
    await extractFrames(files[0].path, fps);
    
    // 只有在需要时才去除背景
    if (!skipBgRemoval) {
      console.log('🖼️  开始去除背景（使用remove.bg API）...');
      await removeBackground();
    } else {
      console.log('⏭️  跳过背景去除步骤');
    }
    
    console.log('🎨 开始生成GIF...');
    const gifName = await generateGif(skipBgRemoval, fps);
    
    // 返回本地文件URL（通过 /files 静态服务访问）
    // 注意：不使用 FILE_ROOT_URL，因为GIF文件在本地服务器上
    const fileUrl = `http://localhost:3000/files/${gifName}`;
    
    console.log('✅ GIF生成成功:', fileUrl);
    console.log('📁 GIF本地路径:', join(process.cwd(), 'data', gifName));
    console.log(`⏱️  视频时长计算: 帧数 / ${fps} fps`);
    console.timeEnd('总耗时');
    
    res.status(200).send(fileUrl);
  } catch (error: any) {
    console.error('❌ 视频转GIF失败:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).send({ error: '视频转GIF失败', message: error.message });
  }
  
  console.log('🎬 ===== video2gif 执行结束 =====');
}