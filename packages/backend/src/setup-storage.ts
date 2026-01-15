import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

// S3-compatible storage client
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'gsd-attachments';

async function setupStorage() {
  console.log('Setting up S3-compatible storage...');
  console.log(`Endpoint: ${process.env.S3_ENDPOINT || 'http://localhost:9000'}`);
  console.log(`Bucket: ${BUCKET_NAME}`);

  try {
    // Check if bucket already exists
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✓ Bucket '${BUCKET_NAME}' already exists`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      console.log(`Creating bucket '${BUCKET_NAME}'...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✓ Bucket '${BUCKET_NAME}' created successfully`);
    } else {
      console.error('Error checking/creating bucket:', error);
      process.exit(1);
    }
  }

  console.log('\nStorage setup complete!');
  console.log('You can access MinIO console at: http://localhost:9001');
  console.log('Username: minioadmin');
  console.log('Password: minioadmin');
}

setupStorage();
