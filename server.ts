import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import OSS from "ali-oss";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Support 20+ high-res base64 reference images in a single payload
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

export type ServerCloudStorageProvider = "aliyun_oss" | "cloudflare_r2";

export interface ServerOssConfigInput {
  enabled?: boolean;
  provider?: ServerCloudStorageProvider;
  // Alibaba Cloud OSS
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  customDomain?: string;
  pathPrefix?: string;
  // Cloudflare R2
  r2AccountId?: string;
  r2Endpoint?: string;
  r2Bucket?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2CustomDomain?: string;
  r2PathPrefix?: string;
  // Shared policies
  autoUploadRefs?: boolean;
  autoArchiveResults?: boolean;
  preferZeroBase64Transport?: boolean;
}

interface ResolvedOssCredentials {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  customDomain: string;
  pathPrefix: string;
  source: "client_config" | "env_vars";
}

interface ResolvedR2Credentials {
  accountId: string;
  endpoint: string; // e.g. https://<accountId>.r2.cloudflarestorage.com
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  customDomain: string;
  pathPrefix: string;
  source: "client_config" | "env_vars";
}

function resolveActiveCloudProvider(
  override?: ServerOssConfigInput
): ServerCloudStorageProvider {
  if (override?.provider === "cloudflare_r2") return "cloudflare_r2";
  if (override?.provider === "aliyun_oss") return "aliyun_oss";
  // If no explicit provider specified on client, check if R2 env is configured while OSS env is not
  const hasOssEnv = Boolean(
    process.env.ALIYUN_OSS_BUCKET &&
      process.env.ALIYUN_OSS_ACCESS_KEY_ID &&
      process.env.ALIYUN_OSS_ACCESS_KEY_SECRET
  );
  const hasR2Env = Boolean(
    (process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ENDPOINT) &&
      process.env.CLOUDFLARE_R2_BUCKET &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
  if (!hasOssEnv && hasR2Env) return "cloudflare_r2";
  return "aliyun_oss";
}

function normalizeOssRegion(raw?: string): string {
  const cleaned = (raw || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.aliyuncs\.com$/i, "")
    .trim();
  const regionMatch = cleaned.match(/(oss-[a-z0-9-]+)/i);
  if (regionMatch) {
    return regionMatch[1].toLowerCase();
  }
  return cleaned || "oss-cn-hangzhou";
}

function resolveOssCredentials(
  override?: ServerOssConfigInput
): ResolvedOssCredentials | null {
  const fromClient = Boolean(
    override?.bucket?.trim() &&
      override?.accessKeyId?.trim() &&
      override?.accessKeySecret?.trim()
  );

  const rawRegion = normalizeOssRegion(
    fromClient
      ? override?.region || process.env.ALIYUN_OSS_REGION
      : process.env.ALIYUN_OSS_REGION || override?.region
  );
  const rawBucket = (
    fromClient
      ? override?.bucket
      : process.env.ALIYUN_OSS_BUCKET || override?.bucket || ""
  )
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\.oss-[a-z0-9-]+\.aliyuncs\.com.*$/i, "")
    .replace(/\/.*$/, "") || "";
  const rawKeyId = (
    fromClient
      ? override?.accessKeyId
      : process.env.ALIYUN_OSS_ACCESS_KEY_ID || override?.accessKeyId || ""
  )?.trim() || "";
  const rawKeySecret = (
    fromClient
      ? override?.accessKeySecret
      : process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || override?.accessKeySecret || ""
  )?.trim() || "";
  const rawCustomDomain = (
    fromClient
      ? override?.customDomain || process.env.ALIYUN_OSS_CUSTOM_DOMAIN || ""
      : process.env.ALIYUN_OSS_CUSTOM_DOMAIN || override?.customDomain || ""
  )
    .trim()
    .replace(/\/+$/, "");
  const rawPrefix = (
    fromClient
      ? override?.pathPrefix || process.env.ALIYUN_OSS_PATH_PREFIX || "ecom-studio-assets"
      : process.env.ALIYUN_OSS_PATH_PREFIX || override?.pathPrefix || "ecom-studio-assets"
  )
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!rawBucket || !rawKeyId || !rawKeySecret) {
    return null;
  }

  return {
    region: rawRegion || "oss-cn-hangzhou",
    bucket: rawBucket,
    accessKeyId: rawKeyId,
    accessKeySecret: rawKeySecret,
    customDomain: rawCustomDomain,
    pathPrefix: rawPrefix || "ecom-studio-assets",
    source: fromClient ? "client_config" : "env_vars",
  };
}

function normalizeR2AccountAndEndpoint(
  rawAccountId?: string,
  rawEndpoint?: string
): { accountId: string; endpoint: string; pathBucketHint: string } {
  let accountId = (rawAccountId || "").trim();
  let endpoint = (rawEndpoint || "").trim();
  let pathBucketHint = "";

  // Extract account ID (and optional bucket path) if user pasted a full R2 endpoint URL into Account ID field
  const accMatch = accountId.match(
    /([a-f0-9]{20,40})(?:\.[a-z0-9-]+)?\.r2\.cloudflarestorage\.com(?:\/+([^/?#]+))?/i
  );
  if (accMatch) {
    accountId = accMatch[1];
    if (accMatch[2]) {
      pathBucketHint = accMatch[2].trim();
    }
  } else {
    accountId = accountId
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/\.r2\.cloudflarestorage\.com$/i, "")
      .trim();
  }

  if (endpoint) {
    if (!/^https?:\/\//i.test(endpoint)) {
      endpoint = `https://${endpoint}`;
    }
    try {
      const parsed = new URL(endpoint);
      let host = parsed.host;
      const firstPathSeg = parsed.pathname
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (firstPathSeg && !pathBucketHint) {
        pathBucketHint = firstPathSeg;
      }

      // Handle virtual-hosted style paste: <bucket>.<accountId>.r2.cloudflarestorage.com
      const virtualHostMatch = parsed.hostname.match(
        /^([a-z0-9._-]+)\.([a-f0-9]{20,40})((?:\.eu|\.fedramp)?\.r2\.cloudflarestorage\.com)$/i
      );
      if (virtualHostMatch) {
        if (!pathBucketHint) {
          pathBucketHint = virtualHostMatch[1];
        }
        if (!accountId) {
          accountId = virtualHostMatch[2];
        }
        host = `${virtualHostMatch[2]}${virtualHostMatch[3]}`;
      } else if (!accountId) {
        const hostMatch = parsed.hostname.match(
          /^([a-z0-9-]+?)(?:\.eu|\.fedramp)?\.r2\.cloudflarestorage\.com$/i
        );
        if (hostMatch) {
          accountId = hostMatch[1];
        }
      }
      endpoint = `${parsed.protocol}//${host}`;
    } catch {
      endpoint = endpoint.replace(/\/+$/, "");
    }
  } else if (accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return { accountId, endpoint, pathBucketHint };
}

function cleanR2BucketInput(raw?: string, fallbackHint = ""): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return fallbackHint;

  // If user pasted a full R2 URL into Bucket field: https://<accountId>.r2.cloudflarestorage.com/<bucket>
  if (/^https?:\/\//i.test(trimmed) || /\.r2\.cloudflarestorage\.com/i.test(trimmed)) {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const parsed = new URL(withProto);
      const pathSeg = parsed.pathname
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (pathSeg) return pathSeg;
      const vhMatch = parsed.hostname.match(
        /^([a-z0-9._-]+)\.[a-f0-9]{20,40}(?:\.eu|\.fedramp)?\.r2\.cloudflarestorage\.com$/i
      );
      if (vhMatch) return vhMatch[1];
    } catch {
      // Fallback below
    }
  }

  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0]
    .trim() || fallbackHint;
}

function resolveR2Credentials(
  override?: ServerOssConfigInput
): ResolvedR2Credentials | null {
  const { accountId, endpoint, pathBucketHint } = normalizeR2AccountAndEndpoint(
    override?.r2AccountId?.trim() || process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    override?.r2Endpoint?.trim() || process.env.CLOUDFLARE_R2_ENDPOINT
  );

  const clientBucket = cleanR2BucketInput(override?.r2Bucket, pathBucketHint);
  const envBucket = cleanR2BucketInput(
    process.env.CLOUDFLARE_R2_BUCKET,
    pathBucketHint
  );

  const fromClient = Boolean(
    (override?.r2AccountId?.trim() || override?.r2Endpoint?.trim()) &&
      clientBucket &&
      override?.r2AccessKeyId?.trim() &&
      override?.r2SecretAccessKey?.trim()
  );

  const rawBucket = fromClient ? clientBucket : envBucket || clientBucket;

  const rawKeyId = (
    fromClient
      ? override?.r2AccessKeyId
      : process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || override?.r2AccessKeyId || ""
  )?.trim() || "";

  const rawSecret = (
    fromClient
      ? override?.r2SecretAccessKey
      : process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
        override?.r2SecretAccessKey ||
        ""
  )?.trim() || "";

  const rawCustomDomain = (
    fromClient
      ? override?.r2CustomDomain || process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN || ""
      : process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN || override?.r2CustomDomain || ""
  )
    .trim()
    .replace(/\/+$/, "");

  const rawPrefix = (
    fromClient
      ? override?.r2PathPrefix ||
        override?.pathPrefix ||
        process.env.CLOUDFLARE_R2_PATH_PREFIX ||
        "ecom-studio-assets"
      : process.env.CLOUDFLARE_R2_PATH_PREFIX ||
        override?.r2PathPrefix ||
        override?.pathPrefix ||
        "ecom-studio-assets"
  )
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!endpoint || !rawBucket || !rawKeyId || !rawSecret) {
    return null;
  }

  return {
    accountId: accountId || "r2",
    endpoint,
    bucket: rawBucket,
    accessKeyId: rawKeyId,
    secretAccessKey: rawSecret,
    customDomain: rawCustomDomain,
    pathPrefix: rawPrefix || "ecom-studio-assets",
    source: fromClient ? "client_config" : "env_vars",
  };
}

// ==================== AWS Signature V4 Helper for Cloudflare R2 (Zero External SDK Dependency) ====================

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeS3KeyPath(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function deriveAwsSigV4SigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region = "auto",
  service = "s3"
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function formatAmzDates(now = new Date()): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

function buildR2PublicOrPresignedUrl(
  creds: ResolvedR2Credentials,
  objectKey: string,
  expiresSeconds = 3600 * 24 * 7
): string {
  if (creds.customDomain) {
    const domainWithProto = /^https?:\/\//i.test(creds.customDomain)
      ? creds.customDomain
      : `https://${creds.customDomain}`;
    return `${domainWithProto}/${encodeS3KeyPath(objectKey)}`;
  }

  // Generate S3 Signature V4 Presigned GET URL valid for up to 7 days (works even when R2 bucket has no public domain enabled)
  const endpointUrl = new URL(creds.endpoint);
  const host = endpointUrl.host;
  const canonicalUri = `/${encodeRfc3986(creds.bucket)}/${encodeS3KeyPath(objectKey)}`;
  const { amzDate, dateStamp } = formatAmzDates();
  const region = "auto";
  const service = "s3";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${creds.accessKeyId}/${credentialScope}`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(Math.max(expiresSeconds, 60), 604800)),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveAwsSigV4SigningKey(
    creds.secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${endpointUrl.protocol}//${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

async function r2SignedRequest(options: {
  creds: ResolvedR2Credentials;
  method: "PUT" | "GET" | "DELETE";
  objectKey: string;
  body?: Buffer;
  contentType?: string;
  cacheControl?: string;
}): Promise<Response> {
  const { creds, method, objectKey, body, contentType, cacheControl } = options;
  const endpointUrl = new URL(creds.endpoint);
  const host = endpointUrl.host;
  const canonicalUri = `/${encodeRfc3986(creds.bucket)}/${encodeS3KeyPath(objectKey)}`;
  const { amzDate, dateStamp } = formatAmzDates();
  const region = "auto";
  const service = "s3";
  const payloadHash = body ? sha256Hex(body) : sha256Hex("");

  // Sign only host + x-amz-* headers per AWS S3 SigV4 best practice so runtime fetch Content-Type normalization cannot cause SignatureDoesNotMatch
  const headerMap: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  const sortedHeaderKeys = Object.keys(headerMap).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headerMap[k].trim()}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveAwsSigV4SigningKey(
    creds.secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    Authorization: authorization,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) fetchHeaders["Content-Type"] = contentType;
  if (cacheControl) fetchHeaders["Cache-Control"] = cacheControl;

  const targetUrl = `${endpointUrl.protocol}//${host}${canonicalUri}`;
  return fetch(targetUrl, {
    method,
    headers: fetchHeaders,
    body: body ? new Uint8Array(body) : undefined,
    signal: AbortSignal.timeout(45000),
  });
}

async function uploadBufferToCloudflareR2(options: {
  buffer: Buffer;
  mimeType: string;
  folder: "refs" | "results" | "test";
  fileNameHint?: string;
  ossConfig?: ServerOssConfigInput;
}): Promise<{
  ossUrl: string;
  objectKey: string;
  bucket: string;
  region: string;
  sizeBytes: number;
}> {
  const { buffer, mimeType, folder, fileNameHint = "image", ossConfig } =
    options;
  const creds = resolveR2Credentials(ossConfig);
  if (!creds) {
    throw new Error(
      "尚未配置完整的 Cloudflare R2 凭据（需要 Account ID/Endpoint、Bucket、AccessKeyId 与 SecretAccessKey）。"
    );
  }

  const ext =
    mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : "jpg";
  const dateFolder = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeHint = fileNameHint
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36);
  const hashSuffix = crypto.randomBytes(4).toString("hex");
  const objectKey = `${creds.pathPrefix}/${folder}/${dateFolder}/${Date.now()}_${safeHint || "asset"}_${hashSuffix}.${ext}`;

  const putResp = await r2SignedRequest({
    creds,
    method: "PUT",
    objectKey,
    body: buffer,
    contentType: mimeType || "image/jpeg",
    cacheControl: "public, max-age=31536000",
  });

  if (!putResp.ok) {
    const errBody = await putResp.text().catch(() => "");
    throw new Error(
      `Cloudflare R2 写入失败 (HTTP ${putResp.status}): ${errBody.slice(0, 220) || putResp.statusText}`
    );
  }

  const ossUrl = buildR2PublicOrPresignedUrl(creds, objectKey);

  // Immediately pre-warm the in-memory LRU cache so subsequent Zero-Base64 AI requests resolve in 0ms
  const b64 = buffer.toString("base64");
  const entry = {
    data: b64,
    mimeType: mimeType || "image/jpeg",
    cachedAt: Date.now(),
    byteSize: b64.length,
  };
  writeOssInlineCache([ossUrl, objectKey], entry);

  return {
    ossUrl,
    objectKey,
    bucket: creds.bucket,
    region: `R2 (${creds.accountId.slice(0, 8)}...)`,
    sizeBytes: buffer.byteLength,
  };
}

function createAliyunOssClient(creds: ResolvedOssCredentials): OSS {
  return new OSS({
    region: creds.region,
    bucket: creds.bucket,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    secure: true,
    timeout: 60000,
  });
}

function buildPublicOrSignedOssUrl(
  client: OSS,
  creds: ResolvedOssCredentials,
  objectKey: string,
  putResultUrl?: string
): string {
  if (creds.customDomain) {
    const domainWithProto = /^https?:\/\//i.test(creds.customDomain)
      ? creds.customDomain
      : `https://${creds.customDomain}`;
    return `${domainWithProto}/${objectKey}`;
  }
  try {
    // Generate a long-lived HTTPS URL (or signed URL valid for 7 days if bucket is private)
    const signed = client.signatureUrl(objectKey, { expires: 3600 * 24 * 7 });
    if (signed) {
      return signed.replace(/^http:\/\//i, "https://");
    }
  } catch {
    // Fallback to standard public OSS URL
  }
  if (putResultUrl) {
    return putResultUrl.replace(/^http:\/\//i, "https://");
  }
  return `https://${creds.bucket}.${creds.region}.aliyuncs.com/${objectKey}`;
}

async function uploadBufferToAliyunOss(options: {
  buffer: Buffer;
  mimeType: string;
  folder: "refs" | "results" | "test";
  fileNameHint?: string;
  ossConfig?: ServerOssConfigInput;
}): Promise<{
  ossUrl: string;
  objectKey: string;
  bucket: string;
  region: string;
  sizeBytes: number;
}> {
  const { buffer, mimeType, folder, fileNameHint = "image", ossConfig } =
    options;
  const creds = resolveOssCredentials(ossConfig);
  if (!creds) {
    throw new Error(
      "尚未配置完整的阿里云 OSS 凭据（需要 Bucket、AccessKeyId 与 AccessKeySecret）。"
    );
  }

  const client = createAliyunOssClient(creds);
  const ext =
    mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : "jpg";
  const dateFolder = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeHint = fileNameHint
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36);
  const hashSuffix = crypto.randomBytes(4).toString("hex");
  const objectKey = `${creds.pathPrefix}/${folder}/${dateFolder}/${Date.now()}_${safeHint || "asset"}_${hashSuffix}.${ext}`;

  const putResult = await client.put(objectKey, buffer, {
    mime: mimeType,
    headers: {
      "Cache-Control": "public, max-age=31536000",
    },
  });

  const ossUrl = buildPublicOrSignedOssUrl(
    client,
    creds,
    objectKey,
    putResult?.url
  );

  // Immediately pre-warm the in-memory LRU cache so subsequent Zero-Base64 AI requests resolve in 0ms without re-downloading from OSS
  const b64 = buffer.toString("base64");
  const entry = {
    data: b64,
    mimeType: mimeType || "image/jpeg",
    cachedAt: Date.now(),
    byteSize: b64.length,
  };
  writeOssInlineCache([ossUrl, objectKey], entry);

  return {
    ossUrl,
    objectKey,
    bucket: creds.region ? creds.bucket : creds.bucket,
    region: creds.region,
    sizeBytes: buffer.byteLength,
  };
}

async function uploadBufferToCloudStorage(options: {
  buffer: Buffer;
  mimeType: string;
  folder: "refs" | "results" | "test";
  fileNameHint?: string;
  ossConfig?: ServerOssConfigInput;
}): Promise<{
  ossUrl: string;
  objectKey: string;
  bucket: string;
  region: string;
  sizeBytes: number;
  provider: ServerCloudStorageProvider;
}> {
  const provider = resolveActiveCloudProvider(options.ossConfig);
  if (provider === "cloudflare_r2") {
    const r2Res = await uploadBufferToCloudflareR2(options);
    return { ...r2Res, provider: "cloudflare_r2" };
  }
  const ossRes = await uploadBufferToAliyunOss(options);
  return { ...ossRes, provider: "aliyun_oss" };
}

interface OssInlineCacheEntry {
  data: string;
  mimeType: string;
  cachedAt: number;
  byteSize: number;
}

const MAX_OSS_INLINE_CACHE_ENTRIES = 160;
const MAX_OSS_INLINE_CACHE_BYTES = 160 * 1024 * 1024; // 160 MB ceiling
let ossInlineCacheTotalBytes = 0;

// True LRU in-memory cache for fetched OSS reference images so repeated multi-screen generation doesn't re-download the same OSS URL
const ossInlineImageCache = new Map<string, OssInlineCacheEntry>();

function readOssInlineCache(
  key: string
): { data: string; mimeType: string } | null {
  const cleanKey = (key || "").trim();
  if (!cleanKey) return null;
  const cached = ossInlineImageCache.get(cleanKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt >= 1000 * 60 * 60) {
    ossInlineImageCache.delete(cleanKey);
    ossInlineCacheTotalBytes = Math.max(
      0,
      ossInlineCacheTotalBytes - (cached.byteSize || cached.data.length)
    );
    return null;
  }
  // Refresh Map insertion order for true LRU behavior
  ossInlineImageCache.delete(cleanKey);
  ossInlineImageCache.set(cleanKey, cached);
  return { data: cached.data, mimeType: cached.mimeType };
}

function writeOssInlineCache(
  keys: Array<string | undefined>,
  entry: OssInlineCacheEntry
): void {
  const validKeys = Array.from(
    new Set(keys.map((k) => (k || "").trim()).filter(Boolean))
  );
  if (validKeys.length === 0) return;

  for (const k of validKeys) {
    const existing = ossInlineImageCache.get(k);
    if (existing) {
      ossInlineImageCache.delete(k);
      ossInlineCacheTotalBytes = Math.max(
        0,
        ossInlineCacheTotalBytes - (existing.byteSize || existing.data.length)
      );
    }
    ossInlineImageCache.set(k, entry);
    ossInlineCacheTotalBytes += entry.byteSize || entry.data.length;
  }

  while (
    ossInlineImageCache.size > MAX_OSS_INLINE_CACHE_ENTRIES ||
    (ossInlineCacheTotalBytes > MAX_OSS_INLINE_CACHE_BYTES &&
      ossInlineImageCache.size > validKeys.length)
  ) {
    const oldestKey = ossInlineImageCache.keys().next().value;
    if (!oldestKey) break;
    const evicted = ossInlineImageCache.get(oldestKey);
    ossInlineImageCache.delete(oldestKey);
    if (evicted) {
      ossInlineCacheTotalBytes = Math.max(
        0,
        ossInlineCacheTotalBytes - (evicted.byteSize || evicted.data.length)
      );
    }
  }
}

function isSafeRemoteHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "metadata.google.internal" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "::" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc00:") ||
      host.startsWith("fd00:") ||
      host.startsWith("::ffff:127.") ||
      host.startsWith("::ffff:10.") ||
      host.startsWith("::ffff:192.168.") ||
      host.startsWith("::ffff:169.254.")
    ) {
      return false;
    }
    // Check IPv4 private / loopback / link-local ranges
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const a = Number(ipv4Match[1]);
      const b = Number(ipv4Match[2]);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveReferenceInlineImage(
  ref: {
    base64Data?: string;
    mimeType?: string;
    previewUrl?: string;
    ossUrl?: string;
    ossObjectKey?: string;
  },
  ossConfig?: ServerOssConfigInput
): Promise<{ data: string; mimeType: string } | null> {
  // 1. If inline Base64 data is already present, sanitize and use it immediately
  const direct = sanitizeInlineImage(
    ref.base64Data,
    ref.mimeType,
    ref.previewUrl
  );
  if (direct) {
    return direct;
  }

  // 2. Check in-memory cache by ossObjectKey or ossUrl first (0ms hit)
  const objectKey = (ref.ossObjectKey || "").trim();
  if (objectKey) {
    const cachedByKey = readOssInlineCache(objectKey);
    if (cachedByKey) {
      return cachedByKey;
    }
  }

  const remoteUrl = (
    ref.ossUrl ||
    (ref.previewUrl && /^https?:\/\//i.test(ref.previewUrl)
      ? ref.previewUrl
      : "")
  ).trim();

  if (remoteUrl) {
    const cachedByUrl = readOssInlineCache(remoteUrl);
    if (cachedByUrl) {
      return cachedByUrl;
    }
  }

  // 3. Try fetching via remoteUrl (standard HTTPS / CDN / Signed URL) with 20s timeout & URL safety check
  if (remoteUrl && isSafeRemoteHttpUrl(remoteUrl)) {
    try {
      const resp = await fetch(remoteUrl, {
        signal: AbortSignal.timeout(20000),
      });
      if (resp.ok) {
        const headerMime = (
          resp.headers.get("content-type") ||
          ref.mimeType ||
          "image/jpeg"
        )
          .split(";")[0]
          .trim()
          .toLowerCase();
        const arrayBuffer = await resp.arrayBuffer();
        const b64 = Buffer.from(arrayBuffer).toString("base64");
        const sanitized = sanitizeInlineImage(b64, headerMime);
        if (sanitized) {
          writeOssInlineCache([remoteUrl, objectKey], {
            ...sanitized,
            cachedAt: Date.now(),
            byteSize: sanitized.data.length,
          });
          return sanitized;
        }
      }
    } catch (err) {
      console.warn("Direct fetch of remoteUrl failed, trying OSS SDK fallback:", err);
    }
  }

  // 4. Fallback: If remoteUrl expired or bucket is private, fetch directly via cloud storage (R2 or OSS) using objectKey
  if (objectKey) {
    const activeProvider = resolveActiveCloudProvider(ossConfig);
    const isExplicitlyOssUrl = /\.aliyuncs\.com/i.test(remoteUrl);
    const isExplicitlyR2Url = /r2\.cloudflarestorage\.com|\.r2\.dev/i.test(
      remoteUrl
    );
    const tryR2First = isExplicitlyR2Url
      ? true
      : isExplicitlyOssUrl
        ? false
        : activeProvider === "cloudflare_r2";

    const tryFetchFromR2 = async (): Promise<{ data: string; mimeType: string } | null> => {
      try {
        const r2Creds = resolveR2Credentials(ossConfig);
        if (!r2Creds) return null;
        const getResp = await r2SignedRequest({
          creds: r2Creds,
          method: "GET",
          objectKey,
        });
        if (getResp.ok) {
          const ab = await getResp.arrayBuffer();
          const b64 = Buffer.from(ab).toString("base64");
          const sanitized = sanitizeInlineImage(
            b64,
            ref.mimeType || "image/jpeg"
          );
          if (sanitized) {
            writeOssInlineCache([objectKey, remoteUrl], {
              ...sanitized,
              cachedAt: Date.now(),
              byteSize: sanitized.data.length,
            });
            return sanitized;
          }
        }
      } catch (r2Err) {
        console.warn("Cloudflare R2 fallback get(objectKey) failed:", r2Err);
      }
      return null;
    };

    const tryFetchFromOss = async (): Promise<{ data: string; mimeType: string } | null> => {
      try {
        const creds = resolveOssCredentials(ossConfig);
        if (!creds) return null;
        const client = createAliyunOssClient(creds);
        const getRes = await client.get(objectKey);
        if (getRes?.content && Buffer.isBuffer(getRes.content)) {
          const b64 = getRes.content.toString("base64");
          const sanitized = sanitizeInlineImage(
            b64,
            ref.mimeType || "image/jpeg"
          );
          if (sanitized) {
            writeOssInlineCache([objectKey, remoteUrl], {
              ...sanitized,
              cachedAt: Date.now(),
              byteSize: sanitized.data.length,
            });
            return sanitized;
          }
        }
      } catch (sdkErr) {
        console.warn("OSS SDK fallback get(objectKey) failed:", sdkErr);
      }
      return null;
    };

    if (tryR2First) {
      const r2Out = await tryFetchFromR2();
      if (r2Out) return r2Out;
      const ossOut = await tryFetchFromOss();
      if (ossOut) return ossOut;
    } else {
      const ossOut = await tryFetchFromOss();
      if (ossOut) return ossOut;
      const r2Out = await tryFetchFromR2();
      if (r2Out) return r2Out;
    }
  }

  return null;
}

export type ApiProtocolMode = "auto" | "gemini-native" | "openai-compatible";

interface NormalizedEndpointInfo {
  rawUrl: string;
  cleanRoot: string;
  geminiBaseUrl?: string;
  openAiChatUrl: string;
  openAiImageUrl: string;
  explicitOpenAiSuffix: boolean;
  explicitGeminiSuffix: boolean;
}

/**
 * Broadly normalizes any user-supplied endpoint URL:
 * Supports empty (official), bare host, trailing slashes, /v1, /v1beta,
 * /v1/chat/completions, /v1/images/generations, /v1beta/models/...
 */
