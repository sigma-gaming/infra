# Infra

## Setup backend

1. Copy service account key for accessing GCS into `backend/state-gcs-key.json`
2. Create `backend/backend.tfvars` with the following content:

    ```hcl
    bucket      = "<bucket-name>"
    credentials = "../backend/state-gcs-key.json"
    ```
3. Run `pnpm <plan-name>:init`
