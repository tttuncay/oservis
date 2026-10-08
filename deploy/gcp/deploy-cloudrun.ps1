# =====================================================================================
# Google Cloud Run — Tek Komutla Canlıya Alma Scripti (PowerShell)
# =====================================================================================

param (
    [string]$ProjectId = "your-gcp-project-id",
    [string]$Region = "europe-west3",
    [string]$ServiceName = "oservis-api"
)

Write-Host ">>> [1/3] Google Cloud Projesi ayarlanıyor: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId

Write-Host ">>> [2/3] Docker Image oluşturuluyor ve Google Cloud Build ile derleniyor..." -ForegroundColor Cyan
gcloud builds submit --config ./deploy/gcp/cloudbuild.yaml .

Write-Host ">>> [3/3] Başarıyla Google Cloud Run üzerine dağıtıldı!" -ForegroundColor Green
gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