function normalizeUniversalEndpoint(rawBaseUrl?: string): NormalizedEndpointInfo {
  const trimmed = (rawBaseUrl || "").trim();
  const isPlaceholderUrl =
    !trimmed ||
    /api\.openai-proxy\.org/i.test(trimmed) ||
    /your-proxy\.com/i.test(trimmed) ||
    /your-gateway\.com/i.test(trimmed);

  if (isPlaceholderUrl) {
    return {
      rawUrl: "",
      cleanRoot: "",
      geminiBaseUrl: undefined,
      openAiChatUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      openAiImageUrl: "https://generativelanguage.googleapis.com/v1beta/openai/images/generations",
      explicitOpenAiSuffix: false,
      explicitGeminiSuffix: false,
    };
  }

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol}`;
  }

  const explicitOpenAiSuffix =
    /\/(v1\/)?(chat\/completions|images\/generations)\/?$/i.test(withProtocol) ||
    /\/v1\/?$/i.test(withProtocol);
  const explicitGeminiSuffix = /\/v1beta(\/models.*)?\/?$/i.test(withProtocol);

  const root = withProtocol
    .replace(/\/+$/, "")
    .replace(/\/v1\/chat\/completions$/i, "")
    .replace(/\/v1\/images\/generations$/i, "")
    .replace(/\/v1\/models.*$/i, "")
    .replace(/\/v1beta\/models.*$/i, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/images\/generations$/i, "")
    .replace(/\/v1beta$/i, "")
    .replace(/\/v1$/i, "")
    .replace(/\/+$/, "");

  const openAiChatUrl = /\/chat\/completions\/?$/i.test(withProtocol)
    ? withProtocol.replace(/\/+$/, "")
    : `${root}/v1/chat/completions`;

  const openAiImageUrl = /\/images\/generations\/?$/i.test(withProtocol)
    ? withProtocol.replace(/\/+$/, "")
    : `${root}/v1/images/generations`;

  return {
    rawUrl: trimmed,
    cleanRoot: root,
    geminiBaseUrl: root,
    openAiChatUrl,
    openAiImageUrl,
    explicitOpenAiSuffix,
    explicitGeminiSuffix,
  };
}

function parseCustomHeaders(raw?: string): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();
  const result: Record<string, string> = {};
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (k && v !== undefined && v !== null) {
            result[k.trim()] = String(v).trim();
          }
        }
        return result;
      }
    } catch {
      // Fall through to line-by-line Header: Value parsing
    }
  }
  for (const line of trimmed.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && val) result[key] = val;
    }
  }
  return result;
}

function createGeminiClient(
  customBaseUrl?: string,
  customApiKey?: string,
  customHeaders?: string
): GoogleGenAI {
  const endpoint = normalizeUniversalEndpoint(customBaseUrl);
  const extraHeaders = parseCustomHeaders(customHeaders);
  const effectiveKey =
    (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || "";

  const httpOptions: {
    headers: Record<string, string>;
    baseUrl?: string;
  } = {
    headers: {
      "User-Agent": "aistudio-build",
      ...extraHeaders,
    },
  };

  if (endpoint.geminiBaseUrl) {
    httpOptions.baseUrl = endpoint.geminiBaseUrl;
  }

  return new GoogleGenAI({
    apiKey: effectiveKey,
    httpOptions,
  });
}

function isLikelyGeminiModel(modelId: string): boolean {
  const m = (modelId || "").trim().toLowerCase();
  return (
    m.startsWith("gemini") ||
    m.startsWith("models/gemini") ||
    m.startsWith("imagen") ||
    m.startsWith("veo") ||
    m.startsWith("learnlm")
  );
}

function supportsHighThinking(modelId: string): boolean {
  const m = (modelId || "").trim().toLowerCase();
  return (
    m.includes("gemini-4-argon") ||
    m.includes("gemini-3") ||
    m.includes("gemini-2.5") ||
    m.includes("thinking")
  );
}

/**
 * Sanitizes base64 image data & mimeType (strips data URL prefixes if present, falls back to previewUrl)
 */
function sanitizeInlineImage(
  rawBase64?: string,
  rawMimeType?: string,
  previewUrl?: string
): { data: string; mimeType: string } | null {
  let source = (rawBase64 || "").trim();
  let detectedMime = (rawMimeType || "").trim().toLowerCase();

  if (!source && previewUrl && previewUrl.startsWith("data:image/")) {
    source = previewUrl.trim();
  }
  if (!source) return null;

  const dataUrlMatch = source.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    detectedMime = dataUrlMatch[1].trim().toLowerCase();
    source = dataUrlMatch[2].trim();
  }

  // Strip any accidental whitespace or newlines inside base64 payload
  const cleanData = source.replace(/\s+/g, "");
  if (!cleanData) return null;

  const allowedMimes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  if (detectedMime === "image/jpg") detectedMime = "image/jpeg";
  if (!allowedMimes.has(detectedMime)) {
    detectedMime = "image/jpeg";
  }

  return { data: cleanData, mimeType: detectedMime };
}

/**
 * Calls an OpenAI-compatible /v1/chat/completions endpoint with multimodal parts & optional JSON mode.
 */
async function callOpenAiCompatibleChat(options: {
  endpoint: NormalizedEndpointInfo;
  model: string;
  parts: any[];
  systemInstruction?: string;
  expectJson?: boolean;
  jsonHint?: string;
  customApiKey?: string;
  customHeaders?: string;
}): Promise<string> {
  const {
    endpoint,
    model,
    parts,
    systemInstruction,
    expectJson,
    jsonHint,
    customApiKey,
    customHeaders,
  } = options;
  const apiKey =
    (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || "";
  const extraHeaders = parseCustomHeaders(customHeaders);

  const contentItems: any[] = [];
  for (const part of parts) {
    if (part.text) {
      contentItems.push({
        type: "text",
        text: part.text,
      });
    } else if (part.inlineData?.data && part.inlineData?.mimeType) {
      contentItems.push({
        type: "image_url",
        image_url: {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        },
      });
    }
  }

  const messages: any[] = [];
  if (systemInstruction || jsonHint) {
    messages.push({
      role: "system",
      content: [systemInstruction, jsonHint].filter(Boolean).join("\n\n"),
    });
  }
  messages.push({
    role: "user",
    content:
      contentItems.length === 1 && contentItems[0].type === "text"
        ? contentItems[0].text
        : contentItems,
  });

  const bodyPayload: Record<string, any> = {
    model,
    messages,
  };
  if (expectJson) {
    bodyPayload.response_format = { type: "json_object" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "aistudio-build",
    ...extraHeaders,
  };
  if (apiKey) {
    if (!headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    if (!headers["x-goog-api-key"]) {
      headers["x-goog-api-key"] = apiKey;
    }
  }

  let res = await fetch(endpoint.openAiChatUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
  });

  // If the target model doesn't support response_format: json_object, retry without it
  if (!res.ok && expectJson && res.status === 400) {
    delete bodyPayload.response_format;
    res = await fetch(endpoint.openAiChatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });
  }

  const rawText = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `OpenAI 兼容端点 (${endpoint.openAiChatUrl}) 返回非 JSON 响应 (${res.status}): ${rawText.slice(0, 140)}`
    );
  }

  if (!res.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error ||
        `OpenAI 兼容端点请求失败 (${res.status})`
    );
  }

  const messageContent = data?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((c: any) => c?.text || "")
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * Universal Multimodal Text/JSON Generator:
 * Supports Gemini Native SDK (`gemini-native`), OpenAI-compatible (`/v1/chat/completions`),
 * and `auto` mode with intelligent protocol selection and automatic fallback.
 */
async function executeUniversalAgentCall(options: {
  model: string;
  parts: any[];
  config?: any;
  enableHighThinking?: boolean;
  customBaseUrl?: string;
  customApiKey?: string;
  customHeaders?: string;
  protocol?: ApiProtocolMode;
  jsonHint?: string;
}): Promise<{ text: string; protocolUsed: string; normalizedEndpoint: string }> {
  const {
    model,
    parts,
    config = {},
    enableHighThinking = false,
    customBaseUrl,
    customApiKey,
    customHeaders,
    protocol = "auto",
    jsonHint,
  } = options;

  const endpoint = normalizeUniversalEndpoint(customBaseUrl);
  const expectJson = config.responseMimeType === "application/json";

  const runGeminiNative = async () => {
    const ai = createGeminiClient(customBaseUrl, customApiKey, customHeaders);
    const nativeConfig: any = { ...config };
    if (
      (model === "gemini-4-argon" || enableHighThinking) &&
      supportsHighThinking(model)
    ) {
      nativeConfig.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: nativeConfig,
      });
      return {
        text: response.text || "",
        protocolUsed: "gemini-native",
        normalizedEndpoint:
          endpoint.cleanRoot || "https://generativelanguage.googleapis.com",
      };
    } catch (err: any) {
      // If a custom Gemini model rejects thinkingConfig, retry without thinkingConfig
      if (nativeConfig.thinkingConfig) {
        delete nativeConfig.thinkingConfig;
        const retryRes = await ai.models.generateContent({
          model,
          contents: { parts },
          config: nativeConfig,
        });
        return {
          text: retryRes.text || "",
          protocolUsed: "gemini-native",
          normalizedEndpoint:
            endpoint.cleanRoot || "https://generativelanguage.googleapis.com",
        };
      }
      throw err;
    }
  };

  const runOpenAiCompatible = async () => {
    const text = await callOpenAiCompatibleChat({
      endpoint,
      model,
      parts,
      systemInstruction: config.systemInstruction,
      expectJson,
      jsonHint,
      customApiKey,
      customHeaders,
    });
    return {
      text,
      protocolUsed: "openai-compatible",
      normalizedEndpoint: endpoint.openAiChatUrl,
    };
  };

  const runGeminiWithFallback = async () => {
    try {
      return await runGeminiNative();
    } catch (primaryErr) {
      // Fallback to built-in reliable agent models if a custom or preview model ID is unavailable
      const fallbackModels = ["gemini-4-argon", "gemini-3.8-flash"].filter(
        (m) => m !== model
      );
      for (const fbModel of fallbackModels) {
        try {
          const ai = createGeminiClient(
            customBaseUrl,
            customApiKey,
            customHeaders
          );
          const response = await ai.models.generateContent({
            model: fbModel,
            contents: { parts },
            config,
          });
          return {
            text: response.text || "",
            protocolUsed: `gemini-native (fallback:${fbModel})`,
            normalizedEndpoint:
              endpoint.cleanRoot || "https://generativelanguage.googleapis.com",
          };
        } catch {
          // try next fallback
        }
      }
      throw primaryErr;
    }
  };

  if (protocol === "gemini-native") {
    return runGeminiWithFallback();
  }
  if (protocol === "openai-compatible") {
    try {
      return await runOpenAiCompatible();
    } catch (openAiErr) {
      if (!endpoint.rawUrl) {
        return await runGeminiWithFallback();
      }
      throw openAiErr;
    }
  }

  // 'auto' mode:
  const preferOpenAiFirst =
    !isLikelyGeminiModel(model) ||
    (Boolean(endpoint.rawUrl) &&
      endpoint.explicitOpenAiSuffix &&
      !endpoint.explicitGeminiSuffix);

  if (preferOpenAiFirst) {
    try {
      return await runOpenAiCompatible();
    } catch (openAiErr) {
      if (isLikelyGeminiModel(model) || !endpoint.rawUrl) {
        return await runGeminiWithFallback();
      }
      throw openAiErr;
    }
  }

  // Otherwise try Gemini Native first; if custom gateway is an OpenAI-only relay, fallback to OpenAI compatible
  try {
    return await runGeminiWithFallback();
  } catch (geminiErr) {
    if (endpoint.rawUrl) {
      try {
        return await runOpenAiCompatible();
      } catch {
        throw geminiErr;
      }
    }
    throw geminiErr;
  }
}

function safeParseJson(raw: string): any {
  const trimmed = (raw || "").trim();
  if (!trimmed) return {};
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try extracting the outermost JSON object if wrapped in commentary
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("模型返回的内容不是有效的 JSON 格式");
  }
}

const CASE_DIM_LABELS: Record<string, string> = {
  pose:
    "主体姿态（仅提取朝向、摆放及组合关系，不继承竞品身份和外形）",
  style:
    "环境背景（仅提取场景类型、材质与造型语言，具体布景重新设计）",
  structure:
    "版式骨架（仅提取信息分区、主次、图文占比和留白规律，不复制元素坐标及完整构图）",
  content:
    "文案版式（仅提取字体性格、字号层级、对齐和间距，不提取文字内容）",
  copy_text:
    "文案内容（仅提取卖点主题和表达结构，依据自有资料重写，用户文案优先，不移植竞品参数与承诺）",
  lighting:
    "光影色调（仅提取光向、软硬、反差及色彩关系，不继承场景物件）",
};

const ALL_CASE_DIM_KEYS = [
  "pose",
  "style",
  "structure",
  "content",
  "copy_text",
  "lighting",
] as const;

const CASE_DIM_POSITIVE_RULES: Record<string, string> = {
  pose:
    "【主体姿态（仅提取朝向、摆放及组合关系）】：提取此案例中主体的空间朝向、摆放角度及主副件组合关系；⛔绝不继承竞品的品牌身份、工业外形或表面图案，产品身份与外观100%以我方自有 #Prod 产品图为准",
  style:
    "【环境背景（提取场景类型、材质与造型语言 · 具体布景重新设计）】：提取此案例的场景类型、台面材质肌理与几何造型语言；结合我方自有产品重新设计具体背景布景，⛔不百分百沿用竞品的具体场景道具（如原图特定罗马柱、手机屏幕、礼盒公仔、窗帘等）或原图坐标",
  lighting:
    "【光影色调（提取光向、软硬、反差及色彩关系）】：提取此案例的主辅光方向、光质软硬、明暗反差及主辅色彩关系以保持整页风格统一；⛔不继承此案例中的任何具体场景物件",
  structure:
    "【版式骨架（提取信息分区、主次、图文占比和留白规律）】：提取此案例的信息分区逻辑、视觉主次层级、图文面积占比与四周呼吸留白规律（≥8%）；结合我方产品重新编排各屏版面，⛔不1:1复制竞品元素像素坐标或照搬完整构图",
  content:
    "【文案版式（提取字体性格、字号层级、对齐和间距）】：提取此案例的字体性格气质、主副标题字号层级对比、对齐方式与行距间距规律；⛔绝不提取或照抄案例原图中的竞品文字内容",
  copy_text:
    "【文案内容（提取卖点主题和表达结构 · 依据自有资料重写）】：提取此案例的卖点切入主题与文案表达结构（如痛点直击+核心利益+分组数据印证）；必须100%依据我方自有产品资料重写，用户指定文案优先，⛔绝对禁止移植竞品的参数数值、品牌名或服务承诺",
};

const CASE_DIM_UNSELECTED_RULES: Record<string, string> = {
  pose:
    "⚪【未选中·主体姿态（不从该案例提取）】：不从该案例提取主体朝向与摆放组合关系（未选中仅表示不提取该维度，不代表锁定不变；主体姿态完全依据自有 #Prod 实拍图与本屏策划设计）",
  style:
    "⚪【未选中·环境背景（不从该案例提取）】：不从该案例提取场景类型、材质与造型语言（背景布景完全围绕自有产品 #Prod 独立策划设计）",
  lighting:
    "⚪【未选中·光影色调（不从该案例提取）】：不从该案例提取光向、反差与色彩关系（采用契合自有产品的统一商业摄影布光与色调）",
  structure:
    "⚪【未选中·版式骨架（不从该案例提取）】：不从该案例提取信息分区与图文占比规律（版面结构完全围绕本屏核心卖点独立编排）",
  content:
    "⚪【未选中·文案版式（不从该案例提取）】：不从该案例提取字体性格、字号层级与对齐间距（采用清晰现代的商业无衬线排版体系）",
  copy_text:
    "⚪【未选中·文案内容（不从该案例提取）】：不从该案例提取卖点主题与表达结构（文案内容完全依据我方自有产品资料与用户指定文案撰写）",
};

function normalizeCaseDimensions(rawDims?: string[]): string[] {
  const valid = Array.isArray(rawDims)
    ? rawDims.filter((d) => ALL_CASE_DIM_KEYS.includes(d as any))
    : [];
  return valid.length > 0 ? valid : ["style", "structure", "content", "lighting"];
}

function isPromotedMasterCase(ref?: {
  id?: string;
  code?: string;
  name?: string;
  tag?: string;
  caseDimensions?: string[];
  caseCustomRule?: string;
  isLockBaseSwap?: boolean;
}): boolean {
  if (!ref) return false;
  const idStr = (ref.id || "").toLowerCase();
  const labelStr = `${ref.tag || ""} ${ref.name || ""}`;
  return (
    idStr.includes("case-master") ||
    /首卡定标母版|首卡母版|定标母版/.test(labelStr)
  );
}

function isExplicitLockBaseCase(ref?: {
  id?: string;
  code?: string;
  name?: string;
  tag?: string;
  isLockBaseSwap?: boolean;
}): boolean {
  if (!ref) return false;
  return Boolean(ref.isLockBaseSwap) || isPromotedMasterCase(ref);
}

function filterExtractedDnaByDimensions(
  dna: string | undefined,
  rawDims?: string[],
  isLockBaseSwap = false
): string {
  const raw = (dna || "").trim();
  if (!raw) return "";
  if (isLockBaseSwap) return raw;

  const dims = normalizeCaseDimensions(rawDims);
  const hasPose = dims.includes("pose");
  const hasStyle = dims.includes("style");
  const hasStructure = dims.includes("structure");
  const hasContent = dims.includes("content");
  const hasCopyText = dims.includes("copy_text");
  const hasLighting = dims.includes("lighting");

  const stripCompetitorProps = (text: string): string =>
    text
      .replace(/欧式罗马柱拱门|罗马柱拱门|迷你石柱/g, "现代几何立体展台结构")
      .replace(
        /[，、,]?\s*以横置手机屏幕作为天然矩形画框衬托前景主体/g,
        "，以极简几何背板衬托前景主体"
      )
      .replace(/搭配迷你石柱与礼盒道具|蓝黄礼盒|礼盒道具/g, "搭配同色系极简几何体块")
      .replace(/米奇公仔|米奇老鼠头|米奇角标|维尼熊/g, "极简几何装饰")
      .replace(/（含模特佩戴耳部特写）/g, "（含产品特写）");

  const taggedBlocks = raw.match(/【[^】]+】[^【]*/g);
  if (taggedBlocks && taggedBlocks.length > 0) {
    const keptBlocks: string[] = [];
    for (const block of taggedBlocks) {
      const m = block.match(/^【([^】]+)】([\s\S]*)$/);
      if (!m) continue;
      const header = m[1].trim();
      const body = stripCompetitorProps(m[2].trim());

      if (/模块定位|卖点主题|表达结构|文案内容/.test(header)) {
        if (hasCopyText) {
          keptBlocks.push(`【模块定位与卖点表达结构】${body}`);
        }
        continue;
      }

      if (/几何分区|信息分区|留白规律|版式骨架|画面构图/.test(header)) {
        if (hasStructure) {
          keptBlocks.push(`【信息分区与留白规律】${body}`);
        }
        continue;
      }

      if (/UI容器|辅助图形|字体|文字排版|文案版式|排版层级|字号|对齐/.test(header)) {
        if (hasContent) {
          keptBlocks.push(`【字体性格与排版层级】${body}`);
        }
        continue;
      }

      if (/环境光影与展台|场景材质语言与光影色彩关系|场景.*光影|光影.*场景/.test(header)) {
        if (hasStyle && hasLighting) {
          keptBlocks.push(`【场景材质语言与光影色彩关系】${body}`);
        } else if (hasStyle && !hasLighting) {
          keptBlocks.push(`【场景类型与材质语言】${body}`);
        } else if (!hasStyle && hasLighting) {
          keptBlocks.push(`【光影反差与色彩关系】${body}`);
        }
        continue;
      }

      if (/场景|材质|环境背景|展台|视觉质感|美学风格|画面元素|装饰机制/.test(header)) {
        if (hasStyle) {
          keptBlocks.push(`【场景类型与材质语言】${body}`);
        }
        continue;
      }

      if (/光影|布光|色彩|色调/.test(header)) {
        if (hasLighting) {
          keptBlocks.push(`【光影反差与色彩关系】${body}`);
        }
        continue;
      }

      if (/主体姿态|组合关系|姿态/.test(header)) {
        if (hasPose) {
          keptBlocks.push(`【主体姿态与组合关系】${body}`);
        }
        continue;
      }

      if (hasStyle || hasStructure) {
        keptBlocks.push(`【${header}】${body}`);
      }
    }

    return keptBlocks
      .join("；")
      .replace(/[；;]{2,}/g, "；")
      .replace(/[；;。\s]+$/, "")
      .trim();
  }

  return stripCompetitorProps(raw).replace(/[；;]{2,}/g, "；").trim();
}

function synthesizeUnifiedVisualSpecServer(
  caseRefs: Array<{
    id?: string;
    code?: string;
    name?: string;
    tag?: string;
    caseDimensions?: string[];
    caseCustomRule?: string;
    extractedLayoutDna?: string;
  }>,
  globalStylePrefix = ""
): string {
  const prefix = (globalStylePrefix || "").trim();
  if (!caseRefs || caseRefs.length === 0) {
    return (
      prefix ||
      "整页统一视觉规范：【场景与材质语言】现代高质感商业摄影棚拍，极简几何展台与细腻材质肌理；【光影与色彩关系】柔和立体主光配轮廓高光，明暗反差适中，全页色温与主辅色调高度统一；【排版与字体规范】现代无衬线商业字体，主副标题字号层级分明、对齐规整，全页保持至少8%呼吸留白；【产品身份铁律】产品外观、结构与图案100%以自有 #Prod 产品图为准。"
    );
  }

  const findPrimaryByDim = (dim: string) =>
    caseRefs.find((c) => normalizeCaseDimensions(c.caseDimensions).includes(dim));

  const styleRef = findPrimaryByDim("style");
  const lightingRef = findPrimaryByDim("lighting");
  const contentRef = findPrimaryByDim("content");
  const structureRef = findPrimaryByDim("structure");

  const codeOf = (c: any) =>
    c?.code ? `#${String(c.code).replace(/^#/, "")}` : "#Case-1";

  const dnaOf = (c: any, dim: string) => {
    if (!c) return "";
    const f = filterExtractedDnaByDimensions(c.extractedLayoutDna, [dim], false);
    return f ? f.replace(/【[^】]+】/g, "").slice(0, 90) : c.tag || "";
  };

  const parts: string[] = [];
  if (styleRef) {
    parts.push(
      `【环境背景规范（主来源：${codeOf(styleRef)}）】提取场景类型、材质肌理与几何造型语言${dnaOf(styleRef, "style") ? `（${dnaOf(styleRef, "style")}）` : ""}，各屏结合自有产品重新设计具体布景，不照搬竞品具体道具`
    );
  } else {
    parts.push(
      "【环境背景规范（未从案例提取）】围绕自有产品全新设计高级商业摄影棚背景与现代几何展台"
    );
  }

  if (lightingRef) {
    parts.push(
      `【光影色调规范（主来源：${codeOf(lightingRef)}）】提取光向、光质软硬、明暗反差及色彩关系${dnaOf(lightingRef, "lighting") ? `（${dnaOf(lightingRef, "lighting")}）` : ""}，保持整页冷暖色温与主辅色调高度统一，不继承竞品场景物件`
    );
  } else {
    parts.push(
      "【光影色调规范（未从案例提取）】采用柔和立体的商业摄影棚布光与统一高级色彩关系"
    );
  }

  if (contentRef) {
    parts.push(
      `【文案版式规范（主来源：${codeOf(contentRef)}）】提取字体性格、字号主次层级、对齐方式与行距间距规律，不提取竞品文字内容`
    );
  } else {
    parts.push(
      "【文案版式规范（未从案例提取）】采用现代无衬线商业字体层级与规整对齐间距"
    );
  }

  if (structureRef) {
    parts.push(
      `【版式骨架节奏（主来源：${codeOf(structureRef)}）】提取信息分区、主次层级、图文占比与留白规律（四周≥8%安全留白），重新设计各屏排版，不复制元素坐标或完整构图`
    );
  }

  parts.push(
    "【权威源铁律】产品身份与外形100%以自有 #Prod 产品图为准；文案与参数100%以自有产品资料与用户指定文案为准"
  );

  if (prefix) {
    parts.push(`【全局画风要求】${prefix}`);
  }

  const customRules = caseRefs
    .map((c, idx) => {
      const rule = (c.caseCustomRule || "").trim();
      if (!rule) return "";
      const code = c.code ? `#${String(c.code).replace(/^#/, "")}` : `#Case-${idx + 1}`;
      return `【${code} 独立约束】：${rule}`;
    })
    .filter(Boolean);
  if (customRules.length > 0) {
    parts.push(`【独立补充约束】${customRules.join("；")}`);
  }

  return parts.join("；");
}

/**
 * Builds a strict per-#Case instruction that controls ONLY the Analysis Stage extraction scope
 * (unless explicit `isLockBaseSwap` or `isPromotedMasterCase` is active).
 * Independent `+约束` (`caseCustomRule`) is emitted as a standalone rule.
 */
