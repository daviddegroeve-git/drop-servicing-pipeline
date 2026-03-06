$envVars = "SUPABASE_URL=https://ozkmsuodpghtsqcmpsmk.supabase.co,SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96a21zdW9kcGdodHNxY21wc21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjI4MzQsImV4cCI6MjA4ODAzODgzNH0.nbizYgk463D97gFS-bXE_8FWa-lgxN1_0VM4j6PFBJ0"

gcloud run deploy whatsapp-service --source . --region us-central1 --allow-unauthenticated --min-instances 1 --memory 2Gi --no-cpu-throttling --set-env-vars $envVars
