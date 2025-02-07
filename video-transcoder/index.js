const {
  GetObjectCommand,
  S3Client,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const path = require("node:path");
const ffmpeg = require("fluent-ffmpeg");
const fsPromise = require("node:fs/promises");
const fsNormal = require("node:fs");

// All env variables coming from video consumer service
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// env variables for the bucket to download video from
const tempBucketName = process.env.TEMP_BUCKET_NAME;
const tempBucketObjectKey = process.env.TEMP_BUCKET_OBJECT_KEY; // key of the video file

// env variables for the bucket to upload transcoded video to
const prodBucketName = process.env.PROD_BUCKET_NAME;

const RESOLUTIONS = [
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 858, height: 480 },
  { name: "720p", width: 1280, height: 720 },
];

const client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

async function init() {
  // download original video from temp S3 bucket
  const command = new GetObjectCommand({
    Bucket: tempBucketName,
    Key: tempBucketObjectKey,
  });

  const result = await client.send(command);

  const originalFilePath = `original-video.mp4`;
  const originalVideoPath = path.resolve(originalFilePath);

  await fsPromise.writeFile(originalVideoPath, result.Body);

  // start the transcoder service
  const promises = RESOLUTIONS.map((resolution) => {
    const outputFilePath = `video-${resolution.name}.mp4`;

    return new Promise((resolve) => {
      ffmpeg(originalVideoPath)
        .output(outputFilePath)
        .withVideoCodec("libx264")
        .withAudioCodec("aac")
        .withSize(`${resolution.width}x${resolution.height}`)
        .on("end", async () => {
          const command = new PutObjectCommand({
            Bucket: prodBucketName,
            Key: outputFilePath,
            Body: fsNormal.createReadStream(path.resolve(outputFilePath)),
          });
          await client.send(command);
          resolve(outputFilePath);
        })
        .format("mp4")
        .run();
    });
  });

  await Promise.all(promises);
}

init();
