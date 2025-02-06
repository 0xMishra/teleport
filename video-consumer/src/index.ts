import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { config } from "dotenv";

config();

const client = new SQSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

async function init() {
  const command = new ReceiveMessageCommand({
    QueueUrl: process.env.QUEUE_URL as string,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
  });

  while (true) {
    const { Messages } = await client.send(command);

    if (!Messages) {
      console.log("No message in the queue");
      continue;
    }

    for (const msg of Messages) {
      const { MessageId, Body } = msg;
      console.log(`Received Message:\nId:${MessageId}\nBody:${Body}\n`);
    }
  }
}

init();