function buildSingleCaseDimensionInstruction(
  ref: {
    id?: string;
    code?: string;
    name?: string;
    tag?: string;
    caseDimensions?: string[];
    caseCustomRule?: string;
    isLockBaseSwap?: boolean;
    isSharedStyleRef?: boolean;
    extractedLayoutDna?: string;
    isLongPageSlice?: boolean;
    sliceIndex?: number;
    sliceTotal?: number;
  },
  forImageGeneration = false,
  studioContext: "detail" | "sku" = "detail"
): string {
  const codeLabel = ref.code ? `#${ref.code.replace(/^#/, "")}` : "#Case";
  const customRuleStr = (ref.caseCustomRule || "").trim();
  const customRuleLine = customRuleStr
    ? `   📌【独立补充约束规则（"+约束" · 最高优先级独立生效）】：${customRuleStr}`
    : "";

  // 1. If this image is passed as the Shared Style Reference Image in Detail Studio ('shared_style' mode)
  if (forImageGeneration && ref.isSharedStyleRef && !isExplicitLockBaseCase(ref)) {
    return [
      `【🎨各屏共用风格参考图 ${codeLabel} | 标识: "${ref.tag || ref.name || codeLabel}" | 仅参考风格、色调与质感】`,
      `   ✅ 仅允许参考此图的【整体视觉风格气质、冷暖色调关系、主辅色彩搭配与材质光影质感】，以确保整页各屏视觉风格高度统一！`,
      `   ⛔ 绝对禁止照搬或复刻此图中的【具体背景场景物件、展台元素坐标、完整版面构图、竞品产品外形或任何图内文字】！本屏的具体布景、版式分区与文案必须100%执行下方【本屏任务卡指令】与【整页统一视觉规范】，产品身份100%以自有 #Prod 产品图为准！`,
      customRuleLine,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // 2. If explicit Lock-Base Swap (`isLockBaseSwap` or promoted Master Case) is enabled
  if (isExplicitLockBaseCase(ref)) {
    return [
      `【🔒显式锁底换款基准图 ${codeLabel} | 标识: "${ref.tag || ref.name || codeLabel}" | 100% 锁底换款模式】`,
      `   ✅ 1. 背景环境与光影色调 100% 锁定：必须 100% 原样保持 ${codeLabel} 的背景场景、色彩渐变、环境光影与展台底座几何结构（严禁擅自改变背景冷暖色相或添加原图不存在的多余道具）！`,
      `   ✅ 2. 版式坐标与文案容器 100% 锁定：保持与 ${codeLabel} 完全一致的画面分区坐标、卖点胶囊/徽章形状与底色及字体层级！`,
      `   🔄 3. 定点替换产品主体（产品身份唯一权威源 #Prod）：仅将 ${codeLabel} 中的竞品主体 100% 定点替换为上方我方自有 #Prod 产品图中的商品本体（严格还原 #Prod 外观造型、结构比例与表面定制图案，忽略 #Prod 原图背景边框），并将品牌/款式文案更新为我方指定内容！`,
      customRuleLine,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // 3. Standard Six-Dimension Analysis Extraction Scope Rules
  const selected = normalizeCaseDimensions(ref.caseDimensions);
  const unselected = ALL_CASE_DIM_KEYS.filter((k) => !selected.includes(k));

  const selectedNames = selected
    .map((d) => CASE_DIM_LABELS[d] || d)
    .join(" + ");
  const positiveLines = selected
    .map((d) => `   ✅ 允许提取维度·${CASE_DIM_POSITIVE_RULES[d] || d}`)
    .join("\n");
  const unselectedLines =
    unselected.length > 0
      ? unselected
          .map((d) => `   ${CASE_DIM_UNSELECTED_RULES[d]}`)
          .join("\n")
      : `   ℹ️【已选中全部六个维度说明】：当前允许从 ${codeLabel} 提取全部六个维度的抽象规律用于重新策划；⚠️全部选中绝不等于照搬整图（未开启锁底换款），必须结合自有产品 #Prod 重新设计具体布景与排版，严禁100%复制竞品具体场景道具、元素坐标或竞品参数文字！`;

  const layoutDnaStr = filterExtractedDnaByDimensions(
    ref.extractedLayoutDna,
    ref.caseDimensions,
    false
  );
  const layoutDnaLine = layoutDnaStr
    ? `   🧬【按选中标签过滤后的单屏分析提取结果】：${layoutDnaStr}`
    : "";

  const studioNote =
    studioContext === "detail"
      ? `   🛡️【详情页重策划准则】：产品身份100%以自有 #Prod 产品图为准，文案与参数100%以自有产品资料为准；仅将上述提取维度纳入统一视觉规范与本屏任务卡重策划，不百分百沿用竞品具体场景、元素坐标或完整构图。`
      : `   🛡️【SKU六维分析提取准则】：产品身份100%以自有 #Prod 产品图为准，SKU标题、卖点与参数100%以我方配置为准；仅提取选中维度的抽象规律，未选中维度不从该案例提取（不代表锁定不变）。`;

  return [
    `【参考案例图 ${codeLabel} | 标识: "${ref.tag || ref.name || codeLabel}" | 分析阶段允许提取维度: ${selectedNames}】`,
    positiveLines,
    unselectedLines,
    studioNote,
    layoutDnaLine,
    customRuleLine,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Builds an explicit cross-#Case analysis extraction & priority binding matrix when 1 or more #Case images are provided.
 * Binds sources and explicit priority per dimension to avoid whole-image mixing.
 */
function buildMultiCaseSynthesisDirective(
  caseRefs: Array<{
    id?: string;
    code?: string;
    name?: string;
    tag?: string;
    caseDimensions?: string[];
    caseCustomRule?: string;
    isLockBaseSwap?: boolean;
    extractedLayoutDna?: string;
  }>,
  unifiedLayoutRule?: string,
  studioContext: "detail" | "sku" = "detail"
): string {
  const trimmedRule = (unifiedLayoutRule || "").trim();
  if (!caseRefs || caseRefs.length === 0) {
    return (
      trimmedRule ||
      "电商标准高质感商业摄影背景，整页/全套保持统一光影色调、统一版式节奏与充足呼吸留白（四周≥8%），产品身份与外观100%以自有 #Prod 实拍图为准，文案与参数100%以自有产品资料为准"
    );
  }

  const lockBaseCase = caseRefs.find((c) => isExplicitLockBaseCase(c));
  const lockCode = lockBaseCase
    ? lockBaseCase.code
      ? `#${lockBaseCase.code.replace(/^#/, "")}`
      : "#Case-1"
    : "";

  if (lockBaseCase) {
    const customRules = caseRefs
      .map((c, idx) =>
        c.caseCustomRule?.trim()
          ? `   - 针对 #${(c.code || `Case-${idx + 1}`).replace(/^#/, "")}：${c.caseCustomRule.trim()}`
          : ""
      )
      .filter(Boolean);
    return [
      `【🔒显式锁底换款模式 (${lockCode}) · 最高优先级铁律】：`,
      `   当前已显式开启「锁底换款」！必须以 ${lockCode}(${lockBaseCase.tag || lockBaseCase.name || lockCode}) 为 100% 锁底画布：除将产品主体 100% 替换为自有 #Prod 实拍图（及按我方要求更新款式标题/文案）外，背景环境、展台几何结构、光影色调、版式坐标与UI容器全部 100% 锁定不变！`,
      customRules.length > 0
        ? `【📌独立补充约束规则（"+约束"）】：\n${customRules.join("\n")}`
        : "",
      trimmedRule ? `【📌全局补充规范】：${trimmedRule}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const normalizedCases = caseRefs.map((c, idx) => ({
    code: c.code ? `#${c.code.replace(/^#/, "")}` : `#Case-${idx + 1}`,
    tag: c.tag || c.name || "",
    dims: normalizeCaseDimensions(c.caseDimensions),
    customRule: (c.caseCustomRule || "").trim(),
  }));

  const byDim = (dim: string) =>
    normalizedCases.filter((c) => c.dims.includes(dim));

  const formatPriorityChain = (providers: typeof normalizedCases) => {
    if (providers.length === 0) return "";
    const primary = `${providers[0].code}(${providers[0].tag})`;
    const secondaries = providers.slice(1).map((p) => p.code);
    return secondaries.length > 0
      ? `主来源锁定 ${primary}（次级参考：${secondaries.join(" > ")}，按维度显式优先级提取，严禁整图混合）`
      : `唯一提取来源 ${primary}`;
  };

  const poseProviders = byDim("pose");
  const styleProviders = byDim("style");
  const lightingProviders = byDim("lighting");
  const structureProviders = byDim("structure");
  const contentProviders = byDim("content");
  const copyTextProviders = byDim("copy_text");

  const lines: string[] = [
    `【核心准则 · 参考案例 (#Case) 六维分析提取与分维度显式优先级矩阵（选中=允许提取该维度抽象规律，未选中=不从该案例提取该维度，全部选中≠照搬整图）】：`,
  ];

  if (poseProviders.length > 0) {
    lines.push(
      `1. 🎯【主体姿态提取（${formatPriorityChain(poseProviders)}）】：仅提取主体朝向、摆放角度及主副件组合关系；⛔绝不继承竞品身份和外形，产品身份与外观细节100%以自有 #Prod 产品图为准。`
    );
  } else {
    lines.push(
      `1. 🎯【主体姿态（未从任何案例提取）】：不提取任何案例的主体姿态（不代表锁定不变），请根据自有 #Prod 产品图特征与本屏主题自由设计最契合的产品朝向、摆放与组合方式。`
    );
  }

  if (styleProviders.length > 0) {
    lines.push(
      `2. 🎨【环境背景提取（${formatPriorityChain(styleProviders)}）】：仅提取场景类型、台面材质肌理与几何造型语言；✨具体布景必须结合自有产品重新设计，不百分百沿用竞品的具体场景物件（如特定罗马柱、手机游戏画面、礼盒公仔、窗帘等）或元素坐标。`
    );
  } else {
    lines.push(
      `2. 🎨【环境背景（未从任何案例提取）】：不从案例提取环境背景，请围绕自有产品 #Prod 全新设计高级商业摄影背景与展台布景。`
    );
  }

  if (lightingProviders.length > 0) {
    lines.push(
      `3. 💡【光影色调提取（${formatPriorityChain(lightingProviders)}）】：仅提取主辅光方向、光质软硬、明暗反差及色彩关系，保持整页/全套风格与色调统一；⛔绝不继承案例中的具体场景物件。`
    );
  } else {
    lines.push(
      `3. 💡【光影色调（未从任何案例提取）】：采用契合自有产品的高级商业柔光与统一色彩体系。`
    );
  }

  if (structureProviders.length > 0) {
    lines.push(
      `4. 📐【版式骨架提取（${formatPriorityChain(structureProviders)}）】：仅提取信息分区、主次层级、图文占比和留白规律（画布四周≥8%安全留白）；✨重新设计各屏排版布局，不复制竞品元素像素坐标及完整构图。`
    );
  } else {
    lines.push(
      `4. 📐【版式骨架（未从任何案例提取）】：围绕本屏核心卖点与自有产品独立设计信息分区、图文占比与留白构图（四周≥8%安全留白）。`
    );
  }

  if (contentProviders.length > 0) {
    lines.push(
      `5. 🔤【文案版式提取（${formatPriorityChain(contentProviders)}）】：仅提取字体性格、字号层级、对齐方式和行距间距规律；⛔绝不提取案例中的文字内容。`
    );
  } else {
    lines.push(
      `5. 🔤【文案版式（未从任何案例提取）】：采用清晰现代的商业无衬线字体性格、字号主次层级与规整对齐间距。`
    );
  }

  if (copyTextProviders.length > 0) {
    lines.push(
      `6. 📝【文案内容提取（${formatPriorityChain(copyTextProviders)}）】：仅提取卖点主题和表达结构（如痛点/利益点/印证点的组织方式），必须100%依据我方自有产品资料重写，用户指定文案优先；⛔绝对禁止移植竞品的参数数值、品牌名或承诺。`
    );
  } else {
    lines.push(
      `6. 📝【文案内容（未从任何案例提取）】：完全依据我方自有产品资料与用户指定文案策划撰写所有标题与卖点文字，不移植任何竞品参数或文字。`
    );
  }

  const perCaseRules = normalizedCases.filter((c) => Boolean(c.customRule));
  if (perCaseRules.length > 0) {
    lines.push(
      `7. 📌【独立补充约束规则（"+约束" · 作为独立规则最高优先级处理）】：\n` +
        perCaseRules
          .map((c) => `   - 针对 ${c.code}(${c.tag})：${c.customRule}`)
          .join("\n")
    );
  }

  if (trimmedRule) {
    lines.push(
      `8. 📌【整页/全局统一视觉规范补充】：${trimmedRule}`
    );
  }

  return lines.join("\n");
}


/**
 * Resolves any reference identifier returned by the LLM (whether internal id,
 * code "Prod-1", "#Prod-1", "Case-1", "#Case-1", or filename)
 * back to the canonical ReferenceImageItem.id.
 */
function resolveCanonicalRefId(
  rawIdentifier: string,
  referenceImages: { id: string; code: string; name: string }[]
): string | null {
  if (!rawIdentifier) return null;
  const clean = String(rawIdentifier).trim();
  const cleanLower = clean.toLowerCase().replace(/^#/, "");

  for (const ref of referenceImages) {
    if (ref.id === clean || ref.id.toLowerCase() === cleanLower) {
      return ref.id;
    }
    if (ref.code.toLowerCase() === cleanLower) {
      return ref.id;
    }
    const compactCode = ref.code.toLowerCase().replace(/[^a-z0-9]/g, "");
    const compactClean = cleanLower.replace(/[^a-z0-9]/g, "");
    if (compactCode && compactCode === compactClean) {
      return ref.id;
    }
    if (ref.name && ref.name.toLowerCase() === cleanLower) {
      return ref.id;
    }
  }
  return null;
}

// Health & channel check endpoint (supports broad endpoint formats + multi-protocol auto fallback)
app.post("/api/channel/test", async (req, res) => {
  try {
    const {
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      agentModel,
    } = req.body as {
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      agentModel?: string;
    };
    const modelToTest = (agentModel || "gemini-3.8-flash").trim();
    const start = Date.now();

    const result = await executeUniversalAgentCall({
      model: modelToTest,
      parts: [{ text: "Respond with OK." }],
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
    });

    const latencyMs = Date.now() - start;
    res.json({
      ok: true,
      latencyMs,
      model: modelToTest,
      protocolUsed: result.protocolUsed,
      normalizedEndpoint: result.normalizedEndpoint,
      reply: (result.text || "OK").trim().slice(0, 60),
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error:
        err?.message || "接口连通性测试失败，请检查通道地址、协议模式或模型名称。",
    });
  }
});

// ==================== ALIYUN OSS & CLOUDFLARE R2 CLOUD ASSET STORAGE ENDPOINTS ====================

// 1. Check whether environment variables or client config provide OSS / Cloudflare R2 credentials
app.post("/api/oss/status", (req, res) => {
  const { ossConfig } = (req.body || {}) as { ossConfig?: ServerOssConfigInput };
  const provider = resolveActiveCloudProvider(ossConfig);
  const ossCreds = resolveOssCredentials(ossConfig);
  const r2Creds = resolveR2Credentials(ossConfig);

  const ossEnvConfigured = Boolean(
    process.env.ALIYUN_OSS_BUCKET &&
      process.env.ALIYUN_OSS_ACCESS_KEY_ID &&
      process.env.ALIYUN_OSS_ACCESS_KEY_SECRET
  );
  const r2EnvConfigured = Boolean(
    (process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
      process.env.CLOUDFLARE_R2_ENDPOINT) &&
      process.env.CLOUDFLARE_R2_BUCKET &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );

  if (provider === "cloudflare_r2") {
    res.json({
      provider: "cloudflare_r2",
      configured: Boolean(r2Creds),
      envConfigured: r2EnvConfigured,
      ossEnvConfigured,
      r2EnvConfigured,
      source: r2Creds?.source || null,
      region: r2Creds ? `R2 (${r2Creds.accountId})` : "auto",
      bucket: r2Creds?.bucket || process.env.CLOUDFLARE_R2_BUCKET || "",
      pathPrefix:
        r2Creds?.pathPrefix ||
        process.env.CLOUDFLARE_R2_PATH_PREFIX ||
        "ecom-studio-assets",
      r2AccountId:
        r2Creds?.accountId || process.env.CLOUDFLARE_R2_ACCOUNT_ID || "",
      r2Bucket: r2Creds?.bucket || process.env.CLOUDFLARE_R2_BUCKET || "",
      r2PathPrefix:
        r2Creds?.pathPrefix ||
        process.env.CLOUDFLARE_R2_PATH_PREFIX ||
        "ecom-studio-assets",
    });
    return;
  }

  res.json({
    provider: "aliyun_oss",
    configured: Boolean(ossCreds),
    envConfigured: ossEnvConfigured,
    ossEnvConfigured,
    r2EnvConfigured,
    source: ossCreds?.source || null,
    region:
      ossCreds?.region || process.env.ALIYUN_OSS_REGION || "oss-cn-hangzhou",
    bucket: ossCreds?.bucket || process.env.ALIYUN_OSS_BUCKET || "",
    pathPrefix:
      ossCreds?.pathPrefix ||
      process.env.ALIYUN_OSS_PATH_PREFIX ||
      "ecom-studio-assets",
    r2AccountId:
      r2Creds?.accountId || process.env.CLOUDFLARE_R2_ACCOUNT_ID || "",
    r2Bucket: r2Creds?.bucket || process.env.CLOUDFLARE_R2_BUCKET || "",
    r2PathPrefix:
      r2Creds?.pathPrefix ||
      process.env.CLOUDFLARE_R2_PATH_PREFIX ||
      "ecom-studio-assets",
  });
});

// 2. Test Alibaba Cloud OSS or Cloudflare R2 connectivity & write permission
app.post("/api/oss/test", async (req, res) => {
  try {
    const { ossConfig } = (req.body || {}) as {
      ossConfig?: ServerOssConfigInput;
    };
    const provider = resolveActiveCloudProvider(ossConfig);

    if (provider === "cloudflare_r2") {
      const r2Creds = resolveR2Credentials(ossConfig);
      if (!r2Creds) {
        res.status(400).json({
          ok: false,
          provider: "cloudflare_r2",
          error:
            "请先填写 Cloudflare R2 的 Account ID (或 S3 Endpoint)、Bucket 名称、Access Key ID 与 Secret Access Key。",
        });
        return;
      }

      const start = Date.now();
      const probeKey = `${r2Creds.pathPrefix}/test/connection_probe_${Date.now()}.txt`;
      const probeBuffer = Buffer.from(
        `E-Com Studio Batch Cloudflare R2 Connectivity Probe @ ${new Date().toISOString()}`,
        "utf-8"
      );

      const putResp = await r2SignedRequest({
        creds: r2Creds,
        method: "PUT",
        objectKey: probeKey,
        body: probeBuffer,
        contentType: "text/plain",
      });

      if (!putResp.ok) {
        const errBody = await putResp.text().catch(() => "");
        throw new Error(
          `Cloudflare R2 写入验证失败 (HTTP ${putResp.status}): ${errBody.slice(0, 200) || putResp.statusText}`
        );
      }

      const sampleUrl = buildR2PublicOrPresignedUrl(r2Creds, probeKey);

      // Clean up probe file asynchronously
      r2SignedRequest({
        creds: r2Creds,
        method: "DELETE",
        objectKey: probeKey,
      }).catch(() => {});

      res.json({
        ok: true,
        provider: "cloudflare_r2",
        latencyMs: Date.now() - start,
        bucket: r2Creds.bucket,
        region: `R2 (${r2Creds.accountId})`,
        source: r2Creds.source,
        sampleUrl,
        message: `Cloudflare R2 读写验证通过 (${r2Creds.bucket})`,
      });
      return;
    }

    const creds = resolveOssCredentials(ossConfig);
    if (!creds) {
      res.status(400).json({
        ok: false,
        provider: "aliyun_oss",
        error:
          "请先填写阿里云 OSS 的 Region、Bucket、AccessKeyId 与 AccessKeySecret（或在服务端环境变量中配置）。",
      });
      return;
    }

    const start = Date.now();
    const client = createAliyunOssClient(creds);
    const probeKey = `${creds.pathPrefix}/test/connection_probe_${Date.now()}.txt`;
    const probeBuffer = Buffer.from(
      `E-Com Studio Batch OSS Connectivity Probe @ ${new Date().toISOString()}`,
      "utf-8"
    );

    const putRes = await client.put(probeKey, probeBuffer, {
      mime: "text/plain",
    });
    const sampleUrl = buildPublicOrSignedOssUrl(
      client,
      creds,
      probeKey,
      putRes?.url
    );

    // Clean up probe file asynchronously (ignore delete error if RAM policy is write-only)
    client.delete(probeKey).catch(() => {});

    res.json({
      ok: true,
      provider: "aliyun_oss",
      latencyMs: Date.now() - start,
      bucket: creds.bucket,
      region: creds.region,
      source: creds.source,
      sampleUrl,
      message: `阿里云 OSS 读写验证通过 (${creds.bucket} @ ${creds.region})`,
    });
  } catch (err: any) {
    console.error("Error in /api/oss/test:", err);
    res.status(500).json({
      ok: false,
      error:
        err?.message ||
        "云存储连接失败，请检查 Bucket 名称、节点地址及密钥权限。",
    });
  }
});

// 3. Upload single or batch images (Base64 / DataURL / Remote URL) to active Cloud Storage (Aliyun OSS or Cloudflare R2) and return ossUrl
app.post("/api/oss/upload", async (req, res) => {
  try {
    const {
      items = [],
      folder = "refs",
      ossConfig,
    } = (req.body || {}) as {
      items: {
        id: string;
        name?: string;
        mimeType?: string;
        base64Data?: string;
        dataUrl?: string;
      }[];
      folder?: "refs" | "results";
      ossConfig?: ServerOssConfigInput;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "未提供需要上传至云存储的图片数据。" });
      return;
    }

    const provider = resolveActiveCloudProvider(ossConfig);
    const providerLabel =
      provider === "cloudflare_r2" ? "Cloudflare R2" : "阿里云 OSS";

    if (provider === "cloudflare_r2") {
      const r2Creds = resolveR2Credentials(ossConfig);
      if (!r2Creds) {
        res.status(400).json({
          ok: false,
          error:
            "尚未配置完整的 Cloudflare R2 凭据（请在云存储设置中填写 Account ID、Bucket、AccessKeyId 与 SecretAccessKey）。",
        });
        return;
      }
    } else {
      const ossCreds = resolveOssCredentials(ossConfig);
      if (!ossCreds) {
        res.status(400).json({
          ok: false,
          error:
            "尚未配置完整的阿里云 OSS 凭据（请在云存储设置中填写 Bucket、AccessKeyId 与 AccessKeySecret）。",
        });
        return;
      }
    }

    const uploaded: {
      id: string;
      ossUrl: string;
      objectKey: string;
      sizeBytes: number;
    }[] = [];
    const itemErrors: string[] = [];

    for (const item of items) {
      try {
        const sanitized = await resolveReferenceInlineImage(
          {
            base64Data: item.base64Data,
            mimeType: item.mimeType,
            previewUrl: item.dataUrl,
          },
          ossConfig
        );
        if (!sanitized) {
          itemErrors.push(`图片 [${item.name || item.id}] 缺少有效 Base64 数据`);
          continue;
        }
        const buffer = Buffer.from(sanitized.data, "base64");
        const result = await uploadBufferToCloudStorage({
          buffer,
          mimeType: sanitized.mimeType,
          folder: folder === "results" ? "results" : "refs",
          fileNameHint: item.name || item.id,
          ossConfig,
        });
        uploaded.push({
          id: item.id,
          ossUrl: result.ossUrl,
          objectKey: result.objectKey,
          sizeBytes: result.sizeBytes,
        });
      } catch (singleErr: any) {
        console.error(
          `Cloud storage (${providerLabel}) upload failed for item ${item.id}:`,
          singleErr
        );
        itemErrors.push(
          singleErr?.message || `图片 [${item.name || item.id}] 上传失败`
        );
      }
    }

    if (uploaded.length === 0) {
      res.status(400).json({
        ok: false,
        error:
          itemErrors[0] ||
          `未能成功上传任何图片至 ${providerLabel}，请检查 Bucket 权限或网络状态。`,
      });
      return;
    }

    res.json({
      ok: true,
      provider,
      uploaded,
      partialError: itemErrors.length > 0 ? itemErrors[0] : undefined,
      failed:
        itemErrors.length > 0
          ? itemErrors.map((error) => ({ error }))
          : undefined,
    });
  } catch (err: any) {
    console.error("Error in /api/oss/upload:", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "上传图片至云存储失败",
    });
  }
});

// Batch Auto-Tag 10~30+ Uploaded Product & Case Reference Images via Multimodal Vision
app.post("/api/agent/analyze-refs", async (req, res) => {
  try {
    const {
      referenceImages = [],
      agentModel = "gemini-4-argon",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      referenceImages: {
        id: string;
        code: string;
        category?: "product" | "case";
        name: string;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        ossObjectKey?: string;
        previewUrl?: string;
      }[];
      agentModel?: string;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!referenceImages.length) {
      res.status(400).json({ error: "请先上传产品图或参考案例图。" });
      return;
    }

    const parts: any[] = [
      {
        text: `你是一位资深电商视觉资产管理员。用户上传了 ${referenceImages.length} 张素材图（包含【产品图片 #Prod】和【参考案例图 #Case】）。请逐一观察每张图片：
- 如果是【产品图片(product)】：标注其拍摄视角、展现的商品部位、结构细节或壳面印花图案（如："充电仓45°正面·奶酪火箭鼠图案"、"开盖展示双耳与内舱"、"单只耳机入耳侧面特写"），并在 prodAngleRole 字段返回其标准视角角色（可选值仅限："hero_front" 正面主视觉、"open_case" 开盖展示、"single_earbud" 单耳/局部特写、"detail_closeup" 材质/接口微距、"multi_sku" 多色/多图案合集、"package_accessory" 包装/配件全家福）。
- 如果是【参考案例图(case)】：标注其版式构图、视觉风格或排版亮点（如："首屏对标·石膏圆柱展台+顶部居中标题"、"拆解对标·垂直5层爆炸图+底部三胶囊卡片"），并在 caseDimensions 数组中返回该案例最值得借鉴的 1~3 个正交维度（可选值仅限："pose" 主体姿态、"style" 环境背景、"structure" 版式骨架、"content" 文案版式、"copy_text" 文案内容、"lighting" 光影色调）。
字数控制在 8~20 字以内，原样返回每张图的 id 字段。`,
      },
    ];

    for (const ref of referenceImages) {
      parts.push({
        text: `【图片 ID: "${ref.id}" | 编号: #${ref.code} | 类型: ${
          ref.category === "case" ? "参考案例图" : "产品图片"
        } | 原文件名: ${ref.name}】`,
      });
      const resolvedImg = await resolveReferenceInlineImage(ref, ossConfig);
      if (resolvedImg) {
        parts.push({
          inlineData: {
            mimeType: resolvedImg.mimeType,
            data: resolvedImg.data,
          },
        });
      }
    }

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                tag: { type: Type.STRING },
                prodAngleRole: { type: Type.STRING },
                caseDimensions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["id", "tag"],
            },
          },
        },
        required: ["tags"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking: true,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON 对象，格式为: {"tags": [{"id": "图片ID", "tag": "视觉标注", "prodAngleRole": "hero_front", "caseDimensions": ["style", "structure"]}]}',
    });

    const parsed = safeParseJson(response.text || "{}");
    const allowedDims = new Set([
      "pose",
      "style",
      "structure",
      "content",
      "copy_text",
      "lighting",
    ]);
    const allowedProdRoles = new Set([
      "hero_front",
      "open_case",
      "single_earbud",
      "detail_closeup",
      "multi_sku",
      "package_accessory",
    ]);
    const normalizedTags = (parsed.tags || [])
      .map((item: any) => {
        const canonicalId = resolveCanonicalRefId(item.id, referenceImages);
        if (!canonicalId || !item.tag) return null;
        const validDims = Array.isArray(item.caseDimensions)
          ? item.caseDimensions.filter((d: string) => allowedDims.has(d))
          : undefined;
        const validRole =
          typeof item.prodAngleRole === "string" &&
          allowedProdRoles.has(item.prodAngleRole.trim())
            ? item.prodAngleRole.trim()
            : undefined;
        return {
          id: canonicalId,
          tag: String(item.tag).trim(),
          prodAngleRole: validRole,
          caseDimensions: validDims && validDims.length > 0 ? validDims : undefined,
        };
      })
      .filter(Boolean);

    res.json({
      tags: normalizedTags,
    });
  } catch (err: any) {
    console.error("Error in /api/agent/analyze-refs:", err);
    res.status(500).json({
      error: err?.message || "批量识别素材特征失败",
    });
  }
});

/**
 * Per-Screen Independent Layout Reverse-Engineering Helper:
 * Analyzes each #Case screen individually (with concurrency 3) so that even when 8~15 sliced
 * long-page screens are uploaded, the vision model never suffers from "Lost-in-the-Middle" laziness
 * and extracts every screen's exact geometric layout skeleton & UI container structure.
 */
function formatServerSubScreenRegionLabel(
  subScreenIndex: number,
  subScreenTotal: number
): string {
  if (subScreenTotal <= 1) return "整屏";
  if (subScreenTotal === 2) {
    return subScreenIndex === 1 ? "上半屏 (1/2)" : "下半屏 (2/2)";
  }
  if (subScreenTotal === 3) {
    if (subScreenIndex === 1) return "上段 (1/3)";
    if (subScreenIndex === 2) return "中段 (2/3)";
    return "下段 (3/3)";
  }
  return `子屏 ${subScreenIndex}/${subScreenTotal}`;
}

async function analyzeCaseScreensLayoutDna(options: {
  caseImages: {
    id: string;
    code: string;
    name: string;
    tag?: string;
    width?: number;
    height?: number;
    caseDimensions?: string[];
    extractedLayoutDna?: string;
    detectedSubScreens?: any[];
    isLongPageSlice?: boolean;
    sliceIndex?: number;
    sliceTotal?: number;
    mimeType: string;
    base64Data?: string;
    ossUrl?: string;
    ossObjectKey?: string;
    previewUrl?: string;
  }[];
  expectedTotalScreens?: number;
  agentModel: string;
  customBaseUrl?: string;
  customApiKey?: string;
  customHeaders?: string;
  protocol: ApiProtocolMode;
  ossConfig?: ServerOssConfigInput;
}): Promise<
  Array<{
    id: string;
    screenIndex: number;
    tag: string;
    extractedLayoutDna: string;
    caseDimensions: string[];
    subScreens: Array<{
      subScreenIndex: number;
      subScreenTotal: number;
      regionLabel: string;
      title: string;
      sectionType: string;
      extractedLayoutDna: string;
    }>;
  }>
> {
  const {
    caseImages,
    expectedTotalScreens,
    agentModel,
    customBaseUrl,
    customApiKey,
    customHeaders,
    protocol,
    ossConfig,
  } = options;

  const results: Array<{
    id: string;
    screenIndex: number;
    tag: string;
    extractedLayoutDna: string;
    caseDimensions: string[];
    subScreens: Array<{
      subScreenIndex: number;
      subScreenTotal: number;
      regionLabel: string;
      title: string;
      sectionType: string;
      extractedLayoutDna: string;
    }>;
  }> = new Array(caseImages.length);

  const CONCURRENCY = 3;
  let cursor = 0;
  const totalSlices = caseImages.length;

  const worker = async () => {
    while (cursor < caseImages.length) {
      const idx = cursor++;
      const ref = caseImages[idx];
      const screenIdx = ref.sliceIndex || idx + 1;
      const totalScreens = ref.sliceTotal || totalSlices;

      // Estimate how many sub-screens this slice may contain based on aspect ratio and/or expectedTotalScreens
      const ratioCount =
        ref.width && ref.height && ref.width > 0
          ? Math.max(1, Math.round(ref.height / (ref.width * 1.65)))
          : 1;
      const proportionalCount =
        typeof expectedTotalScreens === "number" &&
        expectedTotalScreens > totalSlices
          ? Math.max(
              1,
              Math.round(((idx + 1) * expectedTotalScreens) / totalSlices) -
                Math.round((idx * expectedTotalScreens) / totalSlices)
            )
          : 1;
      const suggestedSubCount = Math.min(
        5,
        Math.max(ratioCount, proportionalCount)
      );

      try {
        const resolvedImg = await resolveReferenceInlineImage(
          ref as any,
          ossConfig
        );
        if (!resolvedImg) {
          const fallbackTitle = ref.tag || `第${screenIdx}屏对标案例`;
          const fallbackDna =
            ref.extractedLayoutDna ||
            `第${screenIdx}屏标准竖版构图：顶部20%主副标题区 + 中部55%核心主视觉展示区 + 底部25%卖点胶囊卡片区`;
          results[idx] = {
            id: ref.id,
            screenIndex: screenIdx,
            tag: fallbackTitle,
            extractedLayoutDna: fallbackDna,
            caseDimensions:
              Array.isArray(ref.caseDimensions) && ref.caseDimensions.length > 0
                ? ref.caseDimensions
                : ["style", "structure", "content", "lighting"],
            subScreens: [
              {
                subScreenIndex: 1,
                subScreenTotal: 1,
                regionLabel: "整屏",
                title: fallbackTitle,
                sectionType: fallbackTitle.split(/[·•\s]/)[0] || "详情分屏",
                extractedLayoutDna: fallbackDna,
              },
            ],
          };
          continue;
        }

        const selectedDimsForAnalysis = normalizeCaseDimensions(
          ref.caseDimensions
        );
        const selectedLabelsStr = selectedDimsForAnalysis
          .map((d) => CASE_DIM_LABELS[d] || d)
          .join("、");

        const multiSubScreenInstruction =
          suggestedSubCount >= 2 || totalSlices <= 6
            ? `\n⚠️【重点：识别单张长切片内的多个子屏模块（subScreens）】：
用户为了保留整页视觉规范的完整上下文，将包含约 ${expectedTotalScreens || 10} 屏的长详情页切分成了 ${totalSlices} 张长切片（当前为第 ${screenIdx}/${totalSlices} 张切片 #${ref.code}，预计本张切片从上到下包含约 **${suggestedSubCount} 个**独立的逻辑子屏模块）。
请从上到下仔细观察本张切片画面：
- 若画面从上到下包含多个不同主题/卖点的独立分屏模块（例如上半部分是首屏KV、下半部分是痛点对比或声学拆解），请务必按从上到下的阅读顺序，将其拆解为多个独立的子屏对象放入 \`subScreens\` 数组中（建议拆出 ${suggestedSubCount} 个子屏，切勿把多个独立分屏笼统合并成 1 条）！
- 若本张切片确实只包含 1 个独立分屏画面，则 \`subScreens\` 数组输出 1 项。`
            : `\n请扫描本张切片，将识别出的分屏内容标题与四维版式规律输出到 \`subScreens\` 数组中（若画面内含上、下两个独立模块也可拆分为多项）。`;

        const singleParts: any[] = [
          {
            text: `你是一位顶级的淘宝/天猫详情页视觉结构与设计规范分析专家。
当前输入的是竞品详情页长图的【第 ${screenIdx} / ${totalScreens} 张切片】（编号: #${ref.code}，文件名: ${ref.name}）。
用户为本张案例切片勾选的【允许提取维度】为：${selectedLabelsStr}。${multiSubScreenInstruction}

请严格按以下六维分析边界提取本切片（及内部每个子屏）的内容结构与抽象视觉规律（注意：仅提取抽象设计规律用于后续围绕我方自有产品重新策划，⛔严禁照抄竞品品牌名、竞品具体参数承诺，严禁把竞品具体背景道具当作固定坐标复刻）：
- 若包含「文案内容(copy_text)」或默认分析：提取【模块定位与卖点表达结构】（营销主题定位、痛点/利益点/印证点的表达逻辑，不提取竞品具体参数）；
- 若包含「版式骨架(structure)」：提取【信息分区与留白规律】（画面上中下或左右的信息分区主次、图文面积占比与四周呼吸留白规律，不复制元素像素坐标）；
- 若包含「文案版式(content)」：提取【字体性格与排版层级】（主副标字体性格、字号对比层级、对齐方式、间距与信息分组形式，不提取文字内容）；
- 若包含「环境背景(style)」与「光影色调(lighting)」：提取【场景类型与材质语言】（场景类别、台面材质肌理与几何造型语言，供后续重新设计具体布景）及【光影反差与色彩关系】（光向、软硬、反差与主辅色调关系，不继承竞品场景物件）；
- 若包含「主体姿态(pose)」：提取【主体姿态与组合关系】（主体朝向、摆放角度与主副件组合关系，不继承竞品身份与外形）。

请输出 JSON：
1. "tag"（8~24字）：概括本张切片包含的卖点模块与版式特征。
2. "extractedLayoutDna"（80~160字）：按【模块定位】、【信息分区与留白规律】、【字体性格与排版层级】、【场景材质语言与光影色彩关系】结构化输出本切片整体视觉基因。
3. "subScreens"（数组，包含本张长切片从上到下识别出的 1~4 个独立逻辑子屏）：每个子屏包含：
   - "title"（8~18字）：该子屏的内容主题与版式简称，如 "KV爆款首屏·双展台主视觉登场" 或 "13mm动圈声学爆炸拆解+三标印证"（不要加“第X屏”前缀）
   - "sectionType"（4~10字）：如 "KV爆款首屏"、"声学结构拆解"、"云感佩戴体验"
   - "regionLabel"：如 "整屏"、"上半屏 (1/2)"、"下半屏 (2/2)"、"上段 (1/3)"、"中段 (2/3)"、"下段 (3/3)"
   - "extractedLayoutDna"（60~140字）：该子屏独立的【模块定位】、【信息分区与留白规律】、【字体性格与排版层级】、【场景材质语言与光影色彩关系】。`,
          },
          {
            inlineData: {
              mimeType: resolvedImg.mimeType,
              data: resolvedImg.data,
            },
          },
        ];

        const singleConfig: any = {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tag: { type: Type.STRING },
              extractedLayoutDna: { type: Type.STRING },
              caseDimensions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              subScreens: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    regionLabel: { type: Type.STRING },
                    title: { type: Type.STRING },
                    sectionType: { type: Type.STRING },
                    extractedLayoutDna: { type: Type.STRING },
                  },
                  required: ["title", "extractedLayoutDna"],
                },
              },
            },
            required: ["tag", "extractedLayoutDna", "subScreens"],
          },
        };

        const resp = await executeUniversalAgentCall({
          model: agentModel,
          parts: singleParts,
          config: singleConfig,
          enableHighThinking: false,
          customBaseUrl,
          customApiKey,
          customHeaders,
          protocol,
          jsonHint:
            '请严格输出 JSON 对象: {"tag": "模块简称", "extractedLayoutDna": "【模块定位】...【信息分区与留白规律】...【字体性格与排版层级】...【场景材质语言与光影色彩关系】...", "subScreens": [{"regionLabel": "上半屏 (1/2)", "title": "子屏内容标题", "sectionType": "模块类型", "extractedLayoutDna": "【模块定位】...【信息分区与留白规律】..."}]}',
        });

        const parsed = safeParseJson(resp.text || "{}");
        const rawDna =
          String(parsed.extractedLayoutDna || "").trim() ||
          ref.extractedLayoutDna ||
          `第${screenIdx}屏内容结构与版式规律`;
        const filteredOverallDna = filterExtractedDnaByDimensions(
          rawDna,
          selectedDimsForAnalysis,
          Boolean((ref as any).isLockBaseSwap)
        );
        const overallTag =
          String(parsed.tag || "").trim() ||
          ref.tag ||
          `第${screenIdx}屏·竞品结构分析`;

        const rawSubs = Array.isArray(parsed.subScreens)
          ? parsed.subScreens.filter(
              (s: any) => s && (String(s.title || "").trim() || String(s.extractedLayoutDna || "").trim())
            )
          : [];

        const normalizedSubScreens =
          rawSubs.length > 0
            ? rawSubs.map((s: any, sIdx: number) => {
                const subTotal = rawSubs.length;
                const subNum = sIdx + 1;
                const cleanSubTitle =
                  String(s.title || "")
                    .replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, "")
                    .trim() || overallTag;
                const rawSubDna =
                  String(s.extractedLayoutDna || "").trim() || rawDna;
                return {
                  subScreenIndex: subNum,
                  subScreenTotal: subTotal,
                  regionLabel:
                    String(s.regionLabel || "").trim() ||
                    formatServerSubScreenRegionLabel(subNum, subTotal),
                  title: cleanSubTitle,
                  sectionType:
                    String(s.sectionType || "").trim() ||
                    cleanSubTitle.split(/[·•\s+]/)[0] ||
                    "核心卖点模块",
                  extractedLayoutDna: filterExtractedDnaByDimensions(
                    rawSubDna,
                    selectedDimsForAnalysis,
                    Boolean((ref as any).isLockBaseSwap)
                  ),
                };
              })
            : [
                {
                  subScreenIndex: 1,
                  subScreenTotal: 1,
                  regionLabel: "整屏",
                  title: overallTag.replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, "").trim(),
                  sectionType:
                    overallTag
                      .replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, "")
                      .split(/[·•\s+]/)[0] || "核心卖点模块",
                  extractedLayoutDna: filteredOverallDna,
                },
              ];

        results[idx] = {
          id: ref.id,
          screenIndex: screenIdx,
          tag: overallTag,
          extractedLayoutDna: filteredOverallDna,
          caseDimensions: selectedDimsForAnalysis,
          subScreens: normalizedSubScreens,
        };
      } catch (err) {
        console.warn(
          `Single screen layout reverse-engineering fallback for ${ref.code}:`,
          err
        );
        const fallbackTitle = ref.tag || `第${screenIdx}屏·竞品结构分析`;
        const fallbackDna =
          ref.extractedLayoutDna ||
          `【模块定位】第${screenIdx}屏核心卖点展示；【信息分区与留白规律】上部标题区+中部商品主视觉区+底部卖点信息区，四周留白≥8%`;
        results[idx] = {
          id: ref.id,
          screenIndex: screenIdx,
          tag: fallbackTitle,
          extractedLayoutDna: fallbackDna,
          caseDimensions:
            Array.isArray(ref.caseDimensions) && ref.caseDimensions.length > 0
              ? ref.caseDimensions
              : ["style", "structure", "content", "lighting"],
          subScreens: [
            {
              subScreenIndex: 1,
              subScreenTotal: 1,
              regionLabel: "整屏",
              title: fallbackTitle.replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, "").trim(),
              sectionType: "核心卖点展示",
              extractedLayoutDna: fallbackDna,
            },
          ],
        };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, caseImages.length) }, () =>
      worker()
    )
  );

  return results.filter(Boolean);
}

