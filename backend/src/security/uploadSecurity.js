import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const BASE_UNTRUSTED_UPLOAD_DIR = process.env.UNTRUSTED_UPLOAD_DIR
  ? path.resolve(process.env.UNTRUSTED_UPLOAD_DIR)
  : path.join(os.tmpdir(), 'telyx-untrusted-uploads');

const EICAR_SIGNATURE = Buffer.from(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  'utf8'
);

const EXECUTABLE_MAGIC_NUMBERS = [
  Buffer.from('4d5a', 'hex'), // Windows PE
  Buffer.from('7f454c46', 'hex'), // ELF
  Buffer.from('feedface', 'hex'), // Mach-O 32
  Buffer.from('feedfacf', 'hex'), // Mach-O 64
  Buffer.from('cafebabe', 'hex'), // Java class/fat binary
];

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.ps1', '.vbs',
  '.sh', '.bash', '.zsh', '.ksh', '.py', '.php', '.jsp', '.jar',
  '.war', '.apk', '.bin', '.scr',
]);

const SUPPORTED_SCAN_MODES = new Set(['required', 'best_effort']);
let hasLoggedInvalidScanMode = false;

function ensureDirectoryPermissionsSync(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(targetDir, 0o700);
  } catch (_error) {
    // Ignore on filesystems that do not support chmod.
  }
}

function startsWithMagic(buffer, magic) {
  if (!Buffer.isBuffer(buffer) || buffer.length < magic.length) return false;
  return buffer.subarray(0, magic.length).equals(magic);
}

function detectKnownMalwareSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.includes(EICAR_SIGNATURE)) {
    return 'EICAR_TEST_SIGNATURE';
  }
  return null;
}

function detectExecutablePayload(buffer, fileName = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return `DANGEROUS_EXTENSION_${extension}`;
  }

  for (const magic of EXECUTABLE_MAGIC_NUMBERS) {
    if (startsWithMagic(buffer, magic)) {
      return 'EXECUTABLE_MAGIC_HEADER';
    }
  }

  return null;
}

async function runClamAvScan(filePath) {
  const candidates = [
    { bin: 'clamdscan', args: ['--no-summary', filePath] },
    { bin: 'clamscan', args: ['--no-summary', filePath] },
  ];

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.bin, candidate.args, { timeout: 20_000 });
      return { scanned: true, clean: true, engine: candidate.bin };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }

      // ClamAV returns exit code 1 when malware is found.
      if (error?.code === 1 || error?.code === '1') {
        return {
          scanned: true,
          clean: false,
          engine: candidate.bin,
          details: String(error.stdout || error.stderr || 'INFECTED'),
        };
      }

      // Non-scan failures are treated as scanner unavailable for best-effort mode.
      return {
        scanned: false,
        clean: false,
        engine: candidate.bin,
        details: String(error.message || 'SCAN_FAILED'),
      };
    }
  }

  return { scanned: false, clean: false, engine: null, details: 'ENGINE_NOT_AVAILABLE' };
}

function resolveMalwareScanMode() {
  const configuredMode = process.env.MALWARE_SCAN_MODE;

  if (!configuredMode) {
    return 'best_effort';
  }

  const normalizedMode = String(configuredMode).trim().toLowerCase();
  if (SUPPORTED_SCAN_MODES.has(normalizedMode)) {
    return normalizedMode;
  }

  if (!hasLoggedInvalidScanMode) {
    console.warn(
      `⚠️ [UploadSecurity] Unsupported MALWARE_SCAN_MODE "${configuredMode}", falling back to "best_effort".`
    );
    hasLoggedInvalidScanMode = true;
  }

  return 'best_effort';
}

export function resolveUntrustedUploadDir(scope = 'general') {
  const normalizedScope = String(scope || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40) || 'general';

  ensureDirectoryPermissionsSync(BASE_UNTRUSTED_UPLOAD_DIR);
  const scopedDir = path.join(BASE_UNTRUSTED_UPLOAD_DIR, normalizedScope);
  ensureDirectoryPermissionsSync(scopedDir);
  return scopedDir;
}

export function generateSafeUploadFilename(originalName = 'file.bin') {
  const extension = path.extname(String(originalName || '')).toLowerCase().slice(0, 10);
  const random = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${random}${extension}`;
}

export async function hardenUploadedFilePermissions(filePath) {
  if (!filePath) return;
  try {
    await fsp.chmod(filePath, 0o600);
  } catch (_error) {
    // Ignore on unsupported filesystems.
  }
}

export async function validateUntrustedUpload({
  filePath = null,
  fileBuffer = null,
  fileName = '',
  maxSizeBytes = null,
} = {}) {
  if (!filePath && !Buffer.isBuffer(fileBuffer)) {
    throw new Error('UPLOAD_SECURITY_MISSING_SOURCE');
  }

  let buffer = fileBuffer;

  if (!buffer && filePath) {
    await hardenUploadedFilePermissions(filePath);
    buffer = await fsp.readFile(filePath);
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('UPLOAD_SECURITY_EMPTY_FILE');
  }

  if (typeof maxSizeBytes === 'number' && maxSizeBytes > 0 && buffer.length > maxSizeBytes) {
    throw new Error('UPLOAD_SECURITY_FILE_TOO_LARGE');
  }

  const signatureHit = detectKnownMalwareSignature(buffer);
  if (signatureHit) {
    throw new Error(`MALWARE_DETECTED_${signatureHit}`);
  }

  const executableHit = detectExecutablePayload(buffer, fileName);
  if (executableHit) {
    throw new Error(`MALWARE_DETECTED_${executableHit}`);
  }

  const mode = resolveMalwareScanMode();

  let scanPath = filePath;
  let temporaryScanPath = null;

  if (!scanPath) {
    const tmpDir = resolveUntrustedUploadDir('scan_tmp');
    temporaryScanPath = path.join(tmpDir, generateSafeUploadFilename(fileName || 'scan.bin'));
    await fsp.writeFile(temporaryScanPath, buffer, { mode: 0o600 });
    scanPath = temporaryScanPath;
  }

  try {
    const clam = await runClamAvScan(scanPath);

    if (clam.scanned && !clam.clean) {
      throw new Error('MALWARE_DETECTED_CLAMAV');
    }

    if (!clam.scanned && mode === 'required') {
      throw new Error('MALWARE_SCANNER_UNAVAILABLE');
    }

    return {
      scannedByEngine: clam.scanned,
      scannerEngine: clam.engine,
      scannerDetails: clam.details || null,
    };
  } finally {
    if (temporaryScanPath) {
      await fsp.unlink(temporaryScanPath).catch(() => {});
    }
  }
}

export default {
  resolveUntrustedUploadDir,
  generateSafeUploadFilename,
  hardenUploadedFilePermissions,
  validateUntrustedUpload,
};
