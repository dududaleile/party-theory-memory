import sharp from "sharp";

const blue = "#0071E3";

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="40" fill="${blue}"/><text x="96" y="122" text-anchor="middle" font-size="100" fill="white">🏛</text></svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="100" fill="${blue}"/><text x="256" y="325" text-anchor="middle" font-size="260" fill="white">🏛</text></svg>`;

await sharp(Buffer.from(svg192)).png().toFile("../client/public/icon-192.png");
await sharp(Buffer.from(svg512)).png().toFile("../client/public/icon-512.png");
console.log("PWA icons generated ✅");