// Per-Screen Independent Competitor Layout & Unified Visual Spec Analysis Endpoint
app.post("/api/agent/analyze-case-screens", async (req, res) => {
  try {
    const {
      caseImages = [],
      expectedTotalScreens,
      agentModel = "gemini-4-argon",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      caseImages: any[];
      expectedTotalScreens?: number;
      agentModel?: string;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!Array.isArray(caseImages) || caseImages.length === 0) {
      res.status(400).json({ error: "请先上传参考案例图 (#Case)。" });
      return;
    }

    const screens = await analyzeCaseScreensLayoutDna({
      caseImages,
      expectedTotalScreens,
      agentModel,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      ossConfig,
    });

    const enrichedCases = caseImages.map((c) => {
      const hit = screens.find((s) => s.id === c.id);
      return hit
        ? {
            ...c,
            tag: hit.tag,
            extractedLayoutDna: hit.extractedLayoutDna,
            detectedSubScreens: hit.subScreens,
          }
        : c;
    });
    const unifiedVisualSpec = synthesizeUnifiedVisualSpecServer(enrichedCases);

    res.json({ screens, unifiedVisualSpec });
  } catch (err: any) {
    console.error("Error in /api/agent/analyze-case-screens:", err);
    res.status(500).json({
      error: err?.message || "逐屏分析竞品内容结构与整页视觉规范失败，请稍后重试。",
    });
  }
});

// Unified Agent Orchestration:
// Takes [1.产品图片] + [2.参考案例图(含参考维度)] + [3.产品信息说明/或现成全案] + [4.生图要求(主图/详情、比例、有无文字)]
// -> Outputs: Complete Taobao Multi-Screen Design Plan + Per-Screen Prompts (with full Typography Plan!) + Reference Image Allocation
app.post("/api/agent/parse-plan", async (req, res) => {
  try {
    const {
      productInfoText = "",
      existingFullPlanText = "",
      referenceImages = [],
      agentModel = "gemini-4-argon",
      enableHighThinking = true,
      defaultImageSize = "1K",
      globalStylePrefix = "",
      requirements = {
        taskScope: "detail_only",
        mainImageCount: 2,
        detailScreenCount: 5,
        mainAspectRatio: "1:1",
        detailAspectRatio: "9:16",
        textMode: "with_text",
      },
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      productInfoText?: string;
      existingFullPlanText?: string;
      referenceImages: {
        id: string;
        code: string;
        category?: "product" | "case";
        name: string;
        tag: string;
        caseDimensions?: string[];
        caseCustomRule?: string;
        extractedLayoutDna?: string;
        isLongPageSlice?: boolean;
        sliceIndex?: number;
        sliceTotal?: number;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        ossObjectKey?: string;
        previewUrl?: string;
      }[];
      agentModel?: string;
      enableHighThinking?: boolean;
      defaultImageSize?: string;
      globalStylePrefix?: string;
      requirements?: {
        taskScope: "detail_only" | "main_only" | "both";
        mainImageCount: number;
        detailScreenCount: number;
        mainAspectRatio: string;
        detailAspectRatio: string;
        textMode: "with_text" | "without_text";
        enableStaticLayering?: boolean;
        autoAlignCaseToScreens?: boolean;
      };
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!productInfoText.trim() && !existingFullPlanText.trim()) {
      res
        .status(400)
        .json({ error: "请填写【产品信息说明】或【多屏详情页设计方案】。" });
      return;
    }

    const enableStaticLayering = requirements.enableStaticLayering !== false;
    const isMainOnlyScope = requirements.taskScope === "main_only";
    const isDetailOnlyScope =
      requirements.taskScope !== "both" && requirements.taskScope !== "main_only";
    const detailTargetRatio = requirements.detailAspectRatio || "9:16";
    const detailTargetCount = Math.max(
      1,
      Math.min(20, Number(requirements.detailScreenCount) || 10)
    );

    const productRefs = referenceImages.filter((r) => r.category !== "case");
    let caseRefs = referenceImages.filter((r) => r.category === "case");

    // When multiple #Case screens (e.g. sliced long-page competitor screens) are uploaded in Detail Studio
    // and lack extractedLayoutDna, automatically run per-screen layout reverse-engineering first so the
    // orchestrator never suffers from "Lost-in-the-Middle" laziness across 8~14 screens!
    const isMultiScreenCaseSequence =
      isDetailOnlyScope &&
      caseRefs.length >= 2 &&
      requirements.autoAlignCaseToScreens !== false;

    if (
      isMultiScreenCaseSequence &&
      caseRefs.some(
        (c) =>
          !c.extractedLayoutDna ||
          !c.extractedLayoutDna.trim() ||
          (!Array.isArray((c as any).detectedSubScreens) &&
            detailTargetCount > caseRefs.length)
      )
    ) {
      try {
        const analyzedScreens = await analyzeCaseScreensLayoutDna({
          caseImages: caseRefs,
          expectedTotalScreens: detailTargetCount,
          agentModel,
          customBaseUrl,
          customApiKey,
          customHeaders,
          protocol,
          ossConfig,
        });
        const dnaMap = new Map(analyzedScreens.map((s) => [s.id, s]));
        caseRefs = caseRefs.map((c) => {
          const hit = dnaMap.get(c.id);
          if (!hit) return c;
          return {
            ...c,
            tag: c.tag || hit.tag,
            extractedLayoutDna: c.extractedLayoutDna || hit.extractedLayoutDna,
            detectedSubScreens:
              Array.isArray((c as any).detectedSubScreens) &&
              (c as any).detectedSubScreens.length > 0
                ? (c as any).detectedSubScreens
                : hit.subScreens,
          };
        });
      } catch (dnaErr) {
        console.warn("Auto per-screen layout DNA extraction skipped:", dnaErr);
      }
    }

    // Build flattened logical screens (1..N) from caseRefs (supporting multi-subscreen slices!)
    const flattenedLogicalCaseScreens: Array<{
      screenNumber: number;
      sourceCase: (typeof caseRefs)[number];
      regionLabel: string;
      title: string;
      extractedLayoutDna: string;
    }> = [];

    if (caseRefs.length > 0) {
      const hasExplicitSubs = caseRefs.some(
        (c) =>
          Array.isArray((c as any).detectedSubScreens) &&
          (c as any).detectedSubScreens.length > 0
      );
      if (hasExplicitSubs) {
        for (const c of caseRefs) {
          const subs =
            Array.isArray((c as any).detectedSubScreens) &&
            (c as any).detectedSubScreens.length > 0
              ? (c as any).detectedSubScreens
              : [
                  {
                    subScreenIndex: 1,
                    subScreenTotal: 1,
                    regionLabel: "整屏",
                    title: c.tag || c.name,
                    extractedLayoutDna: c.extractedLayoutDna || "",
                  },
                ];
          for (const sub of subs) {
            flattenedLogicalCaseScreens.push({
              screenNumber: flattenedLogicalCaseScreens.length + 1,
              sourceCase: c,
              regionLabel: sub.regionLabel || "整屏",
              title: sub.title || c.tag || c.name,
              extractedLayoutDna:
                sub.extractedLayoutDna || c.extractedLayoutDna || "",
            });
          }
        }
      } else {
        const M = caseRefs.length;
        const targetN = Math.max(M, detailTargetCount);
        for (let i = 0; i < M; i++) {
          const c = caseRefs[i];
          const startS = Math.round((i * targetN) / M);
          const endS = Math.round(((i + 1) * targetN) / M);
          const subCount = Math.max(1, endS - startS);
          for (let sIdx = 0; sIdx < subCount; sIdx++) {
            const subNum = sIdx + 1;
            const regionLabel = formatServerSubScreenRegionLabel(
              subNum,
              subCount
            );
            flattenedLogicalCaseScreens.push({
              screenNumber: flattenedLogicalCaseScreens.length + 1,
              sourceCase: c,
              regionLabel,
              title:
                subCount > 1
                  ? `${c.tag || c.name}（${regionLabel}）`
                  : c.tag || c.name,
              extractedLayoutDna: c.extractedLayoutDna || "",
            });
          }
        }
      }
    }

    const parts: any[] = [];

    // 1. Feed Product Images (#Prod-1..N)
    if (productRefs.length > 0) {
      parts.push({
        text: `=== 一、已上传的【产品图片】共 ${productRefs.length} 张（用于还原商品真实外观、不同视角、结构拆解与包装） ===`,
      });
      for (const ref of productRefs) {
        const scopeLabel = (ref as any).isCommonAsset
          ? "公模通用图（适合静态通用屏）"
          : "当前主推款式图（含正面专属图案/配色）";
        parts.push({
          text: `【产品图 编号: "${ref.code}" | ID: "${ref.id}" | 属性: ${scopeLabel} | 视角与特征说明: ${ref.tag || ref.name}】`,
        });
        const resolvedImg = await resolveReferenceInlineImage(
          ref as any,
          ossConfig
        );
        if (resolvedImg) {
          parts.push({
            inlineData: {
              mimeType: resolvedImg.mimeType,
              data: resolvedImg.data,
            },
          });
        }
      }
    }

    const derivedUnifiedVisualSpec =
      (requirements as any).unifiedVisualSpec?.trim() ||
      synthesizeUnifiedVisualSpecServer(caseRefs, globalStylePrefix);

    const isGlobalLockBaseSwap =
      (requirements as any).caseDeliveryMode === "lock_base_swap" ||
      caseRefs.some((c) => isExplicitLockBaseCase(c));

    // 2. Feed Benchmark Case Reference Images (#Case-1..M) with strict analysis-stage dimension filtering + Unified Visual Spec
    if (caseRefs.length > 0) {
      const multiScreenBindingTable = isMultiScreenCaseSequence
        ? `\n=== 🎯【第一阶段：竞品长图切片内容结构分析 & 整页统一视觉规范提取结果】 ===
当前用户上传了 ${caseRefs.length} 张竞品详情页长切片（#Case-1 ~ #Case-${caseRefs.length}），按阅读顺序共拆解出 ${flattenedLogicalCaseScreens.length} 个逻辑子屏模块（用于对齐生成 ${detailTargetCount} 屏任务卡）。
1. **整页统一视觉规范（Unified Visual Specification）**：
   ${derivedUnifiedVisualSpec}
2. **各逻辑分屏按选中六维标签过滤后的内容结构与抽象规律（第 1 ~ ${flattenedLogicalCaseScreens.length} 屏按序映射）**：
${flattenedLogicalCaseScreens
  .map((ls, i) => {
    const c = ls.sourceCase;
    return `  * 第 ${i + 1} 屏参考来源 [#${c.code} · ${ls.regionLabel} (${ls.title}) | 已选提取维度: ${normalizeCaseDimensions(c.caseDimensions).map((d) => CASE_DIM_LABELS[d] || d).join(" + ")}${(c as any).isLockBaseSwap ? " | 🔒已开启锁底换款" : ""}]：${
      filterExtractedDnaByDimensions(
        ls.extractedLayoutDna,
        c.caseDimensions,
        Boolean((c as any).isLockBaseSwap || isGlobalLockBaseSwap)
      ) || "按已选维度提取该子屏的信息分区与卖点表达结构"
    }`;
  })
  .join("\n")}
3. **✨【第二阶段：结合自有产品重新策划各屏背景、布局及文案（核心准则）】**：
   - ${
     isGlobalLockBaseSwap
       ? `当前处于【🔒逐屏锁底换款模式】：除将产品主体 100% 替换为我方自有产品 #Prod 并更新我方指定文案外，背景、版式坐标与容器样式 100% 锁定对应案例图。`
       : `当前处于【默认重策划模式（生图默认不传入逐屏竞品原图）】：目标是**保持整页风格统一（遵循上方整页统一视觉规范），同时围绕我方自有产品 #Prod 重新设计各屏的具体背景布景和版面排版，不百分百沿用竞品的具体场景物件（如罗马柱、手机屏幕、礼盒公仔、外籍模特等）、元素像素坐标或完整构图，仅做适当结构与风格借鉴**！`
   }
   - **产品身份唯一权威源**：产品外观、造型、材质与表面图案 100% 以自有产品图 \`#Prod\` 为准，绝不继承竞品身份和外形。
   - **文案与参数唯一权威源**：所有主副标题、卖点文案与参数表 100% 以我方自有产品资料与用户指定文案为准，绝不移植竞品参数、竞品品牌名或承诺，也严禁将构图术语（如“首焦KV+居中大字”）当成海报文字印刷。\n`
        : "";

      parts.push({
        text: `=== 二、参考案例图分析提取范围与整页统一视觉规范（请严格按每张案例勾选的维度提取信息，未勾选维度不从该案例提取） ===\n【整页统一视觉规范】：${derivedUnifiedVisualSpec}\n${buildMultiCaseSynthesisDirective(caseRefs, derivedUnifiedVisualSpec, "detail")}${multiScreenBindingTable}`,
      });
      let attachedAnalyzedCaseImageCount = 0;
      for (const ref of caseRefs) {
        parts.push({
          text: buildSingleCaseDimensionInstruction(ref, false, "detail"),
        });
        const hasStructuredDna = Boolean(
          (ref.extractedLayoutDna && String(ref.extractedLayoutDna).trim().length > 20) ||
            (Array.isArray((ref as any).detectedSubScreens) &&
              (ref as any).detectedSubScreens.length > 0)
        );
        const isLockSwap = Boolean((ref as any).isLockBaseSwap);
        // When a multi-slice #Case pool (>2 slices) has already been reverse-engineered into structured DNA,
        // only attach inline images for un-analyzed slices, lock_base_swap slices, or at most 2 representative style slices,
        // preserving multimodal vision budget and resolution for #Prod images!
        const shouldAttachInlineCaseImg =
          !hasStructuredDna ||
          isLockSwap ||
          caseRefs.length <= 2 ||
          attachedAnalyzedCaseImageCount < 2;

        if (shouldAttachInlineCaseImg) {
          const resolvedImg = await resolveReferenceInlineImage(
            ref as any,
            ossConfig
          );
          if (resolvedImg) {
            if (hasStructuredDna && !isLockSwap) {
              attachedAnalyzedCaseImageCount++;
            }
            parts.push({
              inlineData: {
                mimeType: resolvedImg.mimeType,
                data: resolvedImg.data,
              },
            });
          }
        }
      }
    }

    // 3. Build Task Scope & Text Rendering Mode Instructions
    const scopeDesc =
      requirements.taskScope === "both"
        ? `请同时规划并拆解【${requirements.mainImageCount} 张商品主图（比例 ${requirements.mainAspectRatio}）】+【${detailTargetCount} 屏详情页分屏（每屏比例 ${detailTargetRatio}）】`
        : requirements.taskScope === "main_only"
        ? `请规划并拆解【${requirements.mainImageCount} 张高点击率商品主图（每张比例 ${requirements.mainAspectRatio}）】`
        : `请严格规划并拆解【${detailTargetCount} 屏详情页竖版分屏任务（每屏比例必须 100% 统一为 ${detailTargetRatio}，每个任务的 screenCategory 必须 100% 固定为 "detail"）】。
⚠️【严禁生成主图残留铁律】：当前为纯粹的「详情页工作台 (detail_only)」模式！绝对禁止生成任何 1:1 商品主图，绝对禁止在分屏标题中出现“主图1~5”字样！即使下方已有全案文本中含有旧版“主图1~5 (1:1)”段落，你也必须将其全部改写升级为标准详情页竖版分屏（第1屏 ~ 第${detailTargetCount}屏，每屏比例严格锁定为 ${detailTargetRatio}）！`;

    const textModeDesc =
      requirements.textMode === "with_text"
        ? `【每屏生成含产品和文字的完整图（直出海报模式）】：每一屏不仅要输出结构化的 typographyPlan（顶部标头、主标题、副标题/卖点标签、底部卖点区/参数表），而且在编写 visualPrompt 时，必须把【整页统一视觉规范】、【重新策划的本屏背景与版面布局】、【自有产品 #Prod 形态细节】以及【本屏完整中文文案与排版层级（四周保留至少8%呼吸安全留白）】完整写进 visualPrompt 中，使生图模型在不依赖逐屏竞品原图的情况下也能直接生成整页风格高度统一、含自有产品和文字的完整海报！`
        : `【无文字信息（纯视觉留白底图）】：每一屏同样必须完整输出结构化的 typographyPlan 供设计师参考；但在 visualPrompt 中，请融合【整页统一视觉规范】与【重新策划的本屏背景与自有产品形态】，并根据信息分区位置预留干净的负空间/呼吸留白，画面内不生成任何文字水印。`;

    const layeringStrategyDesc = enableStaticLayering
      ? `【动静分层公模架构（开启静态通用屏）】：
     - 详情前 3 屏设为 \`layerType: "dynamic"\`（⚡动态款式屏）：重点展示当前款式的正面专属印花图案、核心配色与款式美学，优先绑定带当前花色特征的产品图（如 #Prod-1）；
     - 详情第 4 屏及之后的功能/声学/拆解/佩戴/续航/参数屏设为 \`layerType: "static"\`（🔒静态通用屏）：采用中性纯白/基础公模侧背视角、单耳特写或内部声学结构拆解展示，不露出特定花色的正面定制印花图案，确保在 1000+ 款不同花色切换时 1000% 通用复用。`
      : `【全屏专属款式模式（已关闭静态通用屏 · 全屏均为动态款式屏）】：
     - **严禁生成任何去印花的静态通用公模屏！** 所有分屏任务（从第 1 屏到最后一屏，100% 全部任务）的 \`layerType\` 必须全部设为 \`"dynamic"\`！
     - **严禁在任何一屏的 \`visualPrompt\` 中出现“采用纯白单耳或中性白壳侧背视角”、“不露具体正面图案”、“去印花通用公模”等限制词！**
     - 每一屏中的商品本体都必须清晰还原当前自有主推款商品 #Prod 的真实配色、正面定制图案与标志性外观细节！`;

    const mainImageTargetCount = Math.max(
      1,
      Math.min(8, Number(requirements.mainImageCount) || 5)
    );
    const mainImageTargetRatio = requirements.mainAspectRatio || "1:1";

    const layerTypeSchemaDesc = isMainOnlyScope
      ? "分层属性：当前为「仅商品主图」模式，所有任务必须 100% 固定输出为 'dynamic'"
      : enableStaticLayering
      ? "分层属性：'dynamic' 表示随款式印花替换的动态屏；'static' 表示1000+款通用的静态公模屏"
      : "分层属性：当前用户已关闭静态通用屏，所有分屏必须 100% 固定输出为 'dynamic'";

    const sanitizedExistingPlanText = isDetailOnlyScope
      ? existingFullPlanText
          .replace(/第\s*(\d+)\s*屏\s*[·•-]\s*主图\s*\d+/g, "第$1屏·")
          .replace(/【主图\s*\d+\s*】/g, "【详情分屏】")
          .replace(/画幅比例[：:]\s*1:1/g, `画幅比例：${detailTargetRatio}`)
      : existingFullPlanText;

    const promptInstruction = isMainOnlyScope
      ? `
你是一位顶级的淘宝/天猫高点击率商品主图视觉总监与 AI 生图提示词总编排 Agent。
请基于上方提供的【自有产品图 (#Prod)】、【参考案例图 (#Case) 的六维分析提取结果】以及下方的【自有产品卖点资料】，重新策划并拆解出 **${mainImageTargetCount} 张商品主图任务 (tasks)**：
1. \`generatedFullPlanDoc\` 输出简短企划大纲（200字以内），\`unifiedVisualSpec\` 输出整套统一视觉规范。
2. 每个任务的 \`screenCategory\` 固定为 \`"main"\`，\`layerType\` 固定为 \`"dynamic"\`，\`aspectRatio\` 固定为 \`"${mainImageTargetRatio}"\`。
3. 产品身份100%以自有 #Prod 为准，文案与参数100%以我方资料为准；保持整套主图色调与光影统一，同时重新设计每张主图的具体布景与排版，不百分百照搬竞品具体道具或坐标。
4. ${textModeDesc}

【整页统一视觉规范】：${derivedUnifiedVisualSpec}
【三、自有产品核心卖点与规格资料】：
"""
${productInfoText || existingFullPlanText || "请结合上传的自有产品图片提炼核心卖点"}
"""
`
      : `
你是一位顶级的淘宝/天猫品牌视觉总监与 AI 生图提示词总编排 Agent。
请严格执行【先分析竞品长图切片提取内容结构和整页视觉规范 -> 再根据自有产品重新策划各屏背景、布局及文案生成独立任务卡】的三段式流程，完成以下输出：
1. 提炼或完善《整页统一视觉规范》(unifiedVisualSpec)：汇总按选中标签过滤后的场景材质语言、光影反差与色彩关系、字体性格与排版层级规范，确保整页所有分屏在不传逐屏竞品原图时依然保持高度统一的页面风格。
2. 生成或完善《完整多屏淘宝详情页设计全案文档》(generatedFullPlanDoc)：围绕自有产品重新策划每一屏的模块定位、背景布景、版面分区与文案排版规划。
3. 拆解为 **${detailTargetCount} 屏独立详情页生图任务卡数组 (tasks)**：
   - **必须全部为详情分屏**：每个任务的 \`screenCategory\` 必须固定为 \`"detail"\`，\`aspectRatio\` 必须固定为 \`"${detailTargetRatio}"\`，分屏标题格式统一为 \`"第N屏·模块主题"\`（严禁出现“主图1~5”或 1:1 比例）！
   - **✨【重策划核心原则（保持整页风格统一 + 重新设计背景与排版）】**：
     * 除非某屏显式开启了「锁底换款」，否则**绝不百分百沿用竞品的具体场景物件（如竞品原图的罗马柱拱门、手机游戏屏、礼盒公仔、外籍模特等）、元素像素坐标或完整构图**，仅对按选中标签提取出的内容结构、分区主次、材质语言与光影色调做适当参考借鉴，围绕自有产品 \`#Prod\` 重新设计每一屏的背景布景与版面布局！
     * **产品身份以自有产品图 \`#Prod\` 为准**，绝不继承竞品身份或外形；
     * **文案与参数以自有产品资料与用户指定文案为准**，即使勾选了「文案内容(copy_text)」也仅提取竞品的卖点主题与表达结构并依据我方资料重写，绝不移植竞品参数与承诺！
   - **动静分层与款式表现策略**：
     ${layeringStrategyDesc}
   - **独立自包含的生图提示词 (\`visualPrompt\`)**：由于默认不向生图模型传入逐屏竞品案例图，每一屏的 \`visualPrompt\` 必须完整包含【整页统一视觉规范要点 + 本屏重新设计的背景布景与展台材质 + 本屏信息分区与图文占比 + 自有产品 #Prod 外观与姿态描述 + 屏内完整文案与字体层级指令】：
     ${textModeDesc}

【生图范围与比例要求】：${scopeDesc}
【整页统一视觉规范】：${derivedUnifiedVisualSpec}
【全局画风要求】：${globalStylePrefix || "8K商业级电商广告视觉，整页色调与光影高度统一，产品细节真实锐利"}

【三、自有产品信息说明（唯一文案与参数权威源）】：
"""
${productInfoText || "（详见下方完整设计方案）"}
"""

【四、已输入的详情页多屏设计方案（用户指定文案优先）】：
"""
${sanitizedExistingPlanText || `（请结合自有产品资料与提取的内容结构重新策划完整的 ${detailTargetCount} 屏淘宝详情页方案）`}
"""
`;

    parts.push({ text: promptInstruction });

    const config: any = {
      systemInstruction:
        "你是顶级的淘宝/天猫视觉全案策划与 AI 生图提示词编排 Agent。你必须把每一屏的【视觉场景与构图（场景氛围+产品形态）】与【文案排版规划（顶部标头+主标题+副标题+底部胶囊卡片/引导）】毫无保留地转化为高精度的分屏任务与提示词。",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          campaignSummary: {
            type: Type.STRING,
            description: "本次全案策划与分屏提示词、产品图/案例图分配策略的一句话总结（简体中文）",
          },
          unifiedVisualSpec: {
            type: Type.STRING,
            description: "整页统一视觉规范（跨屏风格、色调、光影、材质与排版基准，必须使用简体中文）",
          },
          generatedFullPlanDoc: {
            type: Type.STRING,
            description: isMainOnlyScope
              ? "简短的商品主图企划摘要（200字以内即可，简体中文）"
              : "完整的多屏淘宝详情页设计全案文档全文（必须全程使用简体中文），按分屏清晰列出：对标案例、画幅比例、视觉场景与构图（场景氛围+产品形态）、文案排版规划（顶部标头+主标题+副标题+底部胶囊卡片）",
          },
          tasks: {
            type: Type.ARRAY,
            description: "拆解出的每一张生图任务列表",
            items: {
              type: Type.OBJECT,
              properties: {
                screenNumber: {
                  type: Type.INTEGER,
                  description: "序号，从 1 开始递增",
                },
                screenCategory: {
                  type: Type.STRING,
                  description: isDetailOnlyScope
                    ? "任务类型：当前为详情页工作台模式，必须 100% 固定输出为 'detail'"
                    : "任务类型：'main' 表示商品主图，'detail' 表示详情页分屏",
                },
                layerType: {
                  type: Type.STRING,
                  description: layerTypeSchemaDesc,
                },
                title: {
                  type: Type.STRING,
                  description: "分屏标题，如：第1屏·KV爆款首屏 品牌视觉旗舰登场（严禁出现‘主图1~5’字样）",
                },
                sectionType: {
                  type: Type.STRING,
                  description: "模块定位，如：KV爆款首屏、多款图案合集、场景美学实拍、声学爆炸拆解、全景音效、电竞低延迟、云感佩戴、官方参数表",
                },
                benchmarkCase: {
                  type: Type.STRING,
                  description: "对标案例说明，如：对标 #Case-1 首屏KV构图与展台版式骨架",
                },
                copywriting: {
                  type: Type.STRING,
                  description: "主标题与核心卖点一句话摘要（简体中文）",
                },
                typographyPlan: {
                  type: Type.STRING,
                  description: "完整的【文案排版规划】（必须全程使用简体中文），必须包含：顶部标头、主标题、副标题/卖点标签、阐述文案、底部参数胶囊卡片或引导标，分行清晰展示",
                },
                visualPrompt: {
                  type: Type.STRING,
                  description: "完整的【AI生图提示词】（必须100%全程使用简体中文自然段撰写，严禁输出英文句子！），深度融合场景氛围、产品形态细节、光影构图，以及根据有文字/无文字要求编入的完整排版文字指令或留白指令",
                },
                designNotes: {
                  type: Type.STRING,
                  description: "本屏绑定的产品图(#Prod)与参考案例图(#Case)分配依据说明（简体中文）",
                },
                referenceImageIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "分配给本屏的产品图编号(如 Prod-1, Prod-2)与参考案例图编号(如 Case-1)数组",
                },
                aspectRatio: {
                  type: Type.STRING,
                  description: isDetailOnlyScope
                    ? `画幅比例，必须 100% 固定为 ${detailTargetRatio}`
                    : "画幅比例，可选值：9:16, 3:4, 1:1, 4:3, 16:9, 1:4, 4:1",
                },
              },
              required: [
                "screenNumber",
                "screenCategory",
                "layerType",
                "title",
                "sectionType",
                "benchmarkCase",
                "copywriting",
                "typographyPlan",
                "visualPrompt",
                "designNotes",
                "referenceImageIds",
                "aspectRatio",
              ],
            },
          },
        },
        required: ["campaignSummary", "generatedFullPlanDoc", "tasks"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON 对象，包含字段: campaignSummary (字符串), generatedFullPlanDoc (字符串), tasks (数组，每项含 screenNumber, screenCategory, layerType, title, sectionType, benchmarkCase, copywriting, typographyPlan, visualPrompt, designNotes, referenceImageIds, aspectRatio)。',
    });

    const parsed = safeParseJson(response.text || "{}");
    const allowedRatios = new Set(["3:4", "9:16", "1:1", "4:3", "16:9", "1:4", "4:1"]);

    const normalizedTasks = (parsed.tasks || []).map((t: any, idx: number) => {
      const resolvedSet = new Set<string>();
      if (Array.isArray(t.referenceImageIds)) {
        for (const rawId of t.referenceImageIds) {
          const matched = resolveCanonicalRefId(rawId, referenceImages);
          if (matched) resolvedSet.add(matched);
        }
      }

      const matchedLogicalScreen =
        isMultiScreenCaseSequence && flattenedLogicalCaseScreens.length > 0
          ? flattenedLogicalCaseScreens[
              Math.min(
                flattenedLogicalCaseScreens.length - 1,
                Math.floor(
                  (idx * flattenedLogicalCaseScreens.length) /
                    Math.max(1, (parsed.tasks || []).length || detailTargetCount)
                )
              )
            ]
          : null;

      const matchedCaseForScreen = matchedLogicalScreen
        ? matchedLogicalScreen.sourceCase
        : isMultiScreenCaseSequence && caseRefs.length >= 2
          ? caseRefs[
              Math.min(
                caseRefs.length - 1,
                Math.floor(
                  (idx * caseRefs.length) /
                    Math.max(1, (parsed.tasks || []).length || detailTargetCount)
                )
              )
            ]
          : null;

      // Smart Product Reference Selection: support cross-category roles & respect `isCommonAsset` for static vs dynamic screens
      const rawLayerType: "dynamic" | "static" = isMainOnlyScope
        ? "dynamic"
        : !enableStaticLayering
          ? "dynamic"
          : t.layerType === "static"
            ? "static"
            : "dynamic";

      const commonProds = productRefs.filter((p) => Boolean((p as any).isCommonAsset));
      const dynamicProds = productRefs.filter((p) => !(p as any).isCommonAsset);
      const preferredScopeProds =
        rawLayerType === "static" && commonProds.length > 0
          ? [...commonProds, ...dynamicProds]
          : rawLayerType === "dynamic" && dynamicProds.length > 0
            ? [...dynamicProds, ...commonProds]
            : productRefs;

      const isInnerCloseupProd = (p: any) =>
        /内侧特写|出音网孔|出音孔|LR标识|微距|触点特写|局部特写|细节特写|内部结构|截面|质地|纹理特写/i.test(
          `${p.tag || ""} ${p.name || ""}`
        );
      const nonCloseupProds = preferredScopeProds.filter((p) => !isInnerCloseupProd(p));
      const heroProds = nonCloseupProds.filter((p) =>
        /充电仓|整机|全套|套装|正视|正面|外观|合盖|开盖|图案|印花|保护壳|礼盒|主图|款式|45|主视觉|全身|瓶身|机身|主体/i.test(
          `${p.tag || ""} ${p.name || ""}`
        )
      );
      const primaryHeroProds =
        heroProds.length > 0
          ? heroProds
          : nonCloseupProds.length > 0
            ? nonCloseupProds
            : preferredScopeProds;

      const screenTopicText = `${t.title || ""} ${t.sectionType || ""} ${matchedCaseForScreen?.tag || ""} ${matchedCaseForScreen?.extractedLayoutDna || ""}`;
      const isDetailOrUsageScreen =
        /爆炸|拆解|振膜|动圈|腔体|内部结构|核心成分|微距|工艺细节|佩戴|人体工学|半入耳|云感|耳廓|上身|使用体验|亲肤/.test(
          screenTopicText
        );

      const boundProdList = productRefs.filter((p) => resolvedSet.has(p.id));
      if (rawLayerType === "static" && commonProds.length > 0) {
        const hasCommonBound = boundProdList.some((p) => Boolean((p as any).isCommonAsset));
        if (!hasCommonBound) {
          for (const bp of boundProdList) {
            resolvedSet.delete(bp.id);
          }
          resolvedSet.add(commonProds[idx % commonProds.length].id);
        }
      } else if (boundProdList.length === 0 && primaryHeroProds.length > 0) {
        resolvedSet.add(primaryHeroProds[idx % primaryHeroProds.length].id);
        if (primaryHeroProds.length >= 2 && (idx === 0 || /双展台|双款|合集/.test(screenTopicText))) {
          resolvedSet.add(primaryHeroProds[1].id);
        }
      } else if (
        !isDetailOrUsageScreen &&
        boundProdList.length > 0 &&
        boundProdList.every(isInnerCloseupProd) &&
        primaryHeroProds.length > 0
      ) {
        // Replace inner-closeup-only binding on Hero/Podium screens with a full hero #Prod!
        for (const bp of boundProdList) {
          resolvedSet.delete(bp.id);
        }
        resolvedSet.add(primaryHeroProds[idx % primaryHeroProds.length].id);
        if (primaryHeroProds.length >= 2 && (idx === 0 || /双展台|双款/.test(screenTopicText))) {
          resolvedSet.add(primaryHeroProds[1].id);
        }
      }

      // Case Reference Binding Strategy:
      // Mode A: Multi-screen sequential competitor slices (#Case-1..M) -> 1-to-1 per-screen binding!
      // Avoid dumping all 10 #Case slices onto every single screen task.
      if (isMultiScreenCaseSequence && caseRefs.length >= 2) {
        // Remove any extraneous #Case IDs first so we cleanly bind the exact screen match
        for (const c of caseRefs) {
          resolvedSet.delete(c.id);
        }
        if (matchedCaseForScreen) {
          resolvedSet.add(matchedCaseForScreen.id);
        }
      } else if (caseRefs.length > 0) {
        // Mode B: Orthogonal #Case dimension synthesis (1~2 complementary #Case refs)
        const activeTargetDims = new Set<string>();
        for (const c of caseRefs) {
          for (const d of normalizeCaseDimensions(c.caseDimensions)) {
            activeTargetDims.add(d);
          }
        }
        const coveredDims = new Set<string>();
        for (const c of caseRefs) {
          if (resolvedSet.has(c.id)) {
            for (const d of normalizeCaseDimensions(c.caseDimensions)) {
              coveredDims.add(d);
            }
          }
        }
        for (const reqDim of activeTargetDims) {
          if (!coveredDims.has(reqDim)) {
            const provider = caseRefs.find((c) =>
              normalizeCaseDimensions(c.caseDimensions).includes(reqDim)
            );
            if (provider) {
              resolvedSet.add(provider.id);
              for (const d of normalizeCaseDimensions(provider.caseDimensions)) {
                coveredDims.add(d);
              }
            }
          }
        }
      }

      const filteredRefs = Array.from(resolvedSet);
      const finalRefIds =
        filteredRefs.length > 0
          ? filteredRefs
          : productRefs.length > 0
          ? [productRefs[0].id]
          : referenceImages.length > 0
          ? [referenceImages[0].id]
          : [];

      const isMain = isMainOnlyScope
        ? true
        : isDetailOnlyScope
        ? false
        : t.screenCategory === "main";

      const fallbackRatio = isMain
        ? requirements.mainAspectRatio || "1:1"
        : detailTargetRatio;

      // In Detail Studio (isDetailOnlyScope), strictly enforce detailTargetRatio across ALL screens (including screens 1~5!)
      const ratio = isMainOnlyScope
        ? mainImageTargetRatio
        : isDetailOnlyScope
        ? detailTargetRatio
        : allowedRatios.has(t.aspectRatio)
        ? t.aspectRatio
        : fallbackRatio;

      const screenNum = typeof t.screenNumber === "number" ? t.screenNumber : idx + 1;
      const inferredLayer =
        isMainOnlyScope || !enableStaticLayering
          ? "dynamic"
          : t.layerType === "static" || t.layerType === "dynamic"
            ? t.layerType
            : isMain || screenNum <= 3
              ? "dynamic"
              : "static";

      // Clean any accidental "主图1~5" residue in detail screen titles
      const rawTitle = String(t.title || "").trim();
      const cleanedTitle = isDetailOnlyScope
        ? rawTitle
            .replace(/^(第\s*\d+\s*屏\s*[·•-]\s*)?主图\s*\d+\s*[·•-]?\s*/i, `第${screenNum}屏·`)
            .replace(/^第\s*\d+\s*屏\s*[·•-]\s*第\s*\d+\s*屏\s*[·•-]?\s*/i, `第${screenNum}屏·`)
        : rawTitle;

      const matchedCaseForNote = matchedCaseForScreen;
      const matchedSubTitle = matchedLogicalScreen
        ? `${matchedLogicalScreen.regionLabel} · ${matchedLogicalScreen.title}`
        : matchedCaseForNote?.tag || `第${idx + 1}屏`;
      const matchedSubDna =
        matchedLogicalScreen?.extractedLayoutDna ||
        matchedCaseForNote?.extractedLayoutDna ||
        "";

      return {
        id: `screen-${Date.now()}-${idx + 1}`,
        screenNumber: screenNum,
        screenCategory: isMain ? "main" : "detail",
        layerType: inferredLayer,
        title:
          cleanedTitle ||
          (isMain ? `主图 ${idx + 1} · 高点击商品首焦图` : `第 ${screenNum} 屏`),
        sectionType:
          isDetailOnlyScope && t.sectionType === "商品主图"
            ? "详情分屏"
            : t.sectionType || (isMain ? "商品主图" : "详情分屏"),
        benchmarkCase:
          matchedCaseForNote && matchedSubDna
            ? `【分析来源 #${matchedCaseForNote.code} (${matchedSubTitle})】${filterExtractedDnaByDimensions(matchedSubDna, matchedCaseForNote.caseDimensions, Boolean((matchedCaseForNote as any).isLockBaseSwap || isGlobalLockBaseSwap))}`
            : t.benchmarkCase || "",
        copywriting: t.copywriting || "",
        typographyPlan: t.typographyPlan || t.copywriting || "",
        visualPrompt: t.visualPrompt || "",
        textMode: requirements.textMode || "with_text",
        designNotes: t.designNotes || "",
        referenceImageIds: finalRefIds,
        caseDeliveryOverride:
          (matchedCaseForNote as any)?.isLockBaseSwap || isGlobalLockBaseSwap
            ? "lock_base_swap"
            : "inherit",
        aspectRatio: ratio,
        imageSize: defaultImageSize,
        status: "idle",
        historyImages: [],
      };
    });

    res.json({
      campaignSummary:
        parsed.campaignSummary ||
        (isMainOnlyScope
          ? `已完成 ${normalizedTasks.length} 张高点击商品主图方案拆解、文案排版规划与参考图智能绑定。`
          : `已完成竞品切片分析、整页统一视觉规范提取与 ${normalizedTasks.length} 屏详情页重策划任务生成（比例统一 ${detailTargetRatio}）。`),
      generatedFullPlanDoc: isMainOnlyScope
        ? existingFullPlanText
        : parsed.generatedFullPlanDoc || sanitizedExistingPlanText,
      unifiedVisualSpec: derivedUnifiedVisualSpec || (parsed.unifiedVisualSpec ? String(parsed.unifiedVisualSpec).trim() : ""),
      tasks: normalizedTasks,
      analyzedCaseScreens: isMultiScreenCaseSequence
        ? caseRefs.map((c, idx) => ({
            id: c.id,
            screenIndex: idx + 1,
            tag: c.tag,
            extractedLayoutDna: filterExtractedDnaByDimensions(
              c.extractedLayoutDna || "",
              c.caseDimensions,
              Boolean((c as any).isLockBaseSwap)
            ),
            subScreens: (c as any).detectedSubScreens,
          }))
        : undefined,
    });
  } catch (err: any) {
    console.error("Error in /api/agent/parse-plan:", err);
    res.status(500).json({
      error: err?.message || "Agent 生成与拆解详情页方案失败，请稍后重试。",
    });
  }
});

