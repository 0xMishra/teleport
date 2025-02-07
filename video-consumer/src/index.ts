import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { config } from "dotenv";
import type { S3Event } from "aws-lambda";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

config();

// All env variables
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID as string;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY as string;
const awsQueueUrl = process.env.QUEUE_URL as string;
const taskDefArn = process.env.TASK_DEF_ARN as string;
const clusterArn = process.env.CLUSTER_ARN as string;
const taskImageName = process.env.TASK_IMAGE_NAME as string;
const securityGrp = process.env.SECUIRITY_GROUP as string;
const subnet1 = process.env.SUBNET1 as string;
const subnet2 = process.env.SUBNET2 as string;
const subnet3 = process.env.SUBNET3 as string;

// envs to be passed down to the ECS task container
const prodBucketName = process.env.PROD_BUCKET_NAME as string; // bucket to upload transcoded video to

const client = new SQSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

async function init() {
  const command = new ReceiveMessageCommand({
    QueueUrl: awsQueueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
  });

  while (true) {
    const { Messages } = await client.send(command);

    if (!Messages) {
      console.log("No message in the queue");
      continue;
    }

    try {
      for (const msg of Messages) {
        const { MessageId, Body } = msg;
        console.log(`Received Message:\nId:${MessageId}\nBody:${Body}\n`);

        if (!Body) continue;

        // validate and parse event
        const event = JSON.parse(Body) as S3Event;

        // ignore test event
        if ("Service" in event && "Event" in event) {
          if (event.Event === "s3:TestEvent") {
            deleteMessage(msg);
            continue;
          }
        }

        // Run the ECS task for every event
        for (const record of event.Records) {
          const { s3 } = record;
          const {
            bucket,
            object: { key },
          } = s3;

          // spin up the ECS docker container
          runEcsTask(bucket, key);

          // delete message from the queue
          deleteMessage(msg);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}

async function deleteMessage(msg: Message) {
  await client.send(
    new DeleteMessageCommand({
      QueueUrl: awsQueueUrl,
      ReceiptHandle: msg.ReceiptHandle,
    }),
  );
}

async function runEcsTask(
  bucket: {
    name: string;
    ownerIdentity: {
      principalId: string;
    };
    arn: string;
  },
  key: string,
) {
  const runTaskCommand = new RunTaskCommand({
    taskDefinition: taskDefArn,
    cluster: clusterArn,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        securityGroups: [securityGrp],
        subnets: [subnet1, subnet2, subnet3],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: taskImageName,
          environment: [
            {
              name: "AWS_ACCESS_KEY_ID",
              value: awsAccessKeyId,
            },
            {
              name: "AWS_SECRET_ACCESS_KEY",
              value: awsSecretAccessKey,
            },
            {
              name: "TEMP_BUCKET_NAME",
              value: bucket.name,
            },
            {
              name: "TEMP_BUCKET_OBJECT_KEY",
              value: key,
            },
            {
              name: "PROD_BUCKET_NAME",
              value: prodBucketName,
            },
          ],
        },
      ],
    },
  });

  await ecsClient.send(runTaskCommand);
}

init();
