/**
 * UUID v7 生成器（时间排序的 UUID）
 *
 * UUID v7 格式：tttttttt-tttt-7xxx-8xxx-xxxxxxxxxxxx
 * 前 48 位是 Unix 毫秒时间戳，确保在 IndexedDB 中天然按创建时间有序。
 */

export function generateId(): string {
  const timestamp = Date.now();

  // 时间戳部分（48 bits）
  const tsHex = timestamp.toString(16).padStart(12, "0");

  // 随机部分
  const randomA = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
  const randomB = Math.floor(Math.random() * 0x4000).toString(16).padStart(4, "0");
  const randomC = Math.floor(Math.random() * 0x4000).toString(16).padStart(4, "0");
  const randomD = Math.floor(Math.random() * 0x4000).toString(16).padStart(4, "0");

  // UUID v7 格式
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randomA}-8${randomB.slice(1)}-${randomC}${randomD}`;
}

/** 从 UUID v7 中提取时间戳 */
export function extractTimestamp(id: string): number {
  const tsHex = id.replace(/-/g, "").slice(0, 12);
  return parseInt(tsHex, 16);
}
