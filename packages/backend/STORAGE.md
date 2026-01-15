# File Storage Setup

This project uses S3-compatible storage for file attachments. You can use:
- **MinIO** (local development, included in docker-compose.yml)
- **AWS S3** (production)
- **Cloudflare R2** (production)

## Local Development with MinIO

### 1. Start MinIO using Docker Compose

From the project root:

```bash
docker-compose up -d minio
```

This will start MinIO on:
- API: http://localhost:9000
- Console: http://localhost:9001

Default credentials:
- Username: `minioadmin`
- Password: `minioadmin`

### 2. Create the storage bucket

```bash
cd packages/backend
npm run setup-storage
```

This will create the `gsd-attachments` bucket if it doesn't exist.

### 3. Configure environment variables

Copy `.env.example` to `.env` and ensure these values are set:

```env
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=gsd-attachments
```

## Production Setup

### AWS S3

1. Create an S3 bucket in your AWS account
2. Create an IAM user with S3 permissions
3. Set environment variables:

```env
S3_ENDPOINT=  # Leave empty for AWS S3
S3_REGION=us-east-1  # Your bucket region
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
```

### Cloudflare R2

1. Create an R2 bucket in your Cloudflare account
2. Generate R2 API tokens
3. Set environment variables:

```env
S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your-r2-access-key
S3_SECRET_ACCESS_KEY=your-r2-secret-key
S3_BUCKET_NAME=your-bucket-name
```

## Storage Features

- Files are stored with unique keys: `{timestamp}-{random-id}.{ext}`
- Presigned URLs for secure downloads (1 hour expiration)
- Support for image previews (thumbnails will be generated in future)
- Max file size: 10MB (configurable via multer)