// Adapt Dynamic Screens (Screens 1~3 / Main Images) to a New SKU Pattern Image
// while keeping Static Screens (Screens 4~10) 100% locked & reusable!
app.post("/api/agent/adapt-new-sku", async (req, res) => {
  try {
    const {
      skuNameHint = "",
      productInfoText = "",
      skuPatternImages = [],
      dynamicTasks = [],
      agentModel = "gemini-4-argon",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      skuNameHint?: string;
      productInfoText?: string;
      skuPatternImages: {
        id: string;
        code: string;
        name: string;
        tag: string;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        ossObjectKey?: string;
        previewUrl?: string;
      }[];
      dynamicTasks: {
        id: string;
        screenNumber: number;
        title: string;
        sectionType: string;
        copywriting: string;
        typographyPlan: string;
        visualPrompt: string;
      }[];
      agentModel?: string;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!skuPatternImages.length || !dynamicTasks.length) {
      res.status(400).json({
        error: "请至少保留1张当前款式图案产品图与1个动态屏任务。",
      });
      return;
    }

    const parts: any[] = [
      {
        text: `你是一位精通「同模多花色 SKU 快速裂变」的淘宝视觉总监 Agent。
当前商品的基础硬件公模与核心卖点参数保持不变${productInfoText.trim() ? `（商品资料参考：${productInfoText.trim().slice(0, 300)}）` : ""}，仅更换了商品表面的【新款配色/印花图案】。
请仔细观察下方提供的【当前新款商品实拍图】，识别出：
1. 商品表面的花字口号或款式标识；
2. 商品表面的插画角色、花色纹理、主题色彩与情绪道具；
${skuNameHint ? `用户补充的新款名称/主题提示：${skuNameHint}` : ""}

然后，请仅针对下方传入的【动态屏任务列表（通常为第1屏专属KV、第3屏场景实拍及主图；若遇到第2屏为“多款图案合集矩阵屏”则保持其多款合集定位并把当前新款作为C位主推写入）】，使用**全简体中文**自动改写每屏的：
- \`copywriting\`（主标题与卖点摘要，融入新图案口号与主题名）
- \`typographyPlan\`（完整文案排版规划：⚠️必须100%保留原任务中的【顶部标头】品牌名与底部硬件参数标签，严禁将我方品牌标头篡改为参考图上的其他英文水印或异品名！仅将主副标题升级为新图案主题）
- \`visualPrompt\`（完整简体中文生图提示词：将商品图案描述、展台周围点缀的3D氛围小道具、生活桌面搭配道具、主色调联动替换为与新款图案匹配的主题！）`,
      },
    ];

    for (const img of skuPatternImages) {
      parts.push({
        text: `【新款产品图案实拍图 #${img.code} (${img.tag || img.name})】：`,
      });
      const resolvedImg = await resolveReferenceInlineImage(
        img as any,
        ossConfig
      );
      if (resolvedImg) {
        parts.push({
          inlineData: {
            mimeType: resolvedImg.mimeType,
            data: resolvedImg.data,
          },
        });
      }
    }

    parts.push({
      text: `【待改写的动态屏任务 JSON】：\n${JSON.stringify(dynamicTasks, null, 2)}`,
    });

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedSkuTheme: {
            type: Type.STRING,
            description: "识别出的新款图案名称、英文Slogan与匹配的3D氛围道具总结",
          },
          updatedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                copywriting: { type: Type.STRING },
                typographyPlan: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
              },
              required: [
                "id",
                "title",
                "copywriting",
                "typographyPlan",
                "visualPrompt",
              ],
            },
          },
        },
        required: ["detectedSkuTheme", "updatedTasks"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking: true,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON 对象，格式为: {"detectedSkuTheme": "新款主题总结", "updatedTasks": [{"id": "原任务id", "title": "新标题", "copywriting": "新摘要", "typographyPlan": "新排版规划", "visualPrompt": "新视觉提示词"}]}',
    });

    const parsed = safeParseJson(response.text || "{}");
    res.json({
      detectedSkuTheme: parsed.detectedSkuTheme || "已根据新款图案完成动态屏主题改写",
      updatedTasks: parsed.updatedTasks || [],
    });
  } catch (err: any) {
    console.error("Error in /api/agent/adapt-new-sku:", err);
    res.status(500).json({
      error: err?.message || "自动改写新款动态屏提示词失败",
    });
  }
});

// Batch E-Commerce SKU Image Orchestration:
// 1 SKU Task = 1 Product Image (#Prod) + Global Multi-Case Reference Images (#Case with style/structure/content/lighting dimensions) + Reference Info (Selling Points/Specs)
app.post("/api/agent/parse-sku-plan", async (req, res) => {
  try {
    const {
      productImages = [],
      caseImages = [],
      referenceInfoText = "",
      unifiedLayoutRule = "",
      skuDiffMode = "pattern_color",
      defaultAspectRatio = "1:1",
      defaultImageSize = "1K",
      textMode = "with_text",
      globalStylePrefix = "",
      agentModel = "gemini-4-argon",
      enableHighThinking = true,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      productImages: {
        id: string;
        code: string;
        name: string;
        tag: string;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        ossObjectKey?: string;
        previewUrl?: string;
      }[];
      caseImages: {
        id: string;
        code: string;
        name: string;
        tag: string;
        caseDimensions?: string[];
        caseCustomRule?: string;
        isLockBaseSwap?: boolean;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        ossObjectKey?: string;
        previewUrl?: string;
      }[];
      referenceInfoText?: string;
      unifiedLayoutRule?: string;
      skuDiffMode?: "pattern_color" | "model_spec" | "package_bundle";
      defaultAspectRatio?: string;
      defaultImageSize?: string;
      textMode?: "with_text" | "without_text";
      globalStylePrefix?: string;
      agentModel?: string;
      enableHighThinking?: boolean;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!productImages.length && !referenceInfoText.trim()) {
      res.status(400).json({
        error: "请至少勾选 1 张参与生成的产品图 (#Prod) 或填写 SKU 参考信息。",
      });
      return;
    }

    const parts: any[] = [];

    // 1. Feed Selected Product Images (#Prod-1..N) — 1 Product Image = 1 SKU Card
    if (productImages.length > 0) {
      parts.push({
        text: `=== 一、参与本次批量生成 SKU 图的【产品参考图 (#Prod)】共 ${productImages.length} 张（请为每一张产品图生成 1 个独立的 SKU 规格图任务，共 ${productImages.length} 个 SKU 任务） ===`,
      });
      for (let i = 0; i < productImages.length; i++) {
        const prod = productImages[i];
        parts.push({
          text: `【第 ${i + 1} 个 SKU 对应的产品图 | 编号: "${prod.code}" | ID: "${prod.id}" | 初始标签: ${prod.tag || prod.name}】`,
        });
        const resolvedImg = await resolveReferenceInlineImage(
          prod as any,
          ossConfig
        );
        if (resolvedImg) {
          parts.push({
            inlineData: {
              mimeType: resolvedImg.mimeType,
              data: resolvedImg.data,
            },
          });
        }
      }
    }

    // 2. Feed Globally Bound Benchmark Case Reference Images (#Case-1..M) with strict 6-dimension analysis extraction rules
    if (caseImages.length > 0) {
      parts.push({
        text: `=== 二、全局绑定的【SKU 参考案例图 (#Case)】共 ${caseImages.length} 张（请严格按每张案例图勾选的六个分析提取标签过滤提取维度，多案例按维度绑定来源与显式优先级，绝不整图混合；产品身份 100% 以自有 #Prod 为准，文案与参数以我方资料为准！） ===`,
      });
      for (const cImg of caseImages) {
        parts.push({
          text: buildSingleCaseDimensionInstruction(
            cImg,
            Boolean(cImg.isLockBaseSwap),
            "sku"
          ),
        });
        const resolvedImg = await resolveReferenceInlineImage(
          cImg as any,
          ossConfig
        );
        if (resolvedImg) {
          parts.push({
            inlineData: {
              mimeType: resolvedImg.mimeType,
              data: resolvedImg.data,
            },
          });
        }
      }
    }

    const hasMasterCase = caseImages.some((c) => isPromotedMasterCase(c));
    const masterCaseRef = caseImages.find((c) => isPromotedMasterCase(c));
    const masterCaseCode = masterCaseRef?.code
      ? `#${masterCaseRef.code.replace(/^#/, "")}`
      : "#Case-1";

    const diffModeInstruction =
      skuDiffMode === "model_spec"
        ? `【当前 SKU 差异主维度：外观/机型/配置高低区别】
- 请仔细观察每张 #Prod 产品图在外观造型、数显屏/按键结构、材质工艺或版本档次上的区别，结合【参考信息】提炼出每个 SKU 的机型版本名称（如“旗舰数显版”、“标准青春版”）与核心配置升级点；
- 全套 SKU 图须保持统一的背景色调、相同的版式框架，通过局部卖点胶囊角标或机身特征特写清晰呈现机型差异。`
        : skuDiffMode === "package_bundle"
        ? `【当前 SKU 差异主维度：包装/礼盒/配件套装区别】
- 请仔细观察每张 #Prod 产品图中的主机、礼盒包装、保护套、挂绳公仔或线材配件组合，结合【参考信息】提炼出每个 SKU 的套装名称（如“豪华礼盒全套”、“单机标配装”）与包含配件清单；
- 采用主次分明的前后景精致陈列构图，全套 SKU 保持相同的台面光影与角标版式。`
        : `【当前 SKU 差异主维度：款式/图案/花色区别（严锁统一版式 · 最高优先级）】
- 请仔细观察每张 #Prod 产品图表面独特的定制图案、插画角色、英文标语（如 SAY Cheese! / PEACHY DAY 等）与主题配色；
- **全套一致性铁律**：生成的全部 ${productImages.length || "各"} 张 SKU 提示词必须 100% 锁定完全相同的背景环境材质、相同的光影氛围、相同的展台造型、相同的柔和浅色胶囊底色与相同的文字角标坐标位置（画布顶部与四周保留至少8%呼吸安全留白，严禁文字贴边裁切）！仅替换产品表面的款式图案/颜色及对应的花色标题，确保买家在电商前台连续点击切换 SKU 时画面严丝合缝不跳动！${
            hasMasterCase
              ? `\n- **🔒【首卡定标母版 (${masterCaseCode}) 强制统一背景与胶囊词】**：当前已绑定首卡定标母版 ${masterCaseCode}！在编写所有 SKU 卡片的 \`visualPrompt\` 时，背景、展台与卖点胶囊颜色必须 100% 统一锁定为：“背景、光影与展台底座 100% 像素级锁底复刻 ${masterCaseCode} 首卡定标母版原图的背景色相渐变与展台几何造型材质（严禁改变背景冷暖色调，严禁在展台添加母版不存在的发光灯带或流光轨）；卖点胶囊标签与 ${masterCaseCode} 母版完全相同坐标、圆角与完全相同的胶囊底色（严禁将胶囊底色改为高饱和艳色或深色）”。各张卡片的 \`visualPrompt\` 之间除商品本体描述与款式标题文字外，其余背景/展台/胶囊描述词必须 100% 字字相同！`
              : ""
          }`;

    const textModeInstruction =
      textMode === "with_text"
        ? `【含文字排版直出模式】：每个 SKU 任务不仅要输出结构化的 \`typographyPlan\`（主标题、核心功能卖点胶囊角标、规格/配件说明及位置坐标），而且必须在 \`visualPrompt\` 中把该 SKU 的具体主标题文字、卖点角标文字及版式位置完整写进去，让生图模型直接渲染出图文并茂的电商高转化 SKU 规格图！`
        : `【无文字纯视觉底图模式】：每个 SKU 任务同样须输出结构化的 \`typographyPlan\` 供美工参考；但在 \`visualPrompt\` 中请仅描述纯粹的商业棚拍背景、光影与产品形态，并根据排版位置明确预留干净的标题/角标留白区，画面内严禁生成任何文字或水印。`;

    const layoutAuthorityDirective = buildMultiCaseSynthesisDirective(
      caseImages,
      unifiedLayoutRule,
      "sku"
    );

    const skuPromptInstruction = `
你是一位顶级的淘宝/天猫/拼多多电商 SKU 规格图视觉总监 Agent。
请结合上方的【自有产品参考图 (#Prod)】、【全局参考案例图 (#Case) 及其六个分析提取维度】以及下方的【自有参考资料（核心卖点/功能参数/规格说明）】，为每一张产品参考图精准规划并生成对应的 SKU 规格图任务（若上传了 N 张 #Prod 产品图，则严格输出 N 个 SKU 任务，且顺序一一对应）：

1. ${diffModeInstruction}
2. **【核心准则 · 六维分析提取过滤与多案例按维度绑定来源】**：
   - **六个标签仅控制分析阶段的信息提取范围**（选中表示允许从该案例提取对应维度，未选中表示不从该案例提取该维度，不代表锁定不变；全部选中也不等于照搬整图，除非显式开启「锁底换款」）：
     * **「主体姿态(pose)」**：选中仅提取朝向、摆放及主配件组合关系，绝不继承竞品身份和外形；未选中则不从该案例提取姿态，结合自有产品 #Prod 自主规划最佳展示角度。无论是否勾选，**产品身份与外观花色 100% 以自有 #Prod 为准**！
     * **「环境背景(style)」**：选中仅提取场景类型、材质倾向与造型语言，具体布景重新设计（不照搬竞品具体道具物件）；未选中则绝不从该案例提取任何背景或场景元素。
     * **「版式骨架(structure)」**：选中仅提取信息分区、主次层级、图文占比和留白规律，不复制元素像素坐标及完整构图；未选中则不从该案例提取构图分区。
     * **「文案版式(content)」**：选中仅提取字体性格、字号层级、对齐方式和间距规律，绝不提取案例文字内容；未选中则不从该案例提取字体排版样式。
     * **「文案内容(copy_text)」**：选中仅提取卖点主题和表达结构，必须依据我方自有产品资料重写（用户指定文案优先），绝不移植竞品参数与承诺；未选中则完全依据我方自有资料撰写。
     * **「光影色调(lighting)」**：选中仅提取光向、软硬、明暗反差及色彩关系，不继承案例场景物件；未选中则不从该案例提取光影与色温。
   - **多案例按维度绑定来源与显式优先级**：当存在多张 #Case 时，每个维度严格按「主来源 > 辅参考」提取，避免整图混合；严禁把未勾选「环境背景/光影色调」的案例图的背景颜色或道具写入 \`visualPrompt\`。
   - **「+约束」作为独立规则处理**：若案例带有独立补充约束，必须最高优先级严格执行。
3. **指定主副标题与卖点精准落地（用户指定文案与自有资料优先，主副标题上下两行独立排布）**：
   - 若用户在【参考信息】中指定了各款 SKU 的主标题与副标题（例如第1行主标题与第2行副标题），必须 **100% 优先采用用户指定的文字与型号编码**，并在 \`typographyPlan\` 和 \`visualPrompt\` 中明确规划为**上下两行独立排布**（第1行：大号粗体主标题“...”；第2行：位于主标题正下方的副标题“...”），切勿将主标题与副标题拼在同一行水平并排！
   - 将用户填写的【参考信息】中的核心功能卖点或包装配件说明提炼成简短有力的电商 SKU 卖点角标 (\`sellingPointBadge\`) 与配件小字 (\`packageSpecNote\`)，严禁移植竞品参数与承诺。
4. **文字渲染要求**：
   - ${textModeInstruction}

【全套统一视觉规范与多案例六维提取指令】：
${layoutAuthorityDirective}

【全局画风要求】：
${globalStylePrefix || "8K商业级电商广告摄影，产品材质纹理与印花细节真实锐利"}

【三、我方自有参考资料（产品核心卖点 / 功能参数 / 款式机型或包装说明 · 唯一文案与参数权威）】：
"""
${referenceInfoText || "（请根据每张 #Prod 产品图自动识别其款式图案、配色、机型外观或包装特征，并提炼高转化电商 SKU 标题与卖点角标）"}
"""
`;

    parts.push({ text: skuPromptInstruction });

    const config: any = {
      systemInstruction:
        "你是顶级的电商 SKU 规格图批量编排 Agent。你必须严格遵循每张 #Case 案例图勾选的六个分析提取维度（主体姿态、环境背景、版式骨架、文案版式、文案内容、光影色调），按选中标签过滤提取结果，未选中维度绝不从该案例提取；多案例按维度绑定来源避免整图混合；产品身份100%以自有 #Prod 实拍图为准，文案与参数100%以自有资料与用户指定文案为准，“+约束”作为独立规则优先执行。",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          skuBatchSummary: {
            type: Type.STRING,
            description: "本次全套 SKU 规格图按六维标签提取的统一视觉规范（明确各维度来源案例）与各款差异点的一句话总结",
          },
          skuTasks: {
            type: Type.ARRAY,
            description: "与每张 #Prod 产品图一一对应的 SKU 生图任务列表",
            items: {
              type: Type.OBJECT,
              properties: {
                skuIndex: {
                  type: Type.INTEGER,
                  description: "SKU 序号，从 1 开始递增",
                },
                productRefId: {
                  type: Type.STRING,
                  description: "对应绑定的 #Prod 产品图 ID 或编号（如 Prod-1）",
                },
                skuTitle: {
                  type: Type.STRING,
                  description: "SKU 款式/机型/包装主副标题，如：TWS328-C1 / 耳朵先生IP限定款",
                },
                sellingPointBadge: {
                  type: Type.STRING,
                  description: "图内核心卖点或功能角标文案，如：SAY Cheese! ｜ 蓝牙6.0 ｜ 13mm动圈",
                },
                packageSpecNote: {
                  type: Type.STRING,
                  description: "外观机型特征或包装配件组合说明，如：充电仓+双耳+定制挂件礼盒",
                },
                typographyPlan: {
                  type: Type.STRING,
                  description: "完整的 SKU 图内文案排版规划（必须全程使用简体中文！格式包含：第1行大字主标题“...”与正下方第2行副标题“...”上下两行排布、卖点角标样式、配件小字位置及留白说明，主副标题文案请统一用中文双引号“...”包裹）",
                },
                visualPrompt: {
                  type: Type.STRING,
                  description: "完整的 AI 生图视觉提示词（必须100%全程使用简体中文自然段撰写，严禁输出英文句子！严格按选中六维标签过滤并重策划：产品身份100%以 #Prod 为准，文案与参数以我方资料为准，严禁混入未选中维度的案例特征；引用第1行主标题“...”与第2行副标题“...”时请统一使用中文双引号包裹）",
                },
              },
              required: [
                "skuIndex",
                "productRefId",
                "skuTitle",
                "sellingPointBadge",
                "packageSpecNote",
                "typographyPlan",
                "visualPrompt",
              ],
            },
          },
        },
        required: ["skuBatchSummary", "skuTasks"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON 对象，包含字段: skuBatchSummary (字符串), skuTasks (数组，每项含 skuIndex, productRefId, skuTitle, sellingPointBadge, packageSpecNote, typographyPlan, visualPrompt)。',
    });

    const parsed = safeParseJson(response.text || "{}");
    const globalCaseIds = caseImages.map((c) => c.id);

    const stripLeadingSubtitleSlash = (text: string): string => {
      if (!text) return "";
      return text
        .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, "$1")
        .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, "$1");
    };

    const rawTasks: any[] = Array.isArray(parsed.skuTasks) ? parsed.skuTasks : [];
    const targetCount = Math.max(productImages.length, rawTasks.length);
    const normalizedSkuTasks = Array.from({ length: targetCount }, (_, idx) => {
      const prodImg = productImages[idx];
      const matchedRaw =
        (prodImg
          ? rawTasks.find(
              (rt) =>
                resolveCanonicalRefId(rt?.productRefId, productImages) ===
                prodImg.id
            )
          : undefined) ||
        rawTasks[idx] ||
        rawTasks[0] ||
        {};

      const matchedProdId =
        prodImg?.id ||
        resolveCanonicalRefId(matchedRaw.productRefId, productImages) ||
        productImages[0]?.id ||
        "";

      const fallbackTitle =
        matchedRaw.skuTitle || prodImg?.tag || `SKU 规格 #${idx + 1}`;
      const fallbackBadge = matchedRaw.sellingPointBadge || "";
      const fallbackNote = matchedRaw.packageSpecNote || "";

      return {
        id: `sku-task-${Date.now()}-${idx + 1}`,
        skuIndex: idx + 1,
        skuDiffMode,
        skuTitle: fallbackTitle,
        sellingPointBadge: fallbackBadge,
        packageSpecNote: fallbackNote,
        typographyPlan: stripLeadingSubtitleSlash(
          matchedRaw.typographyPlan ||
            `顶部规格主标题：${fallbackTitle}\n卖点角标：${fallbackBadge}`
        ),
        visualPrompt: stripLeadingSubtitleSlash(matchedRaw.visualPrompt || ""),
        textMode,
        productRefIds: matchedProdId ? [matchedProdId] : [],
        caseRefIds: [...globalCaseIds],
        aspectRatio: defaultAspectRatio || "1:1",
        imageSize: defaultImageSize || "1K",
        status: "idle",
        historyImages: [],
      };
    });

    res.json({
      skuBatchSummary:
        parsed.skuBatchSummary ||
        `已完成 ${normalizedSkuTasks.length} 张电商 SKU 规格图的对标版式锁定与提示词编排。`,
      skuTasks: normalizedSkuTasks,
    });
  } catch (err: any) {
    console.error("Error in /api/agent/parse-sku-plan:", err);
    res.status(500).json({
      error: err?.message || "AI 批量编排 SKU 规格图方案失败，请稍后重试。",
    });
  }
});

