const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// 正确设置 ffmpeg 路径
try {
    const ffmpegStatic = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegStatic);
    console.log('FFmpeg路径设置成功');
} catch (error) {
    console.warn('FFmpeg路径设置警告:', error.message);
}

class VideoSplitter {
    /**
     * 拆分视频
     * @param {string} inputPath - 输入视频路径
     * @param {number} splitSeconds - 拆分的时间点（秒）
     * @param {string} outputDir - 输出目录
     * @returns {Promise<{part1: string, part2: string}>}
     */
    static async splitVideo(inputPath, splitSeconds, outputDir = './output') {
        return new Promise((resolve, reject) => {
            try {
                // 验证输入文件是否存在
                if (!fs.existsSync(inputPath)) {
                    return reject(new Error(`输入视频文件不存在: ${inputPath}`));
                }

                // 确保输出目录存在
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const baseName = path.basename(inputPath, path.extname(inputPath));
                const part1Path = path.join(outputDir, `${baseName}_part1.mp4`);
                const part2Path = path.join(outputDir, `${baseName}_part2.mp4`);
                const tempRemainingPath = path.join(outputDir, `${baseName}_temp_remaining.mp4`);
                const tempReversedPath = path.join(outputDir, `${baseName}_temp_reversed.mp4`);

                console.log('开始处理视频...');
                console.log(`输入文件: ${inputPath}`);
                console.log(`拆分时间: ${splitSeconds}秒`);
                console.log(`输出目录: ${outputDir}`);

                // 第一步：提取前 n 秒作为第一部分
                console.log('生成第一部分...');
                ffmpeg(inputPath)
                    .setStartTime(0)
                    .setDuration(splitSeconds)
                    .output(part1Path)
                    .videoCodec('libx264')
                    .noAudio()
                    .on('start', (commandLine) => {
                        console.log('第一部分处理命令:', commandLine);
                    })
                    .on('end', () => {
                        console.log('第一部分生成完成');

                        // 第二步：提取剩余部分（不翻转）
                        console.log('提取剩余部分...');
                        ffmpeg(inputPath)
                            .setStartTime(splitSeconds)
                            .output(tempRemainingPath)
                            .videoCodec('libx264')
                            .noAudio()
                            .on('start', (commandLine) => {
                                console.log('剩余部分处理命令:', commandLine);
                            })
                            .on('end', () => {
                                console.log('剩余部分提取完成');

                                // 第三步：提取剩余部分并翻转
                                console.log('提取并翻转剩余部分...');
                                ffmpeg(inputPath)
                                    .setStartTime(splitSeconds)
                                    .output(tempReversedPath)
                                    .videoFilters('reverse')
                                    .videoCodec('libx264')
                                    .noAudio()
                                    .on('start', (commandLine) => {
                                        console.log('翻转部分处理命令:', commandLine);
                                    })
                                    .on('end', () => {
                                        console.log('翻转部分生成完成');

                                        // 第四步：将剩余部分和翻转部分拼接成第二部分
                                        console.log('拼接第二部分（剩余部分 + 翻转部分）...');
                                        ffmpeg()
                                            .input(tempRemainingPath)
                                            .input(tempReversedPath)
                                            .complexFilter([
                                                '[0:v][1:v]concat=n=2:v=1:a=0[outv]'
                                            ])
                                            .map('[outv]')
                                            .output(part2Path)
                                            .videoCodec('libx264')
                                            .noAudio()
                                            .on('start', (commandLine) => {
                                                console.log('拼接命令:', commandLine);
                                            })
                                            .on('end', () => {
                                                console.log('第二部分拼接完成');

                                                // 清理临时文件
                                                try {
                                                    if (fs.existsSync(tempRemainingPath)) {
                                                        fs.unlinkSync(tempRemainingPath);
                                                    }
                                                    if (fs.existsSync(tempReversedPath)) {
                                                        fs.unlinkSync(tempReversedPath);
                                                    }
                                                    console.log('临时文件清理完成');
                                                } catch (cleanupError) {
                                                    console.warn('清理临时文件失败:', cleanupError.message);
                                                }

                                                console.log('视频处理完成！');
                                                resolve({
                                                    part1: part1Path,
                                                    part2: part2Path
                                                });
                                            })
                                            .on('error', (err) => {
                                                reject(new Error(`拼接第二部分失败: ${err.message}`));
                                            })
                                            .run();
                                    })
                                    .on('error', (err) => {
                                        reject(new Error(`生成翻转部分失败: ${err.message}`));
                                    })
                                    .run();
                            })
                            .on('error', (err) => {
                                reject(new Error(`提取剩余部分失败: ${err.message}`));
                            })
                            .run();
                    })
                    .on('error', (err) => {
                        reject(new Error(`提取第一部分失败: ${err.message}`));
                    })
                    .on('progress', (progress) => {
                        console.log(`第一部分处理进度: ${Math.round(progress.percent)}%`);
                    })
                    .run();

            } catch (error) {
                reject(new Error(`初始化处理失败: ${error.message}`));
            }
        });
    }

