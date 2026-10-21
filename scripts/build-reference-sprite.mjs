import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("C:/Users/wac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs");

const inputs = [
  {
    file: "C:/Users/wac/Downloads/download (1).jpg",
    crop: { left: 275, top: 125, width: 165, height: 265 },
    threshold: 58
  },
  {
    file: "C:/Users/wac/Downloads/Spiderman – Brand New Day _ Marvel Pixelart.jpg",
    crop: { left: 245, top: 165, width: 255, height: 240 },
    threshold: 55
  },
  {
    file: "C:/Users/wac/Downloads/Spider-Man – Classic _ Marvel Pixelart.jpg",
    crop: { left: 250, top: 215, width: 250, height: 245 },
    threshold: 55
  },
  {
    file: "C:/Users/wac/Downloads/download.jpg",
    crop: { left: 205, top: 285, width: 305, height: 385 },
    threshold: 65
  }
];

async function removeFlatBackground(item) {
  const { data, info } = await sharp(item.file)
    .extract(item.crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cornerIndexes = [
    0,
    (info.width - 1) * 4,
    (info.height - 1) * info.width * 4,
    ((info.height * info.width) - 1) * 4
  ];
  const background = [0, 1, 2].map((channel) => {
    const values = cornerIndexes.map((index) => data[index + channel]).sort((a, b) => a - b);
    return Math.round((values[1] + values[2]) / 2);
  });
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.hypot(
      data[index] - background[0],
      data[index + 1] - background[1],
      data[index + 2] - background[2]
    );

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const belongsToSprite =
      maximum < 118 ||
      (red > 115 && red > green * 1.25 && red > blue * 1.12) ||
      (blue > 90 && blue > red * 1.15 && blue > green * 1.08) ||
      (minimum > 205 && maximum - minimum < 32) ||
      (red > 165 && green > 115 && blue < 115);

    if (distance < item.threshold || !belongsToSprite) data[index + 3] = 0;
    else if (distance < item.threshold + 18) {
      data[index + 3] = Math.round(255 * (distance - item.threshold) / 18);
    }
  }

  const trimmed = await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 128,
      height: 160,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite([{
    input: await sharp(trimmed).resize({
      width: 112,
      height: 144,
      fit: "contain",
      kernel: "nearest",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }).png().toBuffer(),
    gravity: "center"
  }]).png().toBuffer();
}

const frames = await Promise.all(inputs.map(removeFlatBackground));
await sharp({
  create: {
    width: 512,
    height: 160,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
}).composite(frames.map((input, index) => ({
  input,
  left: index * 128,
  top: 0
}))).png({ palette: true, colours: 128 }).toFile("assets/webling-cute-reference-strip.png");

console.log("Created assets/webling-cute-reference-strip.png");