// Step 4c: Reverse-extract structured layout rule from bound #Case benchmark images
app.post("/api/agent/extract-case-layout", async (req, res) => {
  try {
    const {
      caseImages = [],
      skuDiffMode = "pattern_color",
      agentModel = "gemini-4-argon",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      caseImages: {
        id: string;
        code: string;
        name: string;
        tag: string;
        caseDimensions?: string[];
        caseCustomRule?: string;
        isLockBaseSwap?: boolean;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        ossObjectKey?: string;
        previewUrl?: string;
      }[];
      skuDiffMode?: string;
      agentModel?: string;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!Array.isArray(caseImages) || caseImages.length === 0) {
      res.status(400).json({
        error: "请先在「01. 核心对标 #Case」上传并勾选至少 1 张对标参考图。",
      });
      return;
    }

    const parts: any[] = [];
    for (const cImg of caseImages.slice(0, 4)) {
      parts.push({
        text: buildSingleCaseDimensionInstruction(
          cImg,
          Boolean(cImg.isLockBaseSwap),
          "sku"
        ),
      });
      const resolved = await resolveReferenceInlineImage(
        cImg as any,
        ossConfig
      );
      if (resolved) {
        parts.push({
          inlineData: {
            mimeType: resolved.mimeType,
            data: resolved.data,
          },
        });
      }
    }

    parts.push({
      text: `请作为资深电商视觉导演，仔细观察上方上传的【参考案例图 (#Case) 及其勾选的六个分析提取维度】，按选中标签过滤提取出一份精炼、客观、可直接用于全套 SKU 统一风格的【全套统一视觉规范与排版快照】（控制在 90~160 字以内，纯文本直接输出，不要标题或寒暄）。
${buildMultiCaseSynthesisDirective(caseImages, undefined, "sku")}
必须准确涵盖以下 4 点（严格按各 #Case 选中标签过滤提取，未选中维度绝不从该案例提取，全部选中也不照搬具体道具坐标）：
1. **画幅信息分区与主体摆位**（仅从勾选了「版式骨架 / 主体姿态」的 #Case 提取：如信息分区、图文占比、留白规律与主体组合关系，不复制像素坐标）；
2. **环境材质语言与光影色调**（仅从勾选了「环境背景 / 光影色调」的 #Case 提取场景类型、材质倾向、光向软硬与色彩关系，具体布景重新设计，不照搬竞品道具）；
3. **文字与卖点版式层级**（仅从勾选了「文案版式 / 文案内容」的 #Case 提取字体性格、字号层级、对齐间距与卖点表达结构，不提取竞品文字内容）；
4. **自有产品身份权威声明**：固定附带一句“商品身份与外观造型 100% 以各自自有 #Prod 实拍图为准，文案与参数以我方资料为准”。`,
    });

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      enableHighThinking: false,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
    });

    res.json({
      extractedLayoutRule: (response.text || "").trim(),
    });
  } catch (err: any) {
    console.error("Error in /api/agent/extract-case-layout:", err);
    res.status(500).json({
      error: err?.message || "从对标案例图提取版式失败，请稍后重试。",
    });
  }
});

app.post("/api/agent/polish-prompt", async (req, res) => {
  try {
    const {
      title,
      benchmarkCase,
      typographyPlan,
      currentPrompt,
      textMode = "with_text",
      layerType = "dynamic",
      productInfoText = "",
      boundRefSummary = "",
      globalStylePrefix,
      agentModel = "gemini-4-argon",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
    } = req.body;

    const modeRule =
      textMode === "with_text"
        ? "当前要求【含文字排版直出】：请务必将【文案排版规划】中的顶部标头、主标题、副标题/卖点标签、底部参数胶囊卡片等文字内容及其版式位置（如顶部轻奢居中标头、醒目主标题、底部圆角胶囊卡片）完整编排进提示词中，使生图模型直接渲染出图文并茂的商业详情页海报。"
        : "当前要求【无文字纯视觉底图】：请勿在画面中渲染文字，但需根据【文案排版规划】的布局位置（如顶部25%标题区、底部20%胶囊卡片区）在画面中预留干净细腻的排版留白空间。";

    const layerRule =
      layerType === "static"
        ? "【重要 · 分屏图层属性为「🔒静态通用公模屏」】：请将产品形态改写为中性纯白/基础公模侧背视角、局部材质特写或内部声学结构拆解展示，严禁露出特定花色的正面定制印花图案，确保该屏在 1000+ 款不同花色切换时 100% 通用复用。"
        : `【重要 · 分屏图层属性为「⚡动态款式专属屏」】：请彻底删除原提示词中任何关于“纯白单耳/中性白壳侧背视角”、“不露具体正面图案”、“去印花通用公模”的限制描述！必须将产品形态明确改写为：在核心主体位置清晰展示当前主推款商品的真实正面外观、专属配色与定制印花图案细节${
            boundRefSummary
              ? `（当前绑定商品参考图特征：${boundRefSummary}）`
              : productInfoText
                ? `（当前商品信息参考：${productInfoText.slice(0, 180)}）`
                : ""
          }。`;

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts: [
        {
          text: `请作为资深淘宝/天猫视觉导演，使用【全简体中文】（严禁将提示词翻译为英文句子！）优化并扩充以下单屏生图提示词，使其在图像生成模型中呈现出8K商业级光影、精准自有产品形态细节与高级重策划构图。直接返回优化后的简体中文提示词纯文本，不要任何多余寒暄。
分屏标题：${title}
参考案例六维分析提取规范与整页统一视觉规范（严格服从其中的已选中允许提取维度 ✅ 与未选中不提取维度 ⛔；除显式开启「锁底换款」外，保持整页风格统一并重新设计具体背景布景与排版布局，清除任何照搬竞品具体道具或旧文字的描述；独立「+约束」优先执行）：
${benchmarkCase || "旗舰店高转化详情页"}
全局风格调性：${globalStylePrefix || "高级商业电商视觉"}
分屏动静图层要求：${layerRule}
文案排版规划（文案与参数100%以我方自有资料与用户指定文案为准，严禁移植任何竞品参数或文字，引用主标题与副标题时请统一用中文双引号“...”包裹）：
${typographyPlan}
文字渲染模式要求：${modeRule}
原视觉提示词：
${currentPrompt}`,
        },
      ],
      enableHighThinking: true,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
    });

    res.json({
      polishedPrompt: (response.text || currentPrompt).trim(),
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || "提示词润色失败",
    });
  }
});

/**
 * Helper to fetch a remote image URL and convert it to a Base64 Data URL
 * so client-side Canvas stitching & ZIP packaging never encounter CORS errors.
 */
async function convertRemoteUrlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:image/")) return url;
  if (!isSafeRemoteHttpUrl(url)) {
    throw new Error("不安全或不支持的远程图片 URL 协议");
  }
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(25000),
  });
  if (!resp.ok) {
    throw new Error(`拉取远程生成图片失败 (${resp.status})`);
  }
  const contentType = resp.headers.get("content-type") || "image/png";
  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

/**
 * Calls an OpenAI-compatible image generation endpoint (/v1/images/generations)
 * or falls back to /v1/chat/completions for chat-wrapped image models (e.g. gpt-4o-image / NewAPI gemini-image).
 */
async function callOpenAiCompatibleImage(options: {
  endpoint: NormalizedEndpointInfo;
  imageModel: string;
  finalPrompt: string;
  parts: any[];
  aspectRatio: string;
  customApiKey?: string;
  customHeaders?: string;
}): Promise<{ imageUrl: string; textNote: string; protocolUsed: string }> {
  const {
    endpoint,
    imageModel,
    finalPrompt,
    parts,
    aspectRatio,
    customApiKey,
    customHeaders,
  } = options;
  const apiKey =
    (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || "";
  const extraHeaders = parseCustomHeaders(customHeaders);

  const sizeMap: Record<string, string> = {
    "1:1": "1024x1024",
    "9:16": "1024x1792",
    "3:4": "1024x1536",
    "4:3": "1536x1024",
    "16:9": "1792x1024",
    "1:4": "1024x1792",
    "4:1": "1792x1024",
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "aistudio-build",
    ...extraHeaders,
  };
  if (apiKey) {
    if (!headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    if (!headers["x-goog-api-key"]) {
      headers["x-goog-api-key"] = apiKey;
    }
  }

  const hasInlineImages = Array.isArray(parts) && parts.some((p: any) => Boolean(p?.inlineData?.data));

  const tryOpenAiImagesEndpoint = async () => {
    if (/\/chat\/completions\/?$/i.test(endpoint.rawUrl)) return null;
    try {
      const imgRes = await fetch(endpoint.openAiImageUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: imageModel,
          prompt: finalPrompt,
          n: 1,
          size: sizeMap[aspectRatio] || "1024x1024",
        }),
      });

      if (imgRes.ok) {
        const imgData: any = await imgRes.json();
        const firstItem = imgData?.data?.[0];
        if (firstItem?.b64_json) {
          return {
            imageUrl: `data:image/png;base64,${firstItem.b64_json}`,
            textNote: firstItem.revised_prompt || "",
            protocolUsed: "openai-images",
          };
        }
        if (firstItem?.url) {
          const dataUrl = await convertRemoteUrlToDataUrl(firstItem.url);
          return {
            imageUrl: dataUrl,
            textNote: firstItem.revised_prompt || "",
            protocolUsed: "openai-images",
          };
        }
      }
    } catch {
      // Ignore and fall through
    }
    return null;
  };

  const tryOpenAiMultimodalChatImage = async () => {
    const chatReply = await callOpenAiCompatibleChat({
      endpoint,
      model: imageModel,
      parts,
      customApiKey,
      customHeaders,
    });

    const dataUrlMatch = chatReply.match(
      /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/
    );
    if (dataUrlMatch) {
      return {
        imageUrl: dataUrlMatch[0],
        textNote: "",
        protocolUsed: "openai-chat-image",
      };
    }

    const mdUrlMatch =
      chatReply.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i) ||
      chatReply.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp)[^\s"'<>]*)/i);
    if (mdUrlMatch?.[1]) {
      const dataUrl = await convertRemoteUrlToDataUrl(mdUrlMatch[1]);
      return {
        imageUrl: dataUrl,
        textNote: "",
        protocolUsed: "openai-chat-image",
      };
    }
    return { errorReply: chatReply };
  };

  // When reference images (#Prod / #Case) are present, prioritize multimodal chat endpoint first so reference images are not dropped by text-only /v1/images/generations
  if (hasInlineImages) {
    try {
      const chatRes = await tryOpenAiMultimodalChatImage();
      if ("imageUrl" in chatRes && chatRes.imageUrl) {
        return chatRes;
      }
    } catch {
      // Fall through to /v1/images/generations if chat endpoint fails
    }
    const imgFallback = await tryOpenAiImagesEndpoint();
    if (imgFallback) return imgFallback;
  } else {
    const imgPrimary = await tryOpenAiImagesEndpoint();
    if (imgPrimary) return imgPrimary;
  }

  const finalChatRes = await tryOpenAiMultimodalChatImage();
  if ("imageUrl" in finalChatRes && finalChatRes.imageUrl) {
    return finalChatRes;
  }

  throw new Error(
    `OpenAI 兼容生图端点未返回有效图像数据: ${(finalChatRes.errorReply || "").slice(0, 120)}`
  );
}

// ==================== NEW SIMPLIFIED MODULAR DETAIL & REPLICA ENDPOINTS ====================

const SERVER_MODULE_SKELETONS: Record<string, string> = {
  kv_hero:
    "【首屏主视觉海报 (KV)】：上部22%为清晰的品牌主副标题区，中部58%为核心商品主视觉高光立体展台特写（100%严格还原#Prod商品真实外观、比例、Logo与表面图案，零形变），下部20%为3个规整的卖点胶囊/图标卡片区。",
  selling_point:
    "【核心卖点深度解析屏】：顶部为醒目的核心卖点主副标题，画面中央聚焦#Prod商品的核心部位特写或功能体验场景，辅以直观的品质感视觉表现，底部配量化卖点印证卡片。",
  series_matrix:
    "【系列展示 / 多色或多SKU合集屏】：顶部居中排布系列主题主副标题，画面中段采用对称几何阶梯展台或规整矩阵网格，整齐陈列所提供的#Prod各款式商品，每款下方配清晰的款式名称标签，全图色调和谐统一。",
  spec_table:
    "【详细规格 / 参数表屏】：上部或左侧展示#Prod商品的干净正侧立面实物与尺寸比例标注，下部或右侧为结构极其规整、对齐严谨的现代商业规格参数对照表格，浅色清爽信息框，文字层级清晰易读。",
  package_contents:
    "【配件 / 赠品全家福清单屏（明确收货物品）】：顶部为“包装清单 · 收货明细”主副标题，画面中央在纯净高质感台面上整齐平铺/阶梯陈列#Prod商品主机、配套附件、说明书、包装盒与赠品，每件物品旁标注清晰的名称与数量（如×1）。",
  usage_tips:
    "【使用建议 / 注意事项屏】：顶部为“使用建议与日常注意事项”主标题，画面中段采用清晰的Step 1 / Step 2 / Step 3分步图文卡片或模块化注意事项框，结合#Prod商品示范与简洁图标，直观传达正确用法与保养提示。",
  after_sales:
    "【售后保障政策屏】：顶部为极具信赖感的官方售后保障主标题，画面结合精致的#Prod商品品质特写与规整的4项服务承诺卡片（官方正品保障、无忧退换政策、质保服务承诺、专属售后响应），版式庄重清爽。",
  custom:
    "【自定义主题详情屏】：保持整页统一视觉规范，上部为清晰主副标题区，中部突出#Prod自有商品主体，下部为辅助卖点说明，四周保留充足呼吸留白。",
};

// 1. Extract Clean Unified Visual Spec from Competitor Reference Images (Analysis Only, Never Passed to Image Render)
app.post("/api/detail/extract-style", async (req, res) => {
  try {
    const {
      caseImages = [],
      productImages = [],
      productInfoText = "",
      agentModel = "gemini-4-argon",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      caseImages: any[];
      productImages?: any[];
      productInfoText?: string;
      agentModel?: string;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!Array.isArray(caseImages) || caseImages.length === 0) {
      res.status(400).json({ error: "请先上传至少 1 张竞品对标参考图。" });
      return;
    }

    const parts: any[] = [
      {
        text: `你是一位顶尖电商设计系统架构师。请仔细观察以下上传的竞品对标参考图（#Case）以及我方自有产品原图（#Prod），提炼出一份零废话、高信息密度的《整页统一视觉规范（6大物理锚点卡）》，用于在不传入竞品原图的前提下，跨屏锁死整套详情页的色调、展台质感与版式一致性。

核心提取铁律：
1. 【真实取色与主客体色相校准】：
   - 请先准确读取竞品参考图（#Case）的真实背景主色调、材质肌理与明度氛围（例如：若竞品是暖米杏色/奶油香槟色柔光丝绸与磨砂展台，必须如实提取其暖米杏/奶油白/暖金棕高级色板，绝对禁止凭空臆造完全无关的死亡芭比粉或刺眼荧光色！）；
   - 同时观察我方自有产品图（#Prod）的机身颜色与壳面印花色调，使整页 60-30-10 色板既还原对标参考图的高级光影明度关系，又与我方产品外观和谐相融。
2. 【严格输出6大物理锚点（拒绝空洞套话，只写具体材质、方位、色名与HEX色号，总字数控制在180~220字）】：
   - ① 60-30-10色板锚点：背景主色(60%具体色名+HEX渐变) + 展台/信息框辅色(30%材质色+HEX) + 强调色(10%色名+HEX)；
   - ② 展台与空间材质锚点：全页统一主承载展台材质与几何形态（如温润奶油磨砂圆台/丝绸褶皱台面/哑光亚克力底座）+ 同色系微缩点缀元素；
   - ③ 布光方位与色温阴影：主光角度+色温K值+轮廓光位置+台面柔和投影；
   - ④ 字体层级与色号锚点：主标题字体风格与深色色号 + 副标题圆角贴纸底色与字色；
   - ⑤ 底部信息卡片规范：底部卖点信息框的圆角矩形样式、浅奶油/半透明毛玻璃底色与细描边（注意：描述UI框时请统一称作“圆角矩形卖点卡片”或“圆角标签框”，严禁使用“胶囊”二字以免生图模型误画成医药胶囊颗粒！）；
   - ⑥ 画面构图比例：左右安全留白占比 + 上部标题区(22%) / 中部产品展示核心区(54%) / 下部圆角卖点卡片区(24%)。
3. 语言笃定正向，绝对不要出现竞品品牌名（如迪士尼/Disney/Mickey等）、不要出现“#Prod/#Case”编号，也不要写“不要XX”等否定词。`,
      },
    ];

    for (const prod of (productImages || []).slice(0, 3)) {
      const resolved = await resolveReferenceInlineImage(prod, ossConfig);
      if (resolved) {
        parts.push({
          text: `【我方自有产品原图（用于校准产品机身与印花色调协调性）】`,
        });
        parts.push({ inlineData: resolved });
      }
    }

    for (const c of caseImages.slice(0, 4)) {
      const resolved = await resolveReferenceInlineImage(c, ossConfig);
      if (resolved) {
        parts.push({ text: `【对标视觉风格与色调参考图（请如实提取其背景色温、台面材质与版式层级）】` });
        parts.push({ inlineData: resolved });
      }
    }

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          unifiedVisualSpec: { type: Type.STRING },
          dominantPalette: { type: Type.STRING },
        },
        required: ["unifiedVisualSpec"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking: false,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON 格式：{"unifiedVisualSpec": "【① 60-30-10色板锚点】...；【② 展台与空间材质锚点】...；【③ 布光方位与色温阴影】...；【④ 字体层级与色号锚点】...；【⑤ 底部圆角信息卡片规范】...；【⑥ 画面三段式构图比例】...", "dominantPalette": "主色调描述"}',
    });

    const parsed = safeParseJson(response.text || "{}");
    const spec =
      (parsed.unifiedVisualSpec || "").trim() ||
      "【① 60-30-10色板锚点】背景主色(60%)柔和奶白至浅暖米渐变(#FAF7F2→#F0EAE1)，展台与卡片辅色(30%)磨砂云朵白(#FFFFFF)，强调色(10%)琥珀暖棕(#4A3525)；【② 展台与空间材质锚点】圆润倒角哑光磨砂几何展台，配同色系立体微缩装饰物；【③ 布光方位与色温阴影】左上方45° 5200K柔光箱主光配右侧清透轮廓光，台面呈柔和浅暖灰漫反射短阴影；【④ 字体层级与色号锚点】主标题现代圆体粗黑字(#2C1E16)，副标题中灰棕(#6E5A4F)；【⑤ 底部圆角信息卡片规范】统一16px大圆角矩形信息卡片，浅暖米白半透明磨砂底配1px高光细描边；【⑥ 画面三段式构图比例】左右留白10%，上部20%标题留白区+中部55%产品核心展示区+下部25%圆角矩形卖点卡片区。";

    res.json({
      unifiedVisualSpec: spec,
      dominantPalette: parsed.dominantPalette || "",
    });
  } catch (err: any) {
    console.error("Error in /api/detail/extract-style:", err);
    res.status(500).json({
      error: err?.message || "提取整页视觉规范失败",
    });
  }
});

// 2. One-Click AI Copywriting & Visual Prompt Planner for Preset Detail Modules
app.post("/api/detail/plan-modules", async (req, res) => {
  try {
    const {
      productImages = [],
      productInfoText = "",
      unifiedVisualSpec = "",
      modules = [],
      agentModel = "gemini-4-argon",
      enableHighThinking = true,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      productImages: any[];
      productInfoText: string;
      unifiedVisualSpec: string;
      modules: {
        id: string;
        screenNumber: number;
        moduleType: string;
        title: string;
        userNote?: string;
        referenceImageIds?: string[];
        boundProductIds?: string[];
      }[];
      textMode?: "with_text" | "without_text";
      aspectRatio?: string;
      agentModel?: string;
      enableHighThinking?: boolean;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!Array.isArray(modules) || modules.length === 0) {
      res.status(400).json({ error: "请先添加至少 1 个详情页模块。" });
      return;
    }

    const parts: any[] = [];
    for (const prod of (productImages || []).slice(0, 12)) {
      const resolved = await resolveReferenceInlineImage(prod, ossConfig);
      if (resolved) {
        parts.push({
          text: `【我方自有产品实拍图 ID="${prod.id}" | 当前视角标注="${prod.prodAngleRole || "待视觉识别"}" | 文件名/标签="${prod.tag || prod.name}"】`,
        });
        parts.push({ inlineData: resolved });
      }
    }

    const moduleListDesc = modules
      .map((m, idx) => {
        const skel =
          SERVER_MODULE_SKELETONS[m.moduleType] ||
          SERVER_MODULE_SKELETONS.custom;
        const boundIds = m.boundProductIds || m.referenceImageIds || [];
        const boundProdLabels = (productImages || [])
          .filter((p) => boundIds.length === 0 || boundIds.includes(p.id))
          .map((p) => `(ID:"${p.id}", 描述:${p.tag || p.name})`)
          .join("、");
        return `第 ${idx + 1} 屏 (ID: "${m.id}") | 模块类型: ${m.moduleType} (${m.title}) | 当前候选产品图: ${boundProdLabels || "默认待智能编排"} | 用户的本屏备注要求: "${m.userNote || "无"}" | 推荐构图骨架: ${skel}`;
      })
      .join("\n");

    const promptInstruction = `你是一位顶尖天猫/京东品牌详情页总导演。请先用视觉能力仔细识别上方每一张我方自有产品图（ID）的【真实拍摄视角/内容角色】（如：hero_front 正面主视图、open_case 开盖含双耳图、single_earbud 单只耳机特写图、detail_closeup 局部材质/充电微距图、multi_sku 多花色合集图、package_accessory 包装配件图）以及壳面上的【卡通印花图案主题】，再结合产品核心资料与《整页统一视觉规范》，输出每个产品图的视角识别结果 \`detectedProdRoles\`，并为 ${modules.length} 个详情页分屏模块逐屏生成高转化率的【3行结构化屏内文案（typographyPlan）】、【智能匹配的本屏产品图ID列表（boundProductIds）】、【全页统一色板的印花4维配方（printThemeConfig）】与【高稳定性生图画面描述（visualPrompt）】。

【一、我方产品核心资料】：
${productInfoText.trim() || "请直接根据上传的自有产品实拍图识别产品品类、外观特征、壳面卡通印花故事、材质细节与核心卖点。"}

【二、整页统一视觉规范（全屏必须严格统一遵循同一套背景色板与UI卡片风格，严禁第1屏粉色、第2屏突然变成薄荷绿！）】：
${unifiedVisualSpec.trim() || "现代高质感商业摄影棚拍，极简几何展台，柔和立体布光，全页色温与主辅色调高度统一，现代无衬线字体清晰排版，四周保留8%安全留白。"}

【三、待策划的分屏模块列表（共 ${modules.length} 屏）】：
${moduleListDesc}

【四、输出硬性标准（极其重要，直接决定生图质量）】：
1. \`detectedProdRoles\`：对上方每一张产品图输出其真实 \`id\`、\`prodAngleRole\`（严格从 hero_front, open_case, single_earbud, detail_closeup, multi_sku, package_accessory 中选一）以及简短直观的中文角度描述 \`tag\`（如 "充电仓正面主视"、"开盖露双耳"、"双耳悬浮特写"、"充电仓底部接口"），方便用户在界面上一眼看清每张图是什么角度。
2. \`boundProductIds\`（为每屏精准挑选 1~2 张最契合该屏主题的产品图 \`id\`，切勿盲目塞入过多同质角度）：
   - \`kv_hero\`（首屏KV）：精选 1~2 张（如 1张正面主视图 + 1张开盖含双耳图），展现1个充电仓主体配1对耳机的完整首屏形象；
   - \`selling_point\`（核心卖点屏）：若讲“声学音质/佩戴舒适”，优先选「单耳特写图 + 开盖图」（1~2张）；若讲“续航/闪充”，优先选「开盖含电量灯图 或 底部充电口图」（1~2张）；
   - \`series_matrix\`（系列/多SKU展示屏）：勾选不同花色/款式的产品图 ID；
   - \`package_contents\` / \`spec_table\` / \`after_sales\`：精选 1 张最端正清晰的正面主视图或包装图 ID。
3. \`typographyPlan\`（⚠️必须严格采用【三行纯文本换行格式】，供前端自动填入「主标题 / 副标题 / 底部标签卡」三个独立输入框）：
   - 第 1 行：仅写本屏主标题文字（⛔严禁带 "主标题：" 前缀，严禁把副标题用分号写在同一行！如：\`Ear'sir 芝士火箭鼠系列\`）；
   - 第 2 行：仅写本屏副标题文字（⛔严禁带 "副标题：" 前缀！如：\`蓝牙6.0旗舰芯片 · 360°全景立体声效\`）；
   - 第 3 行：底部圆角矩形卖点卡片文字，多个卖点之间用 \` | \` 分隔（⛔严禁带 "卖点：" 前缀，⛔绝对禁止加方括号 \`[\` \`]\`！例如写：\`ENC智能通话降噪 | 40ms超低游戏延迟 | 20H持久复合续航\`）。
4. \`printThemeConfig\`（全页跨屏视觉一致性锁）：
   - 所有分屏的 \`themePalette\`（60-30-10色板）和 \`themeUiStyle\` 必须与《整页统一视觉规范》及产品印花主题 **100%保持同一色系**（例如全页统一为暖米杏芝士黄系，或全页统一为柔光奶油粉系，绝对禁止第1屏粉色、第2屏变成绿色四叶草！）；
   - \`themeStage\` 与 \`themeElements\` 可围绕同一印花母题（如太空芝士火箭鼠）结合本屏卖点微调（如声学屏用半透明声波环+芝士星球，续航屏用暖光能量底座+芝士块，注意描述UI卡片时统一写“圆角矩形信息卡”，严禁写“胶囊”以免模型画成药丸胶囊！）。
5. \`visualPrompt\`（140~200字纯正向物理画面描述，直接喂给生图模型）：
   - ⛔【三大绝对禁令】：
     ① 绝对禁止在 \`visualPrompt\` 中出现 \`#Prod\`、\`#Prod-1\`、\`#Prod-2\`、\`#Case\` 等编号字样（否则生图模型会把 "#Prod-2" 当成文字直接印在展台上！）；
     ② 绝对禁止在 \`visualPrompt\` 中使用“胶囊”二字（请一律改用“底部圆角矩形信息卡片”，否则生图模型会在空中画出红蓝药丸胶囊！）；
     ③ 绝对禁止出现“潮玩舞台区”、“标题区”、“#EC4899”等排版术语或色号代码（色号只写在 printThemeConfig.themePalette 中，visualPrompt 中只用自然色彩词汇如“柔和奶油暖米色渐变背景”、“浅米色磨砂圆角卡片”）。
   - 若本屏绑定了2张不同角度的同款产品图（如正面闭合仓+单耳特写），请在 \`visualPrompt\` 中明确描述为：“画面中央圆润展台上陈列1个印有卡通图案的充电仓主体，旁边自然依偎/悬浮1对耳机本体”，严禁描述成多个充电仓并排陈列！`;

    parts.push({ text: promptInstruction });

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          unifiedVisualSpec: { type: Type.STRING },
          detectedProdRoles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                prodAngleRole: { type: Type.STRING },
                tag: { type: Type.STRING },
              },
              required: ["id", "prodAngleRole"],
            },
          },
          plannedModules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                screenNumber: { type: Type.INTEGER },
                title: { type: Type.STRING },
                copywriting: { type: Type.STRING },
                typographyPlan: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
                boundProductIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                printThemeConfig: {
                  type: Type.OBJECT,
                  properties: {
                    printStory: { type: Type.STRING },
                    themePalette: { type: Type.STRING },
                    themeStage: { type: Type.STRING },
                    themeElements: { type: Type.STRING },
                    themeUiStyle: { type: Type.STRING },
                  },
                },
              },
              required: [
                "id",
                "screenNumber",
                "title",
                "copywriting",
                "typographyPlan",
                "visualPrompt",
              ],
            },
          },
        },
        required: ["plannedModules"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON 对象：{"unifiedVisualSpec": "...", "detectedProdRoles": [{"id": "...", "prodAngleRole": "hero_front|open_case|single_earbud|detail_closeup|multi_sku|package_accessory", "tag": "角度简称"}], "plannedModules": [{"id": "...", "screenNumber": 1, "title": "...", "copywriting": "主标题\\n副标题\\n卖点1 | 卖点2 | 卖点3", "typographyPlan": "主标题\\n副标题\\n卖点1 | 卖点2 | 卖点3", "visualPrompt": "...", "boundProductIds": ["..."], "printThemeConfig": {"printStory": "...", "themePalette": "...", "themeStage": "...", "themeElements": "...", "themeUiStyle": "..."}}]}',
    });

    const parsed = safeParseJson(response.text || "{}");
    const returnedList = Array.isArray(parsed.plannedModules)
      ? parsed.plannedModules
      : [];
    const validProdIdSet = new Set((productImages || []).map((p: any) => p.id));
    const allowedProdRoles = new Set([
      "hero_front",
      "open_case",
      "single_earbud",
      "detail_closeup",
      "multi_sku",
      "package_accessory",
    ]);

    const detectedProdRoles = Array.isArray(parsed.detectedProdRoles)
      ? parsed.detectedProdRoles
          .map((item: any) => {
            const canonicalId =
              resolveCanonicalRefId(item?.id, productImages) || item?.id;
            if (!canonicalId || !validProdIdSet.has(canonicalId)) return null;
            const role =
              typeof item?.prodAngleRole === "string" &&
              allowedProdRoles.has(item.prodAngleRole.trim())
                ? item.prodAngleRole.trim()
                : "hero_front";
            return {
              id: canonicalId,
              prodAngleRole: role,
              tag: item?.tag ? String(item.tag).trim() : undefined,
            };
          })
          .filter(Boolean)
      : [];

    // Helper to normalize typographyPlan into clean 3-line format without prefixes or [brackets]
    const normalizeThreeLineCopy = (rawTypo: string, rawCopy: string, fallbackTitle: string): string => {
      const source = (rawTypo || rawCopy || "").trim();
      if (!source) {
        return `${fallbackTitle}\n官方正品 · 匠心品质甄选`;
      }
      // Split on newlines OR semicolons when labeled prefixes like 主标题/副标题/卖点 are present
      let segments = source
        .replace(/；\s*(?=(?:主标题|副标题|底部|卖点|胶囊|参数|卡片))/g, "\n")
        .replace(/;\s*(?=(?:主标题|副标题|底部|卖点|胶囊|参数|卡片))/g, "\n")
        .split(/\r?\n/)
        .map((s) =>
          s
            .replace(/^\s*(?:【?\s*(?:主标题|大标题|标题|副标题|次标题|底部卖点(?:胶囊|卡片)?|卖点(?:胶囊|卡片|标签)?|底部(?:胶囊|卡片|参数)|胶囊(?:文案|卡片)?|参数(?:清单)?)\s*】?\s*[:：]\s*)/i, "")
            .replace(/\[([^\]]+)\]/g, "$1")
            .trim()
        )
        .filter(Boolean);

      if (segments.length === 1 && /[；;]/.test(segments[0])) {
        segments = segments[0]
          .split(/[；;]/)
          .map((s) =>
            s
              .replace(/^\s*(?:主标题|副标题|卖点|胶囊|参数)\s*[:：]\s*/i, "")
              .replace(/\[([^\]]+)\]/g, "$1")
              .trim()
          )
          .filter(Boolean);
      }

      const headline = segments[0] || fallbackTitle;
      const subheadline = segments[1] || "";
      const capsules = segments
        .slice(2)
        .join(" | ")
        .replace(/\[([^\]]+)\]/g, "$1")
        .trim();

      return [headline, subheadline, capsules].filter(Boolean).join("\n");
    };

    // Sanitize visualPrompt so #Prod-X, #Case-X, or literal "胶囊" never leak into image generation
    const sanitizeVisualPromptText = (rawPrompt: string): string => {
      return (rawPrompt || "")
        .replace(/#(?:Prod|Case)(?:-\d+)?\b/gi, "我方产品")
        .replace(/\[([^\]]+)\]/g, "$1")
        .replace(/卖点胶囊|数据胶囊|圆角胶囊|胶囊卡片|胶囊卡|胶囊框|胶囊区|底部胶囊/g, "圆角矩形信息卡")
        .replace(/胶囊/g, "圆角信息框")
        .replace(/潮玩舞台区|产品主视觉区|标题区/g, "展示区域")
        .trim();
    };

    // Lock the first module's themePalette across all modules so the detail page never jumps colors between screens
    const masterPalette =
      returnedList.find((r: any) => r?.printThemeConfig?.themePalette)
        ?.printThemeConfig?.themePalette || "";
    const masterStory =
      returnedList.find((r: any) => r?.printThemeConfig?.printStory)
        ?.printThemeConfig?.printStory || "";
    const masterUiStyle =
      returnedList.find((r: any) => r?.printThemeConfig?.themeUiStyle)
        ?.printThemeConfig?.themeUiStyle || "";

    const finalModules = modules.map((m, idx) => {
      const matched =
        returnedList.find((r: any) => r.id === m.id) ||
        returnedList.find((r: any) => Number(r.screenNumber) === m.screenNumber) ||
        returnedList[idx] ||
        {};
      const skel =
        SERVER_MODULE_SKELETONS[m.moduleType] ||
        SERVER_MODULE_SKELETONS.custom;
      const aiBoundIds = Array.isArray(matched.boundProductIds)
        ? Array.from(
            new Set(
              matched.boundProductIds
                .map(
                  (rawId: string) =>
                    resolveCanonicalRefId(rawId, productImages) || rawId
                )
                .filter((id: string) => validProdIdSet.has(id))
            )
          )
        : [];
      const fallbackIds =
        m.moduleType === "series_matrix"
          ? (productImages || []).map((p: any) => p.id)
          : m.boundProductIds && m.boundProductIds.length > 0
            ? m.boundProductIds.slice(0, 2)
            : (productImages || []).slice(0, 1).map((p: any) => p.id);

      const cleanThreeLine = normalizeThreeLineCopy(
        matched.typographyPlan,
        matched.copywriting,
        matched.title || m.title
      );
      const rawPrompt =
        matched.visualPrompt ||
        `${skel} 遵循整页统一视觉规范：${unifiedVisualSpec || "现代极简商业摄影棚拍，柔和立体布光"}。${m.userNote ? `补充要求：${m.userNote}` : ""}`;

      const rawTheme = matched.printThemeConfig;
      const unifiedTheme = rawTheme
        ? {
            enabled: true,
            printStory: rawTheme.printStory || masterStory || `${matched.title || m.title} · 主题联动`,
            themePalette: masterPalette || rawTheme.themePalette || "",
            themeStage: sanitizeVisualPromptText(rawTheme.themeStage || ""),
            themeElements: sanitizeVisualPromptText(rawTheme.themeElements || ""),
            themeUiStyle: sanitizeVisualPromptText(
              masterUiStyle || rawTheme.themeUiStyle || "同色系浅奶油色圆角矩形信息卡，严禁生硬黑棕色块"
            ),
          }
        : undefined;

      return {
        id: m.id,
        screenNumber: idx + 1,
        title: matched.title || m.title,
        copywriting: cleanThreeLine,
        typographyPlan: cleanThreeLine,
        visualPrompt: sanitizeVisualPromptText(rawPrompt),
        boundProductIds:
          m.moduleType === "series_matrix"
            ? aiBoundIds.length > 0
              ? aiBoundIds
              : fallbackIds
            : (aiBoundIds.length > 0 ? aiBoundIds : fallbackIds).slice(0, 2),
        printThemeConfig: unifiedTheme,
      };
    });

    res.json({
      unifiedVisualSpec:
        (parsed.unifiedVisualSpec || unifiedVisualSpec || "").trim(),
      detectedProdRoles,
      plannedModules: finalModules,
    });
  } catch (err: any) {
    console.error("Error in /api/detail/plan-modules:", err);
    res.status(500).json({
      error: err?.message || "AI 生成模块文案与画面方案失败",
    });
  }
});