    /**
     * 获取视频时长 - 使用 ffmpeg 命令而不是 ffprobe
     * @param {string} inputPath - 视频路径
     * @returns {Promise<number>} 视频时长（秒）
     */
    static async getVideoDuration(inputPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                return reject(new Error('视频文件不存在'));
            }

            // 使用 ffmpeg 命令来获取视频时长，避免 ffprobe 问题
            ffmpeg(inputPath)
                .ffprobe((err, metadata) => {
                    if (err) {
                        reject(new Error(`获取视频时长失败: ${err.message}`));
                    } else if (!metadata.format || !metadata.format.duration) {
                        reject(new Error('无法获取视频时长信息'));
                    } else {
                        resolve(metadata.format.duration);
                    }
                });
        });
    }

    /**
     * 验证拆分参数
     * @param {string} inputPath - 输入视频路径
     * @param {number} splitSeconds - 拆分时间
     * @returns {Promise<boolean>}
     */
    static async validateSplit(inputPath, splitSeconds) {
        if (!fs.existsSync(inputPath)) {
            throw new Error('输入视频文件不存在');
        }

        const duration = await this.getVideoDuration(inputPath);
        
        if (splitSeconds <= 0) {
            throw new Error('拆分时间必须大于0');
        }

        if (splitSeconds >= duration) {
            throw new Error(`拆分时间(${splitSeconds}秒)不能超过视频总时长(${duration.toFixed(2)}秒)`);
        }

        console.log(`视频总时长: ${duration.toFixed(2)}秒`);
        console.log(`拆分时间点: ${splitSeconds}秒`);
        console.log(`第二部分时长: ${(2 * (duration - splitSeconds)).toFixed(2)}秒（剩余部分 + 翻转部分）`);
        
        return true;
    }

    // async function video2flip(req, res) 
}


     async function handleVideoSplit(req, res) {
        try {
            const { splitSeconds } = req.body;
            const file = req.files && req.files[0];

            if (!file) {
                return res.status(400).json({ error: '请上传视频文件' });
            }

            if (!splitSeconds || splitSeconds <= 0) {
                return res.status(400).json({ error: '请提供有效的拆分时间（秒）' });
            }

            const inputPath = file.path;
            const outputDir = path.join(process.cwd(), 'data', 'output');

            // 验证参数 - 修复：使用 VideoSplitter 类而不是 this
            await VideoSplitter.validateSplit(inputPath, splitSeconds);

            // 执行拆分 - 修复：使用 VideoSplitter 类而不是 this
            const result = await VideoSplitter.splitVideo(inputPath, splitSeconds, outputDir);

            res.status(200).json({
                success: true,
                message: '视频处理完成',
                result: {
                    part1: `http://97.64.21.158:3000/files/output/`+path.basename(result.part1),
                    part2: `http://97.64.21.158:3000/files/output/`+path.basename(result.part2),
                    description: `第一部分：前${splitSeconds}秒，第二部分：剩余部分 + 翻转部分`
                }
            });
            return;
        } catch (error) {
            console.error('视频处理失败:', error.message);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
        return;
    }


// // 主执行流程
// async function video2flip(req, res) {
//   console.time('总耗时');
//   console.log(req.files); 
//   console.log(req.body.splitTime);
//   const splitTime = parseFloat(req.body?.splitTime) || 3;

//   if(req.files.length === 0) {
//     res.status(400).send('请上传视频文件');
//     return;
//   }
 
//   try {
        
//         await VideoSplitter.validateSplit(req.files[0].path, splitTime);
//         const result = await VideoSplitter.splitVideo(req.files[0].path, splitTime, outputDir);
//         console.log('\n处理结果:');
//         console.log(`第一部分（前${splitTime}秒）: ${result.part1}`);
//         console.log(`第二部分（剩余部分 + 翻转部分）: ${result.part2}`);

//         console.timeEnd('总耗时');
//         res.status(200).send(`http://97.64.21.158:3000/files/${result.part1};http://97.64.21.158:3000/files/${result.part2};`);
//   } catch (error) {
//     console.error('视频转GIF失败:', error);
//     res.status(500).send('视频转GIF失败');
//   }

// }
// 使用示例
async function main() {
    try {
        const inputVideo = './input.mp4'; // 输入视频路径
        const splitTime = 3; // 拆分时间（秒）
        const outputDir = './output'; // 输出目录

        // 验证参数
        await VideoSplitter.validateSplit(inputVideo, splitTime);

        // 执行拆分
        const result = await VideoSplitter.splitVideo(inputVideo, splitTime, outputDir);
        
        console.log('\n处理结果:');
        console.log(`第一部分（前${splitTime}秒）: ${result.part1}`);
        console.log(`第二部分（剩余部分 + 翻转部分）: ${result.part2}`);

    } catch (error) {
        console.error('处理失败:', error.message);
    }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
    main();
}

module.exports = {handleVideoSplit };