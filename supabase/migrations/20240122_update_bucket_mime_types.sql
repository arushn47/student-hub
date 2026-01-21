-- Update exam-pdfs bucket to allow image files for syllabus
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
]
WHERE id = 'exam-pdfs';