// 3. Replica Studio Task Planner (Analyzes #Case & #Prod for 1-Click High-Fidelity / Style Replica)
app.post("/api/replica/plan-tasks", async (req, res) => {
  try {
    const rawCaseImages = req.body.caseImages || req.body.referenceImages || [];
    const rawProductImages = req.body.productImages || [];
    const rawMatchMode = req.body.matchMode || "single_prod_to_multi_ref";
    const isMultiProdToSingleRef =
      rawMatchMode === "multi_prod_to_single_ref" ||
      rawMatchMode === "multi_prod_single_case";
    let effectiveTasks = Array.isArray(req.body.tasks) ? req.body.tasks : [];

    if (effectiveTasks.length === 0) {
      if (isMultiProdToSingleRef && rawProductImages.length > 0) {
        const primaryCase = rawCaseImages[0];
        effectiveTasks = rawProductImages.map((p: any, idx: number) => ({
          id: `replica-plan-${idx + 1}`,
          index: idx + 1,
          caseRefId: primaryCase?.id || "",
          prodRefId: p.id,
          skuLabel: p.tag || p.name || `款式 ${idx + 1}`,
          singleRequirement:
            primaryCase?.perRefRequirement || primaryCase?.caseCustomRule || "",
        }));
      } else if (rawCaseImages.length > 0) {
        effectiveTasks = rawCaseImages.map((c: any, idx: number) => ({
          id: `replica-plan-${idx + 1}`,
          index: idx + 1,
          caseRefId: c.id,
          prodRefId: rawProductImages[0]?.id || "",
          skuLabel: rawProductImages[0]?.tag || "",
          singleRequirement: c.perRefRequirement || c.caseCustomRule || "",
        }));
      } else if (rawProductImages.length > 0) {
        effectiveTasks = rawProductImages.map((p: any, idx: number) => ({
          id: `replica-plan-${idx + 1}`,
          index: idx + 1,
          caseRefId: "",
          prodRefId: p.id,
          skuLabel: p.tag || p.name || `款式 ${idx + 1}`,
          singleRequirement: "",
        }));
      }
    }

    const {
      replicaCategory: rawReplicaCategory = "ecommerce_product",
      replicaFidelity = "high_replica",
      consistentStyle: rawConsistentStyle,
      consistentOutputStyle: rawConsistentOutputStyle,
      styleLinkageMode: rawStyleLinkageMode,
      unifiedRequirement: rawUnifiedReq = "",
      globalRequirement: rawGlobalReq = "",
      language = "zh",
      agentModel = "gemini-3.8-flash",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body;

    const replicaCategory =
      rawReplicaCategory === "ecom_product"
        ? "ecommerce_product"
        : rawReplicaCategory;
    const consistentStyle =
      typeof rawConsistentOutputStyle === "boolean"
        ? rawConsistentOutputStyle
        : typeof rawConsistentStyle === "boolean"
          ? rawConsistentStyle
          : true;
    const styleLinkageMode: "print_4d" | "color_sync" | "lock_scene" =
      rawStyleLinkageMode || (consistentStyle ? "print_4d" : "lock_scene");
    const unifiedRequirement = (rawGlobalReq || rawUnifiedReq || "").trim();

    const caseImages = rawCaseImages;
    const productImages = rawProductImages;
    const tasks = effectiveTasks;

    const parts: any[] = [];
    for (const prod of (productImages || []).slice(0, 8)) {
      const resolved = await resolveReferenceInlineImage(prod, ossConfig);
      if (resolved) {
        parts.push({
          text: `【我方自有产品原图 ID="${prod.id}" | 编号=#${prod.code || "Prod"} | 预设视角="${prod.prodAngleRole || "待识别"}" | 名称="${prod.tag || prod.name}"】`,
        });
        parts.push({ inlineData: resolved });
      }
    }

    for (const c of (caseImages || []).slice(0, 8)) {
      const resolved = await resolveReferenceInlineImage(c, ossConfig);
      if (resolved) {
        parts.push({
          text: `【参考图 ID="${c.id}" | 编号=#${c.code || "Case"} | 名称="${c.tag || c.name}"】`,
        });
        parts.push({ inlineData: resolved });
      }
    }

    const langRule =
      language === "en"
        ? "画面内所有主副标题与卖点标签统一使用地道、高级的英文（English）排版"
        : language === "none"
          ? "无文字纯视觉底图模式（画面内不渲染任何文字或标语，仅保留干净留白）"
          : "画面内所有主副标题与卖点标签统一使用精炼的简体中文排版";

    const normFidelity =
      replicaFidelity === "style_ref" || replicaFidelity === "style_reference"
        ? "style_reference"
        : "high_replica";
    const isHighReplica = normFidelity === "high_replica";

    const fidelityRule = isHighReplica
      ? "【高度复刻模式】：严格参照对应参考图的镜头角度、画面构图结构（如首焦KV、Bento多卖点宫格、1拖2子卡片、续航功能场景、多彩SKU矩阵）及文字排版位置，将原图中的商品 100% 替换为我方自有产品原图（#Prod），严格还原#Prod的真实外观、比例、材质与表面卡通印花图案！"
      : "【参考风格模式】：借鉴对应参考图的整体视觉美学风格、光影质感与信息层级结构，围绕我方自有产品原图（#Prod）重新设计契合的场景细节与色彩搭配！";

    const linkageRule =
      styleLinkageMode === "print_4d"
        ? `【🟣 印花主题4维深度联动模式（潮玩/卡通印花专属，最高优先级）】：
请仔细识别每张任务对应的我方产品（#Prod）表面上的【卡通插画/印花主题】（如太空芝士鼠、星月美梦兔、洋梨帐篷露营刺猬等，若为纯色产品则提取其机身美学色彩主题），为每张任务输出具象的 \`printThemeConfig\` 4维联动配方：
1. \`printStory\`：用 6~12 字概括识别到的壳面印花故事母题（如："太空芝士火箭小鼠"、"星月云朵美梦兔"、"洋梨帐篷露营小刺猬"）；
2. \`themePalette\`：60%主背景渐变色 + 30%展台辅色 + 10%高亮强调色（必须与壳面印花色调深度呼应，附带具体色名与HEX色号）；
3. \`themeStage\`：将原本死板的普通展台改造为契合印花故事的【泡泡玛特/盲盒级圆润磨砂微缩景观底座】（如：圆润芝士孔洞太空台、绵软云朵星光阶梯台、森系草坪洋梨露营台）；
4. \`themeElements\`：直接从壳面印花插画中“抠”出 2~3 个标志性伴生小符号（如印花里的十字闪星✨、紫色小土星、3D软萌洋梨、小雏菊、弯月音符），以盲盒手办级圆润哑光质感在产品周围远中近景轻盈排布，严禁生硬堆砌廉价塑料感摆件；
5. \`themeUiStyle\`：主副标题字体颜色 + 底部卖点数据胶囊框底色与描边（必须随印花主题色联动变化，如露营刺猬用深橄榄绿标题+暖琥珀黄胶囊框；美梦兔用深靛紫标题+雾霾紫蓝胶囊框，彻底杜绝千篇一律的死板黑棕框！）。`
        : styleLinkageMode === "color_sync"
          ? `【🔵 同色系顺应模式】：提取我方产品（#Prod）的主色调，将背景氛围色、展台色调与标题/胶囊文字颜色自动顺应调整为与我方产品高度统一的同色系，并填入 \`printThemeConfig\`。`
          : `【⚪ 锁死原场景模式】：保持对应参考图（#Case）原有的环境色彩、展台材质与胶囊配色，仅精准替换产品主体与文案。`;

    const taskDesc = tasks
      .map(
        (t: any) =>
          `- 任务 ID="${t.id}" (第${t.index}张): 对应参考图 ID="${t.caseRefId}" + 默认产品图 ID="${t.prodRefId}"${t.skuLabel ? ` (款式名: ${t.skuLabel})` : ""} | 单张专属要求: "${t.singleRequirement || "自动识别参考图卖点结构并适配我方产品"}"`
      )
      .join("\n");

    parts.push({
      text: `你是一位资深电商主图/详情页同源视觉总导演与潮玩印花联动专家。请根据上方上传的【我方自有产品原图（#Prod）】和【参考图（#Case）】，完成以下规划：
- 复刻类型：${replicaCategory}
- 复刻程度：${fidelityRule}
- 色彩与印花联动策略：${linkageRule}
- 统一复刻要求：${unifiedRequirement || "无额外要求"}
- 文字语言设置：${langRule}

任务列表：
${taskDesc}

请为每个任务输出：
1. \`extractedCopy\`：识别参考图中的主标题、副标题及底部卖点胶囊/Bento宫格文案结构，转化为适合我方产品的精炼高转化文案（第一行为主标题，后续行为副标题与底部胶囊卖点，遵守语言设置：${langRule}）。
2. \`boundProductIds\`（智能多角度产品图编排）：
   - 请观察对应参考图（#Case）展示的是什么产品形态（如：首焦开盖+双耳、全卖点Bento宫格+顶部多色一字排开、单耳入耳佩戴+底部双子卡、充电续航特写、或多色SKU矩阵）；
   - 从上方上传的 \`#Prod\` 列表中，为该任务挑选最匹配的 **1~5 个产品图 ID**（例如：若参考图含开盖+单耳，则同时勾选我方的正面印花图ID与开盖/单耳图ID；若参考图是多色合集，则勾选全部不同花色的 \`#Prod\` ID，告别全套图只用单一死板正立面！）。
3. \`printThemeConfig\`：包含 \`printStory\`、\`themePalette\`、\`themeStage\`、\`themeElements\`、\`themeUiStyle\` 四个维度的具体联动配方。
4. \`visualPrompt\`：150~220字的高准度生图提示词，明确指出如何按照参考图构图组合陈列所选的 \`#Prod\`（100%还原我方产品外形、比例与壳面卡通印花，零形变），并融入 \`printThemeConfig\` 的潮玩底座、伴生悬浮元素、背景色板与胶囊配色方案。`,
    });

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productColorTheme: { type: Type.STRING },
          detectedProdRoles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                prodAngleRole: { type: Type.STRING },
                tag: { type: Type.STRING },
              },
              required: ["id", "prodAngleRole"],
            },
          },
          plannedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                extractedCopy: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
                boundProductIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                printThemeConfig: {
                  type: Type.OBJECT,
                  properties: {
                    printStory: { type: Type.STRING },
                    themePalette: { type: Type.STRING },
                    themeStage: { type: Type.STRING },
                    themeElements: { type: Type.STRING },
                    themeUiStyle: { type: Type.STRING },
                  },
                  required: [
                    "themePalette",
                    "themeStage",
                    "themeElements",
                    "themeUiStyle",
                  ],
                },
              },
              required: [
                "id",
                "extractedCopy",
                "visualPrompt",
                "printThemeConfig",
              ],
            },
          },
        },
        required: ["plannedTasks"],
      },
    };

    const response = await executeUniversalAgentCall({
      model: agentModel,
      parts,
      config,
      enableHighThinking: false,
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol,
      jsonHint:
        '请严格输出 JSON：{"productColorTheme": "...", "detectedProdRoles": [{"id": "产品图ID", "prodAngleRole": "hero_front|open_case|single_earbud|detail_closeup|multi_sku|package_accessory", "tag": "简短视角描述"}], "plannedTasks": [{"id": "...", "extractedCopy": "主标题\\n副标题与胶囊卖点", "visualPrompt": "...", "boundProductIds": ["..."], "printThemeConfig": {"printStory": "...", "themePalette": "...", "themeStage": "...", "themeElements": "...", "themeUiStyle": "..."}}]}',
    });

    const parsed = safeParseJson(response.text || "{}");
    const plannedTasks = Array.isArray(parsed.plannedTasks) ? parsed.plannedTasks : [];
    const validProdIds = new Set((productImages || []).map((p: any) => p.id));
    const allowedProdRoles = new Set([
      "hero_front",
      "open_case",
      "single_earbud",
      "detail_closeup",
      "multi_sku",
      "package_accessory",
    ]);

    const detectedProdRoles = Array.isArray(parsed.detectedProdRoles)
      ? parsed.detectedProdRoles
          .map((item: any) => {
            const canonicalId =
              resolveCanonicalRefId(item?.id, productImages) || item?.id;
            if (!canonicalId || !validProdIds.has(canonicalId)) return null;
            const role =
              typeof item?.prodAngleRole === "string" &&
              allowedProdRoles.has(item.prodAngleRole.trim())
                ? item.prodAngleRole.trim()
                : "hero_front";
            return {
              id: canonicalId,
              prodAngleRole: role,
              tag: item?.tag ? String(item.tag).trim() : undefined,
            };
          })
          .filter(Boolean)
      : [];

    const replicaTasks = plannedTasks.map((pt: any, idx: number) => {
      const copyStr = String(pt.extractedCopy || "").trim();
      const lines = copyStr
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);
      const titleLine = lines[0] || "复刻爆款主图";
      const badgeLines = lines.length > 1 ? lines.slice(1).join(" ｜ ") : copyStr;
      const aiBoundIds = Array.isArray(pt.boundProductIds)
        ? Array.from(
            new Set(
              pt.boundProductIds
                .map(
                  (rawId: string) =>
                    resolveCanonicalRefId(rawId, productImages) || rawId
                )
                .filter((id: string) => validProdIds.has(id))
            )
          )
        : [];
      const fallbackProdId = tasks[idx]?.prodRefId || productImages[0]?.id;

      return {
        id: pt.id || tasks[idx]?.id,
        title: titleLine,
        copywriting: badgeLines,
        typographyPlan: copyStr,
        visualPrompt: pt.visualPrompt || "",
        extractedCopy: copyStr,
        boundProductIds:
          aiBoundIds.length > 0
            ? aiBoundIds
            : fallbackProdId
              ? [fallbackProdId]
              : [],
        printThemeConfig: pt.printThemeConfig || undefined,
      };
    });

    res.json({
      productColorTheme: parsed.productColorTheme || "",
      detectedProdRoles,
      plannedTasks,
      replicaTasks,
    });
  } catch (err: any) {
    console.error("Error in /api/replica/plan-tasks:", err);
    res.status(500).json({
      error: err?.message || "规划复刻任务失败",
    });
  }
});

