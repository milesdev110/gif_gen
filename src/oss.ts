//
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
//import { DateTime } from 'luxon';

/**
 * 获取文件上传凭证
 */
export async function getUploadPolicy(apiKey: string, modelName: string) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/uploads';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  const params = {
    action: 'getPolicy',
    model: modelName
  };

  try {
    const response = await axios.get(url, { headers, params });
    if (response.status !== 200) {
      throw new Error(`Failed to get upload policy: ${response.statusText}`);
    }
    return response.data.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`GetPolicy failed: ${error.response.data.message || error.response.statusText}`);
    } else {
      throw error;
    }
  }
}

/**
 * 将文件上传到临时存储OSS
 */
export async function uploadFileToOSS(policyData, filePath: string) {
  const fileName = path.basename(filePath);
  const key = `${policyData.upload_dir}/${fileName}`;

  const form = new FormData();
  form.append('OSSAccessKeyId', policyData.oss_access_key_id);
  form.append('Signature', policyData.signature);
  form.append('policy', policyData.policy);
  form.append('x-oss-object-acl', policyData.x_oss_object_acl);
  form.append('x-oss-forbid-overwrite', policyData.x_oss_forbid_overwrite);
  form.append('key', key);
  form.append('success_action_status', '200');
  form.append('file', fs.createReadStream(filePath), {
    filename: fileName,
    contentType: mimeLookup(fileName)
  });

  try {
    const response = await axios.post(policyData.upload_host, form, {
      headers: form.getHeaders() //content-type: multipart/form-data
    });

    if (response.status !== 200) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return `oss://${key}`;
  } catch (error) {
    if (error.response) {
      throw new Error(`Upload failed: ${error.response.data ? error.response.data.toString() : error.response.statusText}`);
    } else {
      throw new Error(`Request error: ${error.message}`);
    }
  }
}

/**
 * MIME Type
 */
function mimeLookup(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Get oss URL
 */
export async function uploadFileAndGetUrl(apiKey: string, modelName: string, filePath: string) {
  // Check file existence
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // 1. get
  const policyData = await getUploadPolicy(apiKey, modelName);

  // 2. update
  const ossUrl = await uploadFileToOSS(policyData, filePath);

  return ossUrl;
}

// === Test ===
async function test() {
  // Get API Key
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('Error: Please set DASHSCOPE_API_KEY environment variable.');
    process.exit(1);
  }

  const modelName = 'qwen-vl-plus';
  const filePath = 'C:\\Users\\lv\\Downloads\\e6914cc8-b54d-48d5-a45f-ed5be816898b.png';

  try {
    const publicUrl = await uploadFileAndGetUrl(apiKey, modelName, filePath);
    //const expireTime = DateTime.now().plus({ hours: 48 });
    //console.log(`File: ${expireTime.toFormat('yyyy-MM-dd HH:mm:ss')}`);
    console.log(`URL: ${publicUrl}`);
    console.log("Success");
  } catch (error) {
    console.error('Error:', error.message);
  }
}
