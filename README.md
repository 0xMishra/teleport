## Architecture

![diagram-export-2-7-2025-6_46_43-AM](https://github.com/user-attachments/assets/3d6b2caf-e380-486e-a8bd-2818285c4833)


## How to run the project

- Build the video-transcoder docker image and push it to your AWS ECR
- Go to your AWS console and create a new ECS cluster
- Then create a task definition in that cluster using the video-transcoder docker image from your AWS ECR
- Now create a `.env` file inside each video-consumer and add all the required environment variables ( take a look at the `.env.example` for reference)
- After that `cd` into video-consumer  and run `npm i && npm run dev`