// Step 5: Execute single screen / Main-SKU Replica image generation
// Clean, high-stability pipeline:
// - In 'replica' mode: Strictly pairs 1 Own Product (#Prod) + 1 Target Reference (#Case) with clean 'high_replica' or 'style_reference' directives.
// - In 'detail' mode: Passes ONLY Own Product (#Prod) + Unified Visual Spec + Module Task Prompt (zero competitor image pollution).
app.post("/api/image/generate", async (req, res) => {
  try {
    const {
      prompt,
      copywriting,
      typographyPlan,
      benchmarkCase,
      unifiedVisualSpec,
      caseDeliveryMode,
      studioContext: explicitStudioContext,
      moduleType,
      userNote,
      replicaCategory: rawReplicaCategory = "ecommerce_product",
      replicaFidelity = "high_replica",
      consistentStyle: rawConsistentStyle,
      consistentOutputStyle: rawConsistentOutputStyle,
      styleLinkageMode: rawStyleLinkageMode,
      printThemeConfig,
      sourceReplicaImageUrl,
      lockedResultImageUrl,
      refineInstruction,
      singleRequirement: rawSingleRequirement = "",
      perRefRequirement: rawPerRefRequirement = "",
      unifiedRequirement: rawUnifiedRequirement = "",
      globalRequirement: rawGlobalRequirement = "",
      replicaLanguage = "zh",
      textMode = "with_text",
      title,
      referenceImages = [],
      imageModel = "gemini-nano-banana-2.1",
      aspectRatio = "9:16",
      imageSize = "1K",
      customBaseUrl,
      customApiKey,
      customHeaders,
      protocol = "auto",
      ossConfig,
    } = req.body as {
      prompt: string;
      copywriting?: string;
      typographyPlan?: string;
      benchmarkCase?: string;
      unifiedVisualSpec?: string;
      caseDeliveryMode?: "none" | "shared_style" | "lock_base_swap";
      customConstraints?: string[];
      studioContext?: "detail" | "sku" | "replica";
      moduleType?: string;
      userNote?: string;
      replicaCategory?: string;
      replicaFidelity?: "style_reference" | "high_replica" | "style_ref";
      consistentStyle?: boolean;
      consistentOutputStyle?: boolean;
      styleLinkageMode?: "print_4d" | "color_sync" | "lock_scene";
      printThemeConfig?: {
        printStory?: string;
        themePalette?: string;
        themeStage?: string;
        themeElements?: string;
        themeUiStyle?: string;
      };
      sourceReplicaImageUrl?: string;
      lockedResultImageUrl?: string;
      refineInstruction?: string;
      singleRequirement?: string;
      perRefRequirement?: string;
      unifiedRequirement?: string;
      globalRequirement?: string;
      replicaLanguage?: "zh" | "en" | "none";
      textMode?: "with_text" | "without_text";
      layerType?: "dynamic" | "static";
      title?: string;
      referenceImages?: {
        id: string;
        code?: string;
        category?: "product" | "case";
        prodAngleRole?: string;
        name: string;
        tag: string;
        caseDimensions?: string[];
        caseCustomRule?: string;
        isLockBaseSwap?: boolean;
        isSharedStyleRef?: boolean;
        mimeType: string;
        base64Data?: string;
        ossUrl?: string;
        previewUrl?: string;
      }[];
      imageModel?: string;
      aspectRatio?: string;
      imageSize?: string;
      customBaseUrl?: string;
      customApiKey?: string;
      customHeaders?: string;
      protocol?: ApiProtocolMode;
      ossConfig?: ServerOssConfigInput;
    };

    if (!prompt || !prompt.trim()) {
      res.status(400).json({ error: "生图提示词不能为空。" });
      return;
    }

    const parts: any[] = [];
    const safeRefs = Array.isArray(referenceImages) ? referenceImages : [];
    const prodRefs = safeRefs.filter((r) => r && r.category !== "case");
    const rawCaseRefs = safeRefs.filter((r) => r && r.category === "case");

    const roleLabelMap: Record<string, string> = {
      hero_front: "正面印花主视图",
      open_case: "开盖含双耳组合图",
      single_earbud: "单耳本体/佩戴特写图",
      single_wear: "单耳本体/佩戴特写图",
      detail_closeup: "局部材质/充电微距图",
      macro_detail: "局部材质/充电微距图",
      multi_sku: "多款式/多花色合集图",
      multi_color: "多款式/多花色合集图",
      package_accessory: "包装盒与配件清单图",
      accessory: "包装盒与配件清单图",
    };

    // Helper to strip internal asset codes (#Prod-2, #Case-1), square brackets [ ], and replace "胶囊" (which causes image models to draw literal 3D medicine pills!)
    const sanitizePromptForRender = (text?: string): string => {
      if (!text) return "";
      return text
        .replace(/#(?:Prod|Case)(?:-\d+)?\b/gi, "我方商品")
        .replace(/\[([^\]]+)\]/g, "$1")
        .replace(
          /卖点胶囊|数据胶囊|圆角胶囊|胶囊卡片|胶囊卡|胶囊框|胶囊底栏|胶囊区|底部胶囊|贴纸胶囊/g,
          "圆角矩形卖点卡片"
        )
        .replace(/胶囊/g, "圆角标签框")
        .replace(/潮玩舞台区/g, "中央展台区域")
        .replace(/标题区/g, "顶部标题区域")
        .trim();
    };

    const sanitizeCopyForRender = (text?: string): string => {
      if (!text) return "";
      return text
        .replace(/\[([^\]]+)\]/g, "$1")
        .replace(/#(?:Prod|Case)(?:-\d+)?\b/gi, "")
        .replace(/^\s*(?:主标题|副标题|底部卖点|卖点|胶囊|参数)\s*[:：]\s*/gm, "")
        .trim();
    };

    const buildPrint4dDirective = (cfg?: {
      enabled?: boolean;
      printStory?: string;
      themePalette?: string;
      themeStage?: string;
      themeElements?: string;
      themeUiStyle?: string;
    }) => {
      if (!cfg || cfg.enabled === false) return "";
      const lines = [
        cfg.printStory ? `- 印花世界观母题：${sanitizePromptForRender(cfg.printStory)}` : "",
        cfg.themePalette ? `- ① 联动主题色板（60-30-10）：${sanitizePromptForRender(cfg.themePalette)}` : "",
        cfg.themeStage
          ? `- ② 联动主题底座：${sanitizePromptForRender(cfg.themeStage)}（采用细腻圆润哑光质感，严禁生硬廉价塑料感）`
          : "",
        cfg.themeElements
          ? `- ③ 印花伴生悬浮小元素：${sanitizePromptForRender(cfg.themeElements)}（仅限从产品壳面插画延展出的2~3个微缩主题符号，严禁在空中画医药胶囊药丸！）`
          : "",
        cfg.themeUiStyle
          ? `- ④ 标题与底部圆角矩形信息卡配色：${sanitizePromptForRender(cfg.themeUiStyle)}（标题字色与底部圆角矩形卖点框必须随本款主题色同步联动，严禁使用死板黑棕色底框！）`
          : "",
      ].filter(Boolean);
      return lines.length > 0
        ? `【🎨 卡通/潮玩印花 4 维主题深度联动指令（核心视觉锚点）】：\n${lines.join("\n")}`
        : "";
    };

    const extendedRatios = new Set([
      "1:1",
      "3:4",
      "4:3",
      "9:16",
      "16:9",
      "1:4",
      "1:8",
      "4:1",
      "8:1",
    ]);

    let effectiveRatio = aspectRatio || "9:16";
    if (!extendedRatios.has(effectiveRatio)) {
      effectiveRatio = "9:16";
    }

    const isReplicaRender =
      explicitStudioContext === "replica" ||
      explicitStudioContext === "sku" ||
      (!explicitStudioContext &&
        (/^SKU-\d+/i.test(title || "") ||
          /复刻/.test(title || "") ||
          /SKU全套统一版式/.test(benchmarkCase || "") ||
          Boolean(rawSingleRequirement || rawPerRefRequirement) ||
          Boolean(rawUnifiedRequirement || rawGlobalRequirement)));

    // Resolve optional lockedResultImageUrl for local iterative refinement ("🔒 锁图微调")
    const cleanLockedResultUrl = (lockedResultImageUrl || "").trim();
    const cleanRefineInstruction = (refineInstruction || "").trim();
    let resolvedLockedResult: { data: string; mimeType: string } | null = null;
    if (cleanLockedResultUrl) {
      resolvedLockedResult = await resolveReferenceInlineImage(
        {
          mimeType: "image/png",
          previewUrl: cleanLockedResultUrl,
          ossUrl: /^https?:\/\//i.test(cleanLockedResultUrl)
            ? cleanLockedResultUrl
            : undefined,
        },
        ossConfig
      );
    }

    let finalPrompt = "";

    if (isReplicaRender) {
      // ==================== PIPELINE A: MAIN IMAGE / SKU REPLICA STUDIO (Multi-Angle #Prod + 4D Print Theme Linkage) ====================
      // 1. Attach All Bound Own Product Image(s) (#Prod, up to 5 angles/SKUs)
      for (let i = 0; i < Math.min(5, prodRefs.length); i++) {
        const ref = prodRefs[i];
        const sanitized = await resolveReferenceInlineImage(ref, ossConfig);
        if (sanitized) {
          const roleDesc = ref.prodAngleRole
            ? roleLabelMap[ref.prodAngleRole] || ref.prodAngleRole
            : "产品实拍图";
          parts.push({
            text: `【图A-${i + 1} · 我方自有商品实拍原图（视角角色：${roleDesc}）】：必须 100% 严格还原此图中的商品工业造型、轮廓比例、材质光泽与壳面卡通印花图案细节，绝对禁止商品变形或篡改图案！（注意：切勿在画面中印出任何图片编号或文件名）`,
          });
          parts.push({
            inlineData: {
              data: sanitized.data,
              mimeType: sanitized.mimeType,
            },
          });
        }
      }

      const normFidelity =
        replicaFidelity === "style_ref" || replicaFidelity === "style_reference"
          ? "style_reference"
          : "high_replica";
      const isHighReplica = normFidelity === "high_replica";

      // 2. If user enabled "🔒 锁图微调" (lockedResultImageUrl), attach the locked current result as the primary composition anchor!
      // Otherwise attach Target Reference Image (#Case).
      if (resolvedLockedResult) {
        parts.push({
          text: `【🔒 当前已确认满意成图基准（局部微调锁死构图锚点）】：这是一张用户已经基本满意的当前成图！请 95% 严格保持此图的【整体构图布局、镜头透视、产品摆放位置、展台光影与环境色彩】不变，仅针对下方指定的【局部微调修改要求】或最新文案进行定点精修重绘，同时确保商品外观与【图A · 我方自有商品实拍原图】100%一致！`,
        });
        parts.push({
          inlineData: {
            data: resolvedLockedResult.data,
            mimeType: resolvedLockedResult.mimeType,
          },
        });
      } else {
        for (const ref of rawCaseRefs.slice(0, 1)) {
          const sanitized = await resolveReferenceInlineImage(ref, ossConfig);
          if (sanitized) {
            const caseHeader = isHighReplica
              ? `【图B · 目标复刻参考图（高度复刻版式骨架）】：请严格参照此参考图的【版面分区结构（如首焦KV、Bento多卖点宫格、1拖2子卡片、续航功能场景或多色SKU矩阵）、镜头透视角度与文字排版位置】，将原图中的竞品商品 100% 替换为上方【图A · 我方自有商品实拍原图】！`
              : `【图B · 风格参考图（参考风格模式）】：请参考此图的【整体视觉美学气质、布光氛围与版面信息结构】，围绕上方【图A · 我方自有商品实拍原图】重构契合的场景细节与色彩搭配！`;
            parts.push({ text: caseHeader });
            parts.push({
              inlineData: {
                data: sanitized.data,
                mimeType: sanitized.mimeType,
              },
            });
          }
        }
      }

      const replicaCategory =
        rawReplicaCategory === "ecom_product"
          ? "ecommerce_product"
          : rawReplicaCategory;
      const consistentStyle =
        typeof rawConsistentOutputStyle === "boolean"
          ? rawConsistentOutputStyle
          : typeof rawConsistentStyle === "boolean"
            ? rawConsistentStyle
            : true;
      const effectiveLinkageMode =
        rawStyleLinkageMode || (consistentStyle ? "print_4d" : "lock_scene");
      const singleRequirement = sanitizePromptForRender(
        rawPerRefRequirement || rawSingleRequirement || ""
      );
      const unifiedRequirement = sanitizePromptForRender(
        rawGlobalRequirement || rawUnifiedRequirement || ""
      );

      const categoryMap: Record<string, string> = {
        ecommerce_product: "高转化电商商品主图/SKU图，商品主体锐利突出，商业棚拍质感",
        ecom_product: "高转化电商商品主图/SKU图，商品主体锐利突出，商业棚拍质感",
        fashion_apparel: "服饰上身穿搭商业摄影，真实自然的模特姿态与面料剪裁垂坠感，100%还原图A服装领型、袖型、纽扣与面料肌理",
        marketing_poster: "强视觉冲击力商业营销海报，标题排版醒目，促销氛围感强",
        social_media: "高赞社媒种草封面图文，真实生活化氛围与网感字体贴纸排版",
        creative_poster: "先锋视觉创意合成海报，光影戏剧感强",
        other: "专业商业摄影与平面视觉设计",
      };

      const hasProd = prodRefs.length > 0;
      const hasCase = rawCaseRefs.length > 0;

      let fidelityBlock = "";
      if (resolvedLockedResult) {
        fidelityBlock = `【🔒 锁当前成图局部微调模式（最高优先级）】\n1. 构图与环境锁定：严格锁定上方【当前已确认满意成图基准】的相机机位、产品角度、展台底座、背景色调与整体版面结构，严禁推倒重来改变大构图！\n2. 定点微调执行：${cleanRefineInstruction ? `严格执行本次局部修改指令：「${cleanRefineInstruction}」；` : "保持原构图，按最新文案与细节描述进行局部优化；"}\n3. 商品真实还原：画面中的商品主体必须100%严格保持【图A · 我方自有商品实拍原图】的工业造型、几何比例与壳面印花细节，严禁商品拉伸变形！`;
      } else if (hasProd && hasCase) {
        fidelityBlock = isHighReplica
          ? `【复刻程度：高度复刻（多角度产品组合 + 版式锁定）】\n1. 构图与版式锁定：严格继承【图B · 参考图】的版面分区（包括顶部标题区、中部主视觉区、以及底部的Bento卖点小卡片或圆角矩形卖点卡片结构）。\n2. 多角度产品精准替换：将画面中的主商品及子卡片中的商品视角，100%精准替换为上方提供的【图A · 我方自有商品实拍原图】，严格还原图A的工业轮廓、真实几何比例、充电仓与耳机细节以及壳面卡通印花图案。\n3. 【核心抗拉伸防变形原则】：无论当前输出宽高比（${effectiveRatio}）为何，绝对禁止为了填充画布而对商品本身进行垂直拉伸或横向挤压变形！必须维持商品自身的真实几何长宽比，通过背景、展台与呼吸留白延展来适应画布！\n4. 【禁止竞品元素与编号文字污染】：产品主体及其所有配件、Logo、壳面印花必须100%来源于【图A】，严禁混入【图B】中竞品商品的品牌Logo，且画面中绝对禁止印出任何图片编号（如#Prod-1）、色号代码（如#EC4899）或方括号符号！`
          : `【复刻程度：参考风格（美学重构）】\n1. 风格借鉴与美学延展：提取【图B · 参考图】的整体视觉调性、光影氛围与排版层次规律。\n2. 场景与构图重塑：围绕【图A · 我方自有商品实拍原图】重新设计契合的场景道具与背景，允许富有创意的美学构图。\n3. 【核心抗拉伸防变形原则】：100%严格还原图A产品的真实物理轮廓、工业几何比例与表面印花细节，绝对禁止任何拉伸或压扁变形！`;
      } else if (hasProd && !hasCase) {
        fidelityBlock = `【电商商品高清商业摄影】\n1. 核心主体：画面以【图A · 我方自有商品实拍原图】为绝对核心，100%严格还原其外观造型、工业细节与壳面印花质感。\n2. 【核心抗拉伸防变形原则】：严格保持商品原有的几何物理比例，严禁纵向拉伸或横向压扁商品。`;
      } else if (!hasProd && hasCase) {
        fidelityBlock = `【创意参考图商业复刻】\n严格参考【图B · 参考图】的构图透视、空间布景、光影层级与版面信息结构，生成高质感电商商业主图。`;
      } else {
        fidelityBlock = `【商业电商主图摄影】\n现代高转化电商商业摄影，主体突出，构图规整，光影立体，细节质感细腻。`;
      }

      const print4dBlock = buildPrint4dDirective(printThemeConfig);
      let consistencyBlock = "";
      if (effectiveLinkageMode === "print_4d") {
        consistencyBlock =
          print4dBlock ||
          `【🟣 印花主题4维深度联动（激活）】：请深入识别【图A · 我方自有商品实拍原图】壳面上的卡通插画/印花主题（或机身主色调），将画面的：①背景渐变色温、②潮玩盲盒感圆润磨砂底座、③从印花图案提取的2~3个悬浮伴生小符号、④主副标题字色与底部圆角矩形卖点卡片配色，全部随图A的印花主题深度联动变化，营造浑然一体的主题世界观！`;
      } else if (effectiveLinkageMode === "color_sync") {
        consistencyBlock =
          print4dBlock ||
          `【🔵 同色系顺应（激活）】：请自动提取【图A · 我方自有商品实拍原图】的主色调，将画面中的背景渐变色、氛围光效、周边呼应道具以及标题/底部圆角卡片颜色，同步协调为与【图A】高度和谐的同色系配色！`;
      } else {
        consistencyBlock = `【⚪ 锁死原场景策略】：保持【图B · 参考图】原有的环境光影与背景色彩氛围，仅精准替换商品主体与对应文案。`;
      }

      const effectiveLang =
        textMode === "without_text" ? "none" : replicaLanguage || "zh";
      const copyText = sanitizeCopyForRender(typographyPlan || copywriting || "");

      const languageBlock =
        effectiveLang === "none"
          ? `【文字渲染设置：无文字纯底图】：画面中严禁渲染任何文字、字母或标语，原参考图的文字区域请保留干净通透的背景留白。`
          : effectiveLang === "en"
            ? `【文字渲染设置：英文 (English)】：画面中的标题、副标题与底部圆角卖点卡片请使用清晰、现代的商业英文（English）字体渲染${copyText ? `（指定渲染文案：\n${copyText}\n注意：仅渲染上述纯净文案，严禁渲染方括号[]、编号#Prod或色号代码！）` : "（参照图B的文案排版位置与语义，适配我方产品）"}。`
            : `【文字渲染设置：简体中文】：画面中的标题、副标题与底部圆角卖点卡片请使用清晰、高级的现代商业简体中文字体渲染${copyText ? `（指定渲染文案：\n${copyText}\n注意：仅渲染上述纯净文案，严禁渲染方括号[]、编号#Prod或色号代码！）` : "（参照图B的排版位置，适配我方产品卖点）"}。`;

      const userReqLines = [
        cleanRefineInstruction
          ? `- 🔒 本次锁图局部微调指令（最高优先级，仅修改此处要求，其余保持原图）：${cleanRefineInstruction}`
          : "",
        singleRequirement.trim()
          ? `- 本张参考图专属要求（最高优先级）：${singleRequirement.trim()}`
          : "",
        unifiedRequirement.trim()
          ? `- 统一复刻要求（全局生效）：${unifiedRequirement.trim()}`
          : "",
      ].filter(Boolean);

      finalPrompt = [
        `【复刻类型】：${categoryMap[replicaCategory] || categoryMap.ecommerce_product}`,
        fidelityBlock,
        consistencyBlock,
        userReqLines.length > 0
          ? `【用户指定复刻要求】：\n${userReqLines.join("\n")}`
          : "",
        `【画面构图与细节指令】：\n${sanitizePromptForRender(prompt)}`,
        languageBlock,
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
    } else {
      // ==================== PIPELINE B: MODULAR DETAIL PAGE STUDIO (Pure Product + 6-Anchor Spec + Optional 1:1->3:4/9:16 Vertical Reframing + Optional Lock-Result Refinement) ====================
      // 1. Attach Own Product Images (#Prod) — Sole Authority for Product Identity!
      // IMPORTANT: Never put "#Prod-2" or "#Prod-4" into the text label sent to the image model, otherwise the image model prints "#Prod-2" onto the podium!
      const isMultiSkuMatrixScreen = moduleType === "series_matrix";
      const maxProdToAttach = isMultiSkuMatrixScreen ? 5 : 2;
      const effectiveDetailProdRefs = prodRefs.slice(0, maxProdToAttach);

      for (let i = 0; i < effectiveDetailProdRefs.length; i++) {
        const ref = effectiveDetailProdRefs[i];
        const sanitized = await resolveReferenceInlineImage(ref, ossConfig);
        if (sanitized) {
          const roleDesc = ref.prodAngleRole
            ? roleLabelMap[ref.prodAngleRole] || ref.prodAngleRole
            : "产品实拍图";
          parts.push({
            text: isMultiSkuMatrixScreen
              ? `【我方自有商品实拍原图（款式 ${i + 1} · ${roleDesc}）】：请 100% 严格还原此商品的真实工业外观、几何比例与壳面卡通印花细节！（严禁在画面中印出任何编号文字）`
              : `【我方自有商品实拍原图（同款产品的第 ${i + 1} 视角参考：${roleDesc}）】：这与本屏其他参考图是【同一款商品】的不同拍摄角度（如充电仓与耳机本体），请结合这些角度 100% 严格还原商品的工业外形、比例与表面卡通印花图案，在展台上仅展示 1 套商品主体（如 1 个充电仓 + 1 对耳机），绝对禁止把多张角度参考图画成多个重复的充电仓并排摆在展台上，更严禁在画面上印出任何图片编号或说明标签！`,
          });
          parts.push({
            inlineData: {
              data: sanitized.data,
              mimeType: sanitized.mimeType,
            },
          });
        }
      }

      // 2. If user enabled "🔒 锁图微调" (`resolvedLockedResult`), attach the current screen result as the primary composition lock anchor!
      // Otherwise, if this detail screen is extended from an already-generated 1:1 Main Image (`sourceReplicaImageUrl`), attach the 1:1 image.
      let hasVerticalReframeSource = false;
      if (resolvedLockedResult) {
        parts.push({
          text: `【🔒 当前分屏已确认满意成图基准（局部微调锁死构图锚点）】：这是一张用户对整体构图已经满意的当前分屏成图。请 95% 严格锁定此图的【整体构图布局、产品位置角度、展台道具、光影色调与版面结构】不变，仅按下方【🔒 本屏锁图局部微调指令】或最新文案进行定点精修，同时确保商品外观与上方我方商品实拍图 100% 一致！`,
        });
        parts.push({
          inlineData: {
            data: resolvedLockedResult.data,
            mimeType: resolvedLockedResult.mimeType,
          },
        });
      } else if (sourceReplicaImageUrl && sourceReplicaImageUrl.trim()) {
        const cleanSourceUrl = sourceReplicaImageUrl.trim();
        const resolvedSource = await resolveReferenceInlineImage(
          {
            mimeType: "image/png",
            previewUrl: cleanSourceUrl,
            ossUrl: /^https?:\/\//i.test(cleanSourceUrl)
              ? cleanSourceUrl
              : undefined,
          },
          ossConfig
        );
        if (resolvedSource) {
          hasVerticalReframeSource = true;
          parts.push({
            text: `【同源1:1主图基准成图（纵向画幅重构锚点）】：这是一张已经确认满意的 1:1 主图成图。请保持此图中的【我方产品外观、印花主题展台底座、悬浮伴生小元素、光影色调与卡片配色】100%一致，将画布纵向舒展重构为 ${effectiveRatio} 竖屏详情页构图（向上舒展顶部标题呼吸区、向下舒展底部圆角矩形卖点卡片区），绝对禁止将中间的商品本体纵向拉伸变形！`,
          });
          parts.push({
            inlineData: {
              data: resolvedSource.data,
              mimeType: resolvedSource.mimeType,
            },
          });
        }
      }

      // 3. Optional: Attach #Case if user explicitly enabled lock_base_swap or shared_style (and not in locked-result refinement mode)
      if (!resolvedLockedResult && caseDeliveryMode === "lock_base_swap" && rawCaseRefs.length > 0) {
        for (const ref of rawCaseRefs.slice(0, 1)) {
          const sanitized = await resolveReferenceInlineImage(ref, ossConfig);
          if (sanitized) {
            parts.push({
              text: `【版式锁底参考图】：保持此图的背景展台与版式结构，将产品100%替换为上方我方商品实拍原图，严禁保留参考图中的竞品Logo或原文字。`,
            });
            parts.push({
              inlineData: {
                data: sanitized.data,
                mimeType: sanitized.mimeType,
              },
            });
          }
        }
      } else if (!resolvedLockedResult && caseDeliveryMode === "shared_style" && rawCaseRefs.length > 0) {
        for (const ref of rawCaseRefs.slice(0, 1)) {
          const sanitized = await resolveReferenceInlineImage(ref, ossConfig);
          if (sanitized) {
            parts.push({
              text: `【全页共用美学风格参考图（仅参考光影色调与材质氛围）】：请仅提取此图的布光质感、色温调性与商业美学氛围，商品主体必须100%采用上方我方商品实拍图，严禁复制此参考图中的竞品外观或原图文字！`,
            });
            parts.push({
              inlineData: {
                data: sanitized.data,
                mimeType: sanitized.mimeType,
              },
            });
          }
        }
      }

      const rawModuleSkeleton =
        (moduleType && SERVER_MODULE_SKELETONS[moduleType]) || "";
      const moduleSkeleton = sanitizePromptForRender(rawModuleSkeleton);
      const specBlock = unifiedVisualSpec?.trim()
        ? `【整页统一视觉规范（跨屏色彩与材质铁律）】：\n${sanitizePromptForRender(unifiedVisualSpec.trim())}`
        : `【整页统一视觉规范】：现代高质感商业摄影棚拍，极简几何展台，柔和立体主光配轮廓高光，全页色温与主辅色调高度统一，四周保留至少8%呼吸留白。`;

      const print4dDetailBlock = buildPrint4dDirective(printThemeConfig);

      const lockedRefineDirective = resolvedLockedResult
        ? `【🔒 本屏锁当前成图局部微调硬性法则（最高优先级）】：\n1. 严格锁定上方【当前分屏已确认满意成图基准】的相机视角、商品摆位、背景展台、光影氛围与整体排版结构，严禁改变大构图；\n2. ${cleanRefineInstruction ? `重点执行以下局部修改指令：「${cleanRefineInstruction}」；` : "保持当前构图，按下方最新屏内文案与细节描述进行局部精修；"}\n3. 商品主体必须与我方商品原图 100% 一致，严禁几何拉伸变形！`
        : "";

      const reframeDirective = hasVerticalReframeSource
        ? `【主图 ➔ 详情页（${effectiveRatio}）同源纵向重构硬性法则】：\n1. 严格锁定上方【同源1:1主图基准成图】的视觉世界观、潮玩展台、伴生元素与色调；\n2. 将原本紧凑的 1:1 构图在 ${effectiveRatio} 竖屏画布中纵向舒展：顶部 20% 区域拉开呼吸感排布主副标题，中部 55% 区域黄金居中陈列我方商品与联动展台，底部 25% 区域规整排布圆角矩形卖点卡片；\n3. 严禁对商品本体做任何纵向拉伸，商品长宽比必须与商品原图 100% 一致！`
        : "";

      const cleanTypo = sanitizeCopyForRender(typographyPlan?.trim() || "");
      const cleanCopy = sanitizeCopyForRender(copywriting?.trim() || "");
      const copyBlock =
        cleanTypo && cleanCopy
          ? cleanTypo.includes(cleanCopy)
            ? cleanTypo
            : cleanCopy.includes(cleanTypo)
              ? cleanCopy
              : `${cleanTypo}\n${cleanCopy}`
          : cleanTypo || cleanCopy;

      const textInstruction =
        textMode === "without_text"
          ? `【无文字纯视觉底图模式】：画面中严禁渲染任何文字、字母或参数表格线，仅渲染纯净的商业场景、光影展台与我方商品本体，并在顶部/底部预留干净的排版负空间留白。`
          : `【屏内中文排版与信息渲染指令（仅允许在画面顶部标题区和底部圆角矩形信息卡内渲染以下纯净中文文案，绝对禁止在展台底座或产品旁印出任何编号如#Prod、区域名如“潮玩舞台区”、色号代码或方括号[]！）】：\n${copyBlock || sanitizeCopyForRender(title) || "品牌核心品质展示"}`;

      const antiDeformBlock =
        prodRefs.length > 0
          ? `【严禁商品变形与多角度重复堆砌（核心硬指标）】：\n1. 必须 100% 严格还原上方上传的我方自有商品实拍图的真实工业外形、色彩质感与壳面印花细节；无论当前分屏比例（${effectiveRatio}）如何，绝对禁止将商品垂直拉伸或横向压扁！\n2. ${isMultiSkuMatrixScreen ? "本屏为多花色合集屏，请将不同花色款式整齐陈列。" : "本屏为单款商品特写/场景屏，画面中央展台上仅展示 1 套商品主体（如 1 个充电仓搭配 1 对耳机），严禁将不同角度的参考图画成 2~3 个充电仓同时摆在展台上！"}\n3. 画面背景中严禁出现医药胶囊药丸形状的漂浮物，严禁在展台或背景中印出任何非文案的提示词术语！`
          : "";

      finalPrompt = [
        lockedRefineDirective,
        specBlock,
        print4dDetailBlock,
        reframeDirective,
        moduleSkeleton ? `【当前详情页模块定位】：${moduleSkeleton}` : "",
        antiDeformBlock,
        `【本屏视觉场景与产品构图描述】：\n${sanitizePromptForRender(prompt)}`,
        userNote?.trim() ? `【本屏额外补充要求】：${sanitizePromptForRender(userNote)}` : "",
        cleanRefineInstruction
          ? `【🔒 本次局部微调专项指令】：${cleanRefineInstruction}`
          : "",
        textInstruction,
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
    }

    parts.push({
      text: finalPrompt,
    });

    // Validate aspect ratios per model capability
    const standardRatios = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"]);

    const endpoint = normalizeUniversalEndpoint(customBaseUrl);
    const startTime = Date.now();

    // Map deprecated/alias image model names to supported Gemini image models when running on Gemini Native
    const resolvePrimaryGeminiImageModel = (rawModel: string): string => {
      const m = (rawModel || "").trim();
      const lower = m.toLowerCase();
      if (
        !m ||
        lower.includes("2.5-flash-image") ||
        lower.includes("2.0-flash") ||
        !isLikelyGeminiModel(m)
      ) {
        return "gemini-nano-banana-2.1";
      }
      return m;
    };

    const extractImageFromResponse = (
      response: any
    ): { imageUrl: string | null; textNote: string } => {
      let imageUrl: string | null = null;
      let textNote = "";
      const candidateParts = response?.candidates?.[0]?.content?.parts || [];
      for (const part of candidateParts) {
        if (part?.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part?.text) {
          textNote += part.text;
        }
      }
      return { imageUrl, textNote: textNote.trim() };
    };

    const runGeminiNativeImage = async (): Promise<{
      imageUrl: string;
      textNote: string;
      protocolUsed: string;
      modelUsed: string;
    }> => {
      const ai = createGeminiClient(
        customBaseUrl,
        customApiKey,
        customHeaders
      );
      const primaryModel = resolvePrimaryGeminiImageModel(imageModel);

      // Build deduplicated fallback chain of Gemini image models
      const candidateModels = Array.from(
        new Set([
          primaryModel,
          "gemini-nano-banana-2.1",
          "gemini-3.1-flash-lite-image",
          "gemini-3-pro-image",
        ])
      );

      let lastError: any = null;

      for (const candidateModel of candidateModels) {
        const modelLower = candidateModel.toLowerCase();
        const isLiteModel = modelLower.includes("flash-lite");
        const ratioForModel =
          isLiteModel && !standardRatios.has(effectiveRatio)
            ? "9:16"
            : effectiveRatio;

        const imageConfig: Record<string, string> = {
          aspectRatio: ratioForModel,
        };
        if (
          !isLiteModel &&
          (modelLower.includes("banana") ||
            modelLower.includes("pro-image") ||
            modelLower.includes("3.1-flash-image"))
        ) {
          imageConfig.imageSize = imageSize || "1K";
        }

        // Attempt 1: Full parts + full imageConfig
        try {
          const response = await ai.models.generateContent({
            model: candidateModel,
            contents: { parts },
            config: { imageConfig },
          });
          const extracted = extractImageFromResponse(response);
          if (extracted.imageUrl) {
            return {
              imageUrl: extracted.imageUrl,
              textNote: extracted.textNote,
              protocolUsed: "gemini-native",
              modelUsed: candidateModel,
            };
          }
          // Model returned text without an image -> trigger Attempt 2 with explicit image directive
          const directParts = [
            ...parts,
            {
              text: "\n[IMPORTANT: Please generate and output the rendered product image directly. Do not reply with text only.]",
            },
          ];
          const retryRes = await ai.models.generateContent({
            model: candidateModel,
            contents: { parts: directParts },
            config: {
              imageConfig: {
                aspectRatio: standardRatios.has(ratioForModel)
                  ? ratioForModel
                  : "9:16",
              },
            },
          });
          const retryExtracted = extractImageFromResponse(retryRes);
          if (retryExtracted.imageUrl) {
            return {
              imageUrl: retryExtracted.imageUrl,
              textNote: retryExtracted.textNote,
              protocolUsed: "gemini-native",
              modelUsed: candidateModel,
            };
          }
          lastError = new Error(
            retryExtracted.textNote ||
              extracted.textNote ||
              `模型 ${candidateModel} 未返回图像数据`
          );
        } catch (err: any) {
          lastError = err;
          // Attempt 2 on error: Retry without imageSize and with standard aspect ratio
          try {
            const fallbackRatio = standardRatios.has(ratioForModel)
              ? ratioForModel
              : "9:16";
            const retryRes = await ai.models.generateContent({
              model: candidateModel,
              contents: { parts },
              config: {
                imageConfig: { aspectRatio: fallbackRatio },
              },
            });
            const retryExtracted = extractImageFromResponse(retryRes);
            if (retryExtracted.imageUrl) {
              return {
                imageUrl: retryExtracted.imageUrl,
                textNote: retryExtracted.textNote,
                protocolUsed: "gemini-native",
                modelUsed: candidateModel,
              };
            }
          } catch (retryErr: any) {
            lastError = retryErr;
          }
        }
      }

      // Final fallback:
      // - If both #Prod and #Case were sent and caused a multi-image payload block, retry keeping ONLY the primary #Prod image so product identity is never lost.
      // - NEVER silently drop #Prod and generate a hallucinated product from text alone when prodRefs.length > 0!
      if (prodRefs.length > 0 && (rawCaseRefs.length > 0 || resolvedLockedResult)) {
        try {
          const primaryProdResolved = await resolveReferenceInlineImage(
            prodRefs[0],
            ossConfig
          );
          if (primaryProdResolved) {
            const fallbackRatio = standardRatios.has(effectiveRatio)
              ? effectiveRatio
              : "9:16";
            const prodOnlyParts: any[] = [];
            if (resolvedLockedResult) {
              prodOnlyParts.push(
                {
                  text: `【当前满意成图底板 #LockedResult（最高优先级构图/光影/主体锚点）】：请严格锁死此图的整体构图与商品位置，仅按局部微调指令修改目标区域！`,
                },
                {
                  inlineData: {
                    data: resolvedLockedResult.data,
                    mimeType: resolvedLockedResult.mimeType,
                  },
                }
              );
            }
            prodOnlyParts.push(
              {
                text: `【我方自有产品原图 #${prodRefs[0].code || "Prod"}】：请100%严格还原此商品外观、比例、配色与细节！`,
              },
              {
                inlineData: {
                  data: primaryProdResolved.data,
                  mimeType: primaryProdResolved.mimeType,
                },
              },
              { text: finalPrompt }
            );
            const prodOnlyRes = await ai.models.generateContent({
              model: "gemini-nano-banana-2.1",
              contents: { parts: prodOnlyParts },
              config: {
                imageConfig: { aspectRatio: fallbackRatio },
              },
            });
            const extracted = extractImageFromResponse(prodOnlyRes);
            if (extracted.imageUrl) {
              return {
                imageUrl: extracted.imageUrl,
                textNote: extracted.textNote,
                protocolUsed: "gemini-native",
                modelUsed: "gemini-nano-banana-2.1",
              };
            }
          }
        } catch (prodOnlyErr) {
          lastError = prodOnlyErr;
        }
      } else if (prodRefs.length === 0 && parts.length > 1) {
        try {
          const fallbackRatio = standardRatios.has(effectiveRatio)
            ? effectiveRatio
            : "9:16";
          const fallbackContents = resolvedLockedResult
            ? {
                parts: [
                  {
                    text: `【当前满意成图底板 #LockedResult（最高优先级构图/光影/主体锚点）】：请严格锁死此图的整体构图与商品位置，仅按局部微调指令修改目标区域！`,
                  },
                  {
                    inlineData: {
                      data: resolvedLockedResult.data,
                      mimeType: resolvedLockedResult.mimeType,
                    },
                  },
                  { text: finalPrompt },
                ],
              }
            : finalPrompt;
          const promptOnlyRes = await ai.models.generateContent({
            model: "gemini-nano-banana-2.1",
            contents: fallbackContents,
            config: {
              imageConfig: { aspectRatio: fallbackRatio },
            },
          });
          const extracted = extractImageFromResponse(promptOnlyRes);
          if (extracted.imageUrl) {
            return {
              imageUrl: extracted.imageUrl,
              textNote: extracted.textNote,
              protocolUsed: "gemini-native",
              modelUsed: "gemini-nano-banana-2.1",
            };
          }
        } catch (promptOnlyErr) {
          lastError = promptOnlyErr;
        }
      }

      throw (
        lastError ||
        new Error("生图模型未返回有效图像，请尝试调整提示词或切换生图模型后重试。")
      );
    };

    const runOpenAiImage = async () => {
      const res = await callOpenAiCompatibleImage({
        endpoint,
        imageModel,
        finalPrompt,
        parts,
        aspectRatio: effectiveRatio,
        customApiKey,
        customHeaders,
      });
      return {
        ...res,
        modelUsed: imageModel,
      };
    };

    let result: {
      imageUrl: string;
      textNote: string;
      protocolUsed: string;
      modelUsed: string;
    };

    if (protocol === "gemini-native") {
      result = await runGeminiNativeImage();
    } else if (protocol === "openai-compatible") {
      try {
        result = await runOpenAiImage();
      } catch (openAiErr) {
        // If no external custom gateway is configured or OpenAI image endpoint is unsupported, gracefully fall back to Gemini Native
        if (!endpoint.rawUrl || isLikelyGeminiModel(imageModel)) {
          result = await runGeminiNativeImage();
        } else {
          throw openAiErr;
        }
      }
    } else {
      // 'auto' mode:
      const preferOpenAi =
        Boolean(endpoint.rawUrl) &&
        (!isLikelyGeminiModel(imageModel) ||
          (endpoint.explicitOpenAiSuffix && !endpoint.explicitGeminiSuffix));

      if (preferOpenAi) {
        try {
          result = await runOpenAiImage();
        } catch {
          result = await runGeminiNativeImage();
        }
      } else {
        try {
          result = await runGeminiNativeImage();
        } catch (geminiErr) {
          if (endpoint.rawUrl) {
            try {
              result = await runOpenAiImage();
            } catch {
              throw geminiErr;
            }
          } else {
            throw geminiErr;
          }
        }
      }
    }

    // Optional: Automatically archive generated result image to active Cloud Storage (Aliyun OSS or Cloudflare R2) if enabled
    let resultOssUrl: string | undefined;
    if (ossConfig?.enabled && ossConfig?.autoArchiveResults !== false) {
      try {
        const sanitizedOut = sanitizeInlineImage(
          undefined,
          "image/png",
          result.imageUrl
        );
        if (sanitizedOut) {
          const outBuf = Buffer.from(sanitizedOut.data, "base64");
          const uploadedOut = await uploadBufferToCloudStorage({
            buffer: outBuf,
            mimeType: sanitizedOut.mimeType,
            folder: "results",
            fileNameHint: title || "screen_result",
            ossConfig,
          });
          resultOssUrl = uploadedOut.ossUrl;
        }
      } catch (ossErr) {
        console.warn("Auto archive result image to cloud storage failed (non-fatal):", ossErr);
      }
    }

    res.json({
      imageUrl: result.imageUrl,
      ossUrl: resultOssUrl,
      textNote: result.textNote,
      durationMs: Date.now() - startTime,
      modelUsed: result.modelUsed || imageModel,
      protocolUsed: result.protocolUsed,
      aspectRatio: effectiveRatio,
      imageSize: imageSize || "1K",
    });
  } catch (err: any) {
    console.error("Error in /api/image/generate:", err);
    res.status(500).json({
      error: err?.message || "生成分屏图片失败，请检查模型配置或稍后重试。",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Com Studio Batch server running on http://localhost:${PORT}`);
  });
}

startServer();
