"use strict";
/*
Copyright (year) Beijing Volcano Engine Technology Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

//import axios from 'axios';
import crypto from 'crypto';
import qs from 'querystring';
import url from 'url';
//import util from 'util';
//import util from 'legacy-util';
import fetch from 'node-fetch';


/**
 * 不参与加签过程的 header key
 */
const HEADER_KEYS_TO_IGNORE = new Set([
    "authorization",
    "content-type",
    "content-length",
    "user-agent",
    "presigned-expires",
    "expect",
]);

// do request example
export async function doRequest(service: string, region: string, method: string, query: any, body: any = null) {
    const signParams = {
        headers: {
            // x-date header 是必传的
            ["X-Date"]: getDateTimeNow(),
            ["Content-Type"]: "application/json",
        },
        method: method,
        query: query,
        accessKeyId: process.env.VOLCE_API_KEY || '**********',
        secretAccessKey: process.env.VOLCE_ACCESS_TOKEN || '**********',
        serviceName: service,
        region: region,
        bodySha: getBodySha(JSON.stringify(body)),
    };
    // 正规化 query object， 防止串化后出现 query 值为 undefined 情况
    for (const [key, val] of Object.entries(signParams.query)) {
        if (val === undefined || val === null) {
            signParams.query[key] = '';
        }
    }
    const authorization = sign(signParams);
    const res = await fetch(`https://iam.volcengineapi.com/?${qs.stringify(signParams.query)}`, {
        headers: {
            ...signParams.headers,
            'Authorization': authorization,
        },
        method: signParams.method,
        body: JSON.stringify(body),
    });
    const responseText = await res.text();
    console.log(responseText);
    return responseText;
}


function sign(params: any) {
    const {
        headers = {},
        query = {},
        region = '',
        serviceName = '',
        method = '',
        pathName = '/',
        accessKeyId = '',
        secretAccessKey = '',
        needSignHeaderKeys = [],
        bodySha,
    } = params;
    const datetime = headers["X-Date"];
    const date = datetime.substring(0, 8); // YYYYMMDD
    // 创建正规化请求
    const [signedHeaders, canonicalHeaders] = getSignHeaders(headers, needSignHeaderKeys);
    const canonicalRequest = [
        method.toUpperCase(),
        pathName,
        queryParamsToString(query) || '',
        `${canonicalHeaders}\n`,
        signedHeaders,
        bodySha || hash(''),
    ].join('\n');
    const credentialScope = [date, region, serviceName, "request"].join('/');
    // 创建签名字符串
    const stringToSign = ["HMAC-SHA256", datetime, credentialScope, hash(canonicalRequest)].join('\n');
    // 计算签名
    const kDate = hmac(secretAccessKey, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, serviceName);
    const kSigning = hmac(kService, "request");
    const signature = hmac(kSigning, stringToSign).toString('hex');
    //console.log('--------CanonicalString:\n%s\n--------SignString:\n%s', canonicalRequest, stringToSign);

    return [
        "HMAC-SHA256",
        `Credential=${accessKeyId}/${credentialScope},`,
        `SignedHeaders=${signedHeaders},`,
        `Signature=${signature}`,
    ].join(' ');
}

function hmac(secret: string | Buffer, s: string): Buffer {
    return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
}

function hash(s: string): string {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function queryParamsToString(params: Record<string, any>): string {
    return Object.keys(params)
        .sort()
        .map((key) => {
            const val = params[key];
            if (typeof val === 'undefined' || val === null) {
                return undefined;
            }
            const escapedKey = uriEscape(key);
            if (!escapedKey) {
                return undefined;
            }
            if (Array.isArray(val)) {
                return `${escapedKey}=${val.map(uriEscape).sort().join(`&${escapedKey}=`)}`;
            }
            return `${escapedKey}=${uriEscape(val)}`;
        })
        .filter((v) => v)
        .join('&');
}

function getSignHeaders(originHeaders: Record<string, any>, needSignHeaders: string[]): [string, string] {
    function trimHeaderValue(header: any): string {
        return header.toString?.().trim().replace(/\s+/g, ' ') ?? '';
    }

    let h = Object.keys(originHeaders);
    // 根据 needSignHeaders 过滤
    if (Array.isArray(needSignHeaders)) {
        const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase()));
        h = h.filter((k) => needSignSet.has(k.toLowerCase()));
    }
    // 根据 ignore headers 过滤
    h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));
    const signedHeaderKeys = h
        .slice()
        .map((k) => k.toLowerCase())
        .sort()
        .join(';');
    const canonicalHeaders = h
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
        .join('\n');
    return [signedHeaderKeys, canonicalHeaders];
}

function uriEscape(str: string): string {
    try {
        return encodeURIComponent(str)
            .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
            .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    } catch (e) {
        return '';
    }
}

function getDateTimeNow(): string {
    const now = new Date();
    return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

// 获取 body sha256
function getBodySha(body: string | Buffer | url.URLSearchParams): string {
    //console.log('getBodySha body', body);
    //console.log('getBodySha body type', typeof body);
    const hash = crypto.createHash('sha256');
    if (typeof body === 'string') {
        hash.update(body);
    } else if (body instanceof url.URLSearchParams) {
        hash.update(body.toString());
    } else if (Buffer.isBuffer(body)) {
        //console.log('getBodySha body Buffer');
        hash.update(body);
    } /*else {
        return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    }*/
    return hash.digest('hex');
}