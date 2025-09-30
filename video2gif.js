const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const { join } = require("path");
const execAsync = promisify(exec);

async function extractFrames(filename) {
  try {
    const framesDir = join(process.cwd(), 'frames');
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir);
    }
    await execAsync(`ffmpeg -i ${filename} -vf fps=1 frames/frame_%04d.png`);
    console.log('帧提取完成');
  } catch (error) {
    console.error(`帧提取失败: ${error}`);
  }
}


async function removeBg(blob) {
  const formData = new FormData();
  formData.append("size", "auto");
  formData.append("image_file", blob);

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": "26TZbpFJpi7D3VvedLPbtWwK" },
    body: formData,
  });

  if (response.ok) {
    return await response.arrayBuffer();
  } else {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
}

async function removeBackground() {
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
    } catch (err) {
      console.error(`处理失败 ${file}:`, err.message);
    }
  }
}


async function generateGif() {
  try {
    // 第一步：生成调色板
    console.log('开始生成调色板...');
    const { stdout: paletteStdout, stderr: paletteStderr } = await execAsync(
      'ffmpeg -framerate 10 -i nobg_frames/nobg_frame_%04d.png -vf "palettegen" nobg_frames/palette.png'
    );
    
    if (paletteStderr) {
      console.error(`调色板生成 stderr: ${paletteStderr}`);
    }
    console.log(`调色板生成 stdout: ${paletteStdout}`);

    // 第二步：生成 GIF
    console.log('开始合成 GIF...');
    const { stdout: gifStdout, stderr: gifStderr } = await execAsync(
      'ffmpeg -framerate 10 -i nobg_frames/nobg_frame_%04d.png -i nobg_frames/palette.png -lavfi "paletteuse" nobg_frames/output.gif'
    );
    
    if (gifStderr) {
      console.error(`GIF 生成 stderr: ${gifStderr}`);
    }
    console.log(`GIF 生成 stdout: ${gifStdout}`);

    console.log('GIF 生成完成！');
  } catch (error) {
    console.error(`执行出错: ${error.message}`);
  }
}

// 主执行流程
async function main() {
  console.time('总耗时');
  
  await extractFrames('input.mp4');
  await removeBackground();
  await generateGif();

  console.timeEnd('总耗时');
}

// 执行主流程
main();